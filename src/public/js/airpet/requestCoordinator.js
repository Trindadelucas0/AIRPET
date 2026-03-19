(function (global) {
  'use strict';

  if (global.AIRPET_REQ_COORDINATOR) return;

  var PRIORITY = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

  // Instrumentação (opcional): escrevemos em window.AIRPET_METRICS.
  var metrics = global.AIRPET_METRICS = global.AIRPET_METRICS || {
    requests: {
      totalEnqueued: 0,
      dedupeHits: 0,
      queued: 0,
      started: 0,
      finished: 0,
      aborted: 0,
      rateLimited: 0
    },
    durationsMs: {}, // endpoint -> [ms...]
    queueDelaysMs: {} // endpoint -> [ms...]
  };

  function isAbortError(err) {
    if (!err) return false;
    var name = (err && err.name) || '';
    return name === 'AbortError' || String(err.message || '').toLowerCase().includes('aborted');
  }

  function pushLimitedArray(targetArr, v, limit) {
    if (!targetArr) return;
    targetArr.push(v);
    if (targetArr.length > limit) targetArr.shift();
  }

  function endpointFromKey(key) {
    return String(key || '').split(':')[0] || 'unknown';
  }

  function percentileMs(arr, p) {
    if (!arr || !arr.length) return null;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var idx = Math.max(0, Math.min(a.length - 1, Math.ceil((p / 100) * a.length) - 1));
    return a[idx];
  }

  function createDeferred() {
    var resolve, reject;
    var promise = new Promise(function (res, rej) {
      resolve = res; reject = rej;
    });
    return { promise: promise, resolve: resolve, reject: reject };
  }

  function RequestCoordinator(opts) {
    opts = opts || {};
    this.maxConcurrent = Number.isFinite(opts.maxConcurrent) ? opts.maxConcurrent : 6;
    this.maxHigh = Number.isFinite(opts.maxHigh) ? opts.maxHigh : 3;

    // key -> { promise, controller, group, priority }
    this.inFlight = new Map();

    // Separate queues to prefer HIGH items.
    this.queues = {};
    this.queues[PRIORITY.HIGH] = [];
    this.queues[PRIORITY.MEDIUM] = [];
    this.queues[PRIORITY.LOW] = [];

    // Simple concurrency counters.
    this.activeCount = 0;
    this.activeHighCount = 0;

    this.rateLimits = new Map(); // key -> { windowMs, max, starts: [{t}] }
  }

  RequestCoordinator.prototype.setMaxPerKey = function (key, windowMs, max) {
    if (!key) return;
    var w = Number(windowMs);
    var m = Number(max);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(m) || m <= 0) return;
    this.rateLimits.set(String(key), { windowMs: w, max: m, starts: [] });
  };

  RequestCoordinator.prototype._canStartNow = function (priority) {
    if (this.activeCount >= this.maxConcurrent) return false;
    if (priority === PRIORITY.HIGH && this.activeHighCount >= this.maxHigh) return false;
    return true;
  };

  RequestCoordinator.prototype._drain = function () {
    var self = this;
    if (self.activeCount >= self.maxConcurrent) return;

    // Always try HIGH first.
    var priorities = [PRIORITY.HIGH, PRIORITY.MEDIUM, PRIORITY.LOW];
    for (var i = 0; i < priorities.length; i++) {
      var p = priorities[i];
      while (self.queues[p].length > 0 && self._canStartNow(p)) {
        var job = self.queues[p].shift();
        job();
      }
      if (self.activeCount >= self.maxConcurrent) return;
    }
  };

  RequestCoordinator.prototype._checkRateLimit = function (key) {
    var lim = this.rateLimits.get(String(key));
    if (!lim) return true;

    var now = Date.now();
    lim.starts = lim.starts.filter(function (s) { return now - s.t <= lim.windowMs; });
    if (lim.starts.length >= lim.max) return false;
    lim.starts.push({ t: now });
    return true;
  };

  RequestCoordinator.prototype.cancelGroup = function (groupName) {
    if (!groupName) return;
    var self = this;
    self.inFlight.forEach(function (info, key) {
      if (info.group === groupName && info.controller) {
        try { info.controller.abort(); } catch (_) {}
      }
    });
  };

  /**
   * @param {object} job
   * @param {string} job.key - dedupe key
   * @param {'HIGH'|'MEDIUM'|'LOW'} job.priority
   * @param {string} job.group - groupName for cancellation
   * @param {(signal:AbortSignal)=>Promise<any>} job.fetchFn
   */
  RequestCoordinator.prototype.enqueue = function (job) {
    var self = this;
    job = job || {};
    var key = String(job.key || '');
    if (!key) throw new Error('RequestCoordinator.enqueue: missing key');

    metrics.requests.totalEnqueued++;

    var priority = job.priority || PRIORITY.MEDIUM;
    if (priority !== PRIORITY.HIGH && priority !== PRIORITY.MEDIUM && priority !== PRIORITY.LOW) {
      priority = PRIORITY.MEDIUM;
    }

    var group = job.group || 'default';

    // Dedupe: same key already running -> reuse promise.
    if (self.inFlight.has(key)) {
      metrics.requests.dedupeHits++;
      return self.inFlight.get(key).promise;
    }

    // Rate limit per key (optional; used mostly for POST spam coalescing).
    if (!self._checkRateLimit(key)) {
      // Reject fast so callers can decide.
      metrics.requests.rateLimited++;
      return Promise.reject(Object.assign(new Error('Rate limit exceeded'), { code: 'RATE_LIMIT' }));
    }

    var controller = new AbortController();
    if (job.signal) {
      try {
        if (job.signal.aborted) controller.abort();
        else job.signal.addEventListener('abort', function () { controller.abort(); }, { once: true });
      } catch (_) {}
    }

    var deferred = createDeferred();

    var run = function () {
      var startedAt = Date.now();
      var queuedAt = run.__queuedAt;
      var queueDelay = queuedAt ? (startedAt - queuedAt) : 0;
      var endpoint = endpointFromKey(key);

      metrics.requests.started++;
      if (queueDelay > 0) {
        metrics.queueDelaysMs[endpoint] = metrics.queueDelaysMs[endpoint] || [];
        pushLimitedArray(metrics.queueDelaysMs[endpoint], queueDelay, 200);
      }

      // Track in-flight before starting, so dedupe works for concurrent calls.
      var fetchPromise = Promise.resolve()
        .then(function () { return job.fetchFn(controller.signal); });

      self.inFlight.set(key, {
        promise: fetchPromise,
        controller: controller,
        group: group,
        priority: priority
      });

      self.activeCount++;
      if (priority === PRIORITY.HIGH) self.activeHighCount++;

      var wasAborted = false;
      fetchPromise.then(function (data) {
        deferred.resolve(data);
      }).catch(function (err) {
        wasAborted = isAbortError(err);
        // If aborted, still reject so callers can ignore safely.
        deferred.reject(err);
      }).finally(function () {
        metrics.requests.finished++;
        if (wasAborted) metrics.requests.aborted++;

        var duration = Date.now() - startedAt;
        metrics.durationsMs[endpoint] = metrics.durationsMs[endpoint] || [];
        pushLimitedArray(metrics.durationsMs[endpoint], duration, 200);

        self.activeCount--;
        if (priority === PRIORITY.HIGH) self.activeHighCount--;
        self.inFlight.delete(key);
        self._drain();
      });
    };

    if (self._canStartNow(priority)) {
      run();
    } else {
      metrics.requests.queued++;
      run.__queuedAt = Date.now();
      self.queues[priority].push(run);
      self._drain();
    }

    return deferred.promise;
  };

  global.AIRPET_REQ_COORDINATOR = {
    PRIORITY: PRIORITY,
    create: function (opts) { return new RequestCoordinator(opts); },
    instance: new RequestCoordinator(),
    // Convenience methods
    enqueue: function (job) { return this.instance.enqueue(job); },
    cancelGroup: function (groupName) { return this.instance.cancelGroup(groupName); },
    setMaxPerKey: function (key, windowMs, max) { return this.instance.setMaxPerKey(key, windowMs, max); }
  };

  // Helper para inspecionar ganhos (p95) no console.
  metrics.getSummary = function () {
    var out = {
      requests: {
        totalEnqueued: metrics.requests.totalEnqueued,
        dedupeHits: metrics.requests.dedupeHits,
        queued: metrics.requests.queued,
        started: metrics.requests.started,
        finished: metrics.requests.finished,
        aborted: metrics.requests.aborted,
        rateLimited: metrics.requests.rateLimited
      },
      p95DurationsMs: {},
      p95QueueDelayMs: {},
      cache: metrics.cache || null
    };

    Object.keys(metrics.durationsMs || {}).forEach(function (ep) {
      out.p95DurationsMs[ep] = percentileMs(metrics.durationsMs[ep], 95);
    });
    Object.keys(metrics.queueDelaysMs || {}).forEach(function (ep) {
      out.p95QueueDelayMs[ep] = percentileMs(metrics.queueDelaysMs[ep], 95);
    });

    return out;
  };

})(window);

