(function () {
  'use strict';

  function toArray(listLike) {
    return Array.prototype.slice.call(listLike || []);
  }

  function getFocusable(container) {
    if (!container) return [];
    return toArray(
      container.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (el) {
      return !el.hidden && el.offsetParent !== null;
    });
  }

  function firstInteractive(container) {
    var candidates = getFocusable(container);
    return candidates.length ? candidates[0] : null;
  }

  function AirpetWizard(root, options) {
    if (!root) throw new Error('AirpetWizard precisa de um elemento root');
    this.root = root;
    this.options = options || {};
    this.steps = toArray(root.querySelectorAll('[data-wizard-step]'));
    this.totalSteps = this.steps.length;
    this.currentStep = 1;
    this.form = this.options.form || root.closest('form') || null;
    this.stepLabel = this.options.stepLabel || null;
    this.stepPercent = this.options.stepPercent || null;
    this.progressBar = this.options.progressBar || null;
    this.onBeforeNext = typeof this.options.onBeforeNext === 'function' ? this.options.onBeforeNext : null;
    this.onStepChange = typeof this.options.onStepChange === 'function' ? this.options.onStepChange : null;
    this.customValidator = typeof this.options.customValidator === 'function' ? this.options.customValidator : null;
    this.bindControls();
    this.goTo(1);
  }

  AirpetWizard.prototype.bindControls = function () {
    var self = this;
    this.root.addEventListener('click', function (event) {
      var nextBtn = event.target.closest('[data-wizard-next]');
      if (nextBtn) {
        event.preventDefault();
        self.next();
        return;
      }
      var prevBtn = event.target.closest('[data-wizard-prev]');
      if (prevBtn) {
        event.preventDefault();
        self.prev();
        return;
      }
      var gotoBtn = event.target.closest('[data-wizard-goto]');
      if (gotoBtn) {
        event.preventDefault();
        var targetStep = Number(gotoBtn.getAttribute('data-wizard-goto') || 1);
        self.goTo(targetStep);
      }
    });
  };

  AirpetWizard.prototype.updateProgress = function () {
    var pct = Math.max(1, Math.round((this.currentStep / this.totalSteps) * 100));
    if (this.stepLabel) this.stepLabel.textContent = 'Passo ' + this.currentStep + ' de ' + this.totalSteps;
    if (this.stepPercent) this.stepPercent.textContent = pct + '%';
    if (this.progressBar) this.progressBar.style.width = pct + '%';
  };

  AirpetWizard.prototype.updateVisibility = function () {
    var self = this;
    this.steps.forEach(function (stepEl, index) {
      var stepNo = index + 1;
      var active = stepNo === self.currentStep;
      stepEl.classList.toggle('hidden', !active);
      stepEl.setAttribute('aria-hidden', active ? 'false' : 'true');
      stepEl.setAttribute('aria-current', active ? 'step' : 'false');
    });
  };

  AirpetWizard.prototype.focusCurrentStep = function () {
    var current = this.steps[this.currentStep - 1];
    if (!current) return;
    var toFocus = firstInteractive(current);
    if (toFocus) toFocus.focus();
  };

  AirpetWizard.prototype.validateStep = function (stepNumber) {
    var current = this.steps[stepNumber - 1];
    if (!current) return true;
    var requiredFields = toArray(current.querySelectorAll('[required]'));
    for (var i = 0; i < requiredFields.length; i++) {
      var field = requiredFields[i];
      if (field.type === 'checkbox' && !field.checked) {
        field.focus();
        return false;
      }
      if (typeof field.value === 'string' && !field.value.trim()) {
        field.focus();
        return false;
      }
    }
    if (this.customValidator) return this.customValidator(stepNumber, current) !== false;
    return true;
  };

  AirpetWizard.prototype.goTo = function (stepNumber) {
    var parsed = Number(stepNumber || 1);
    if (parsed < 1) parsed = 1;
    if (parsed > this.totalSteps) parsed = this.totalSteps;
    this.currentStep = parsed;
    this.updateVisibility();
    this.updateProgress();
    this.focusCurrentStep();
    if (this.onStepChange) this.onStepChange(this.currentStep, this.steps[this.currentStep - 1]);
  };

  AirpetWizard.prototype.next = function () {
    if (!this.validateStep(this.currentStep)) return false;
    if (this.onBeforeNext && this.onBeforeNext(this.currentStep, this.steps[this.currentStep - 1]) === false) return false;
    if (this.currentStep >= this.totalSteps) return true;
    this.goTo(this.currentStep + 1);
    return true;
  };

  AirpetWizard.prototype.prev = function () {
    if (this.currentStep <= 1) return false;
    this.goTo(this.currentStep - 1);
    return true;
  };

  window.AirpetWizard = AirpetWizard;
})();
