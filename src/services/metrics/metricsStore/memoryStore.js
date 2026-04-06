/**
 * Store em memória (testes ou METRICS_DRIVER=memory).
 */

let totalBytes = 0;
let totalObjects = 0;
let accessTotal = 0;
const meta = new Map();

async function adjustStorage(deltaBytes, deltaCount) {
  totalBytes = Math.max(0, totalBytes + (Number(deltaBytes) || 0));
  totalObjects = Math.max(0, totalObjects + (Number(deltaCount) || 0));
}

async function setStorageTotals(bytes, objects) {
  totalBytes = Math.max(0, Number(bytes) || 0);
  totalObjects = Math.max(0, Number(objects) || 0);
}

async function incrementAccessTotal() {
  accessTotal += 1;
  return accessTotal;
}

async function getStorageAggregate() {
  return { totalBytes, totalObjects, updatedAt: new Date() };
}

async function getAccessTotal() {
  return accessTotal;
}

async function getMeta(key) {
  const v = meta.get(key);
  return v || { text: null, time: null };
}

async function setMeta(key, { text = null, time = null } = {}) {
  const cur = meta.get(key) || {};
  meta.set(key, {
    text: text != null ? text : cur.text,
    time: time != null ? time : cur.time,
  });
}

module.exports = {
  adjustStorage,
  setStorageTotals,
  incrementAccessTotal,
  getStorageAggregate,
  getAccessTotal,
  getMeta,
  setMeta,
};
