/**
 * Manual mock for ioredis used in tests.
 * Provides an in-memory store that behaves like Redis.
 */

const store = new Map();
const expiries = new Map();

const mockRedis = {
  get: jest.fn(async (key) => store.get(key) ?? null),
  set: jest.fn(async (key, value, ...args) => {
    store.set(key, value);
    if (args[0] === 'EX' && args[1]) expiries.set(key, args[1]);
    return 'OK';
  }),
  setex: jest.fn(async (key, ttl, value) => {
    store.set(key, value);
    expiries.set(key, ttl);
    return 'OK';
  }),
  del: jest.fn(async (...keys) => {
    const flat = keys.flat();
    flat.forEach((k) => { store.delete(k); expiries.delete(k); });
    return flat.length;
  }),
  exists: jest.fn(async (key) => (store.has(key) ? 1 : 0)),
  keys: jest.fn(async (pattern) => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return [...store.keys()].filter((k) => regex.test(k));
  }),
  incr: jest.fn(async (key) => {
    const cur = parseInt(store.get(key) || '0', 10);
    store.set(key, String(cur + 1));
    return cur + 1;
  }),
  expire: jest.fn(async () => 1),
  ttl: jest.fn(async (key) => (expiries.get(key) ?? -1)),
  ping: jest.fn(async () => 'PONG'),
  quit: jest.fn(async () => 'OK'),
  flushall: jest.fn(async () => { store.clear(); expiries.clear(); return 'OK'; }),
  on: jest.fn(),
  // Expose store for test assertions if needed
  _store: store,
  _clear: () => { store.clear(); expiries.clear(); },
};

module.exports = jest.fn(() => mockRedis);
module.exports.default = module.exports;
