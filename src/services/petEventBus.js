/**
 * petEventBus.js — Event bus em memória para atualizações em tempo real do perfil do pet
 *
 * Emite eventos via Server-Sent Events (SSE) para clientes conectados.
 * Cada pet tem um canal identificado por pet_id.
 *
 * Tipos de evento emitidos:
 *   nfc_scan      — tag NFC escaneada (inclui localização e timestamp)
 *   status_change — pet marcado como perdido ou encontrado
 *   follow        — novo seguidor
 *
 * Arquitetura:
 *   - In-memory em processo único (sem Redis). Para múltiplas instâncias,
 *     substitua o Map por um Redis pub/sub com o mesmo contrato de interface.
 *   - Cada conexão SSE é registrada em petSubscribers[petId][].
 *   - Limpeza automática: ao desconectar, o response é removido do Map.
 *   - Heartbeat a cada 25s para manter a conexão viva (proxy/Cloudflare).
 *
 * Limites de segurança:
 *   - MAX_SUBS_PER_PET: evita memory leak se um pet viralizar.
 *   - TTL de conexão: após 10 minutos a conexão é encerrada graciosamente.
 */

const { EventEmitter } = require('events');

const MAX_SUBS_PER_PET = 200;
const CONNECTION_TTL_MS = 10 * 60 * 1000; // 10 minutos
const HEARTBEAT_INTERVAL_MS = 25 * 1000;  // 25 segundos

class PetEventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(0);
    /** @type {Map<string, Set<{res: import('express').Response, timer: NodeJS.Timeout, hb: NodeJS.Timeout}>>} */
    this._subscribers = new Map();
  }

  /**
   * Registra um response SSE para o pet.
   * @param {string} petId
   * @param {import('express').Response} res
   */
  subscribe(petId, res) {
    const key = String(petId);
    if (!this._subscribers.has(key)) this._subscribers.set(key, new Set());
    const subs = this._subscribers.get(key);

    if (subs.size >= MAX_SUBS_PER_PET) {
      res.end();
      return;
    }

    // Heartbeat para manter conexão viva
    const hb = setInterval(() => {
      try { res.write(':heartbeat\n\n'); } catch (_) { this._removeSub(key, entry); }
    }, HEARTBEAT_INTERVAL_MS);

    // TTL de conexão
    const timer = setTimeout(() => {
      try { res.write('event: close\ndata: {}\n\n'); res.end(); } catch (_) {}
      this._removeSub(key, entry);
    }, CONNECTION_TTL_MS);

    const entry = { res, timer, hb };
    subs.add(entry);

    res.on('close', () => { this._removeSub(key, entry); });
    res.on('error', () => { this._removeSub(key, entry); });
  }

  _removeSub(key, entry) {
    clearInterval(entry.hb);
    clearTimeout(entry.timer);
    const subs = this._subscribers.get(key);
    if (subs) {
      subs.delete(entry);
      if (subs.size === 0) this._subscribers.delete(key);
    }
  }

  /**
   * Emite um evento SSE para todos os clientes conectados ao pet.
   * @param {string} petId
   * @param {string} type
   * @param {object} data
   */
  emit(petId, type, data = {}) {
    const key = String(petId);
    const subs = this._subscribers.get(key);
    if (!subs || subs.size === 0) return;
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const entry of subs) {
      try { entry.res.write(payload); } catch (_) { this._removeSub(key, entry); }
    }
  }

  /**
   * Retorna quantas conexões ativas existem para métricas.
   */
  stats() {
    let total = 0;
    for (const subs of this._subscribers.values()) total += subs.size;
    return { pets: this._subscribers.size, connections: total };
  }
}

// Singleton de processo
const bus = new PetEventBus();
module.exports = bus;
