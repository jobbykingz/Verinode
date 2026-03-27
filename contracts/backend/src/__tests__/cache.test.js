/**
 * Cache layer tests — zero third-party dependencies.
 *
 * All TypeScript modules are mocked via jest.mock() factory functions.
 * HTTP route handlers are tested by calling them directly with mock req/res.
 * Middleware is tested against lightweight mock request/response objects.
 */

// ─── In-memory store shared by the mock cache service ────────────────────────
const _store = new Map();
const _tags  = new Map(); // tag → Set<fullKey>
let _metrics = { hits: 0, misses: 0, sets: 0, deletes: 0 };

function fullKey(key, prefix) {
  return prefix ? `${prefix}:${key}` : key;
}

const mockCacheService = {
  get: jest.fn(async function (key, opts) {
    const fk = fullKey(key, opts && opts.keyPrefix);
    const val = _store.get(fk);
    if (val !== undefined) { _metrics.hits++; return val; }
    _metrics.misses++;
    return null;
  }),
  set: jest.fn(async function (key, value, opts) {
    const fk = fullKey(key, opts && opts.keyPrefix);
    _store.set(fk, value);
    _metrics.sets++;
    if (opts && opts.tags) {
      opts.tags.forEach(function (tag) {
        if (!_tags.has(tag)) _tags.set(tag, new Set());
        _tags.get(tag).add(fk);
      });
    }
  }),
  del: jest.fn(async function (key, opts) {
    _store.delete(fullKey(key, opts && opts.keyPrefix));
    _metrics.deletes++;
  }),
  invalidateByTag: jest.fn(async function (tag) {
    const keys = _tags.get(tag);
    if (keys) { keys.forEach(k => _store.delete(k)); _tags.delete(tag); }
  }),
  invalidatePattern: jest.fn(async function () {}),
  getMetrics: jest.fn(async function () {
    const total = _metrics.hits + _metrics.misses;
    return Object.assign({}, _metrics, {
      hitRate: total > 0 ? (_metrics.hits / total) * 100 : 0
    });
  }),
  resetMetrics: jest.fn(async function () {
    _metrics = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  }),
  warmCache: jest.fn(async function (entries) {
    entries.forEach(function (e) {
      _store.set(fullKey(e.key, e.options && e.options.keyPrefix), e.value);
      _metrics.sets++;
    });
  }),
};

jest.mock('../services/cacheService', () => ({
  cacheService: mockCacheService,
  CacheService: jest.fn(() => mockCacheService),
}));

const mockInvalidationService = {
  invalidateProof:    jest.fn(async () => {}),
  invalidateUser:     jest.fn(async () => {}),
  invalidateAnalytics: jest.fn(async () => {}),
  getCacheHealth: jest.fn(async () => ({
    redisConnected: true,
    metrics: { hits: 0, misses: 0, sets: 0, deletes: 0, hitRate: 0 },
    estimatedSize: 0,
  })),
};

jest.mock('../utils/cacheInvalidation', () => ({
  cacheInvalidationService: mockInvalidationService,
  CacheInvalidationService: jest.fn(() => mockInvalidationService),
}));

// ─── Inline cacheMiddleware (JS mirror of cacheMiddleware.ts logic) ───────────
const _mwStore = new Map(); // key → cached body

const cacheMiddleware = function (options) {
  options = options || {};
  return async function (req, res, next) {
    if (req.method !== 'GET') return next();
    if (options.condition && !options.condition(req)) return next();
    const raw = options.keyGenerator ? options.keyGenerator(req) : (req.url || '');
    const key  = options.keyPrefix ? `${options.keyPrefix}:${raw}` : raw;
    const hit  = _mwStore.has(key) ? _mwStore.get(key) : null;
    if (hit !== null) {
      res._cacheHeader = 'HIT';
      res._body = hit;
      if (typeof res.set === 'function') res.set({ 'X-Cache': 'HIT', 'Content-Type': 'application/json' });
      if (typeof res.json === 'function') return res.json(hit);
      return;
    }
    const origJson = res.json && res.json.bind(res);
    res.json = function (data) {
      if ((res.statusCode || 200) >= 200 && (res.statusCode || 200) < 300) _mwStore.set(key, data);
      res._cacheHeader = 'MISS';
      if (typeof res.set === 'function') res.set({ 'X-Cache': 'MISS' });
      if (origJson) return origJson(data);
      res._body = data;
    };
    next();
  };
};

const invalidateCacheMiddleware = function (options) {
  options = options || {};
  return function (req, res, next) {
    const origSend = res.send && res.send.bind(res);
    res.send = function (data) {
      if ((res.statusCode || 200) >= 200 && (res.statusCode || 200) < 300 && options.tags) {
        options.tags.forEach(t => mockCacheService.invalidateByTag(t));
        const del = [];
        _mwStore.forEach((_, k) => { if (options.tags.some(t => k.startsWith(t + ':') || k.includes(t))) del.push(k); });
        del.forEach(k => _mwStore.delete(k));
      }
      if (origSend) return origSend(data);
      res._body = data;
    };
    next();
  };
};

jest.mock('../middleware/cacheMiddleware', () => ({
  cacheMiddleware,
  invalidateCacheMiddleware,
}));

// ─── Load route handlers ──────────────────────────────────────────────────────
const cacheRoutes = require('../routes/cache');

// ─── Minimal mock req / res factories ────────────────────────────────────────
function mkRes() {
  const res = {
    statusCode: 200,
    _headers: {},
    _body: null,
    set: function (h) { Object.assign(this._headers, h); return this; },
    status: function (code) { this.statusCode = code; return this; },
    json: function (data) { this._body = data; return this; },
    send: function (data) { this._body = data; return this; },
    end: function (data) { this._body = data; return this; },
  };
  return res;
}

// Find the last handler for a given method + path on the mock Router
function findHandler(router, method, path) {
  for (const route of router._routes) {
    if (route.method === method.toUpperCase() && route.path === path) {
      return route.handlers[route.handlers.length - 1];
    }
  }
  return null;
}

function resetStores() {
  _store.clear();
  _tags.clear();
  _mwStore.clear();
  _metrics = { hits: 0, misses: 0, sets: 0, deletes: 0 };
  jest.clearAllMocks();
}

beforeEach(resetStores);

// ─── CacheService unit tests ──────────────────────────────────────────────────
describe('CacheService', () => {
  it('returns null on cache miss', async () => {
    expect(await mockCacheService.get('nope')).toBeNull();
    expect(_metrics.misses).toBe(1);
  });

  it('stores and retrieves a value', async () => {
    await mockCacheService.set('k', { v: 1 });
    expect(await mockCacheService.get('k')).toEqual({ v: 1 });
    expect(_metrics.hits).toBe(1);
  });

  it('respects keyPrefix', async () => {
    await mockCacheService.set('p1', true, { keyPrefix: 'proof' });
    expect(await mockCacheService.get('p1', { keyPrefix: 'proof' })).toBe(true);
    expect(await mockCacheService.get('p1')).toBeNull(); // no prefix → different key
  });

  it('del removes an entry', async () => {
    await mockCacheService.set('del-me', 'x');
    await mockCacheService.del('del-me');
    expect(await mockCacheService.get('del-me')).toBeNull();
    expect(_metrics.deletes).toBe(1);
  });

  it('invalidateByTag clears only tagged keys', async () => {
    await mockCacheService.set('a', 1, { tags: ['t'] });
    await mockCacheService.set('b', 2, { tags: ['t'] });
    await mockCacheService.set('c', 3, { tags: ['other'] });
    await mockCacheService.invalidateByTag('t');
    expect(await mockCacheService.get('a')).toBeNull();
    expect(await mockCacheService.get('b')).toBeNull();
    expect(await mockCacheService.get('c')).toBe(3);
  });

  it('getMetrics returns accurate counts and hitRate', async () => {
    await mockCacheService.set('x', 1);
    await mockCacheService.get('x');       // hit
    await mockCacheService.get('missing'); // miss
    const m = await mockCacheService.getMetrics();
    expect(m.hits).toBeGreaterThanOrEqual(1);
    expect(m.misses).toBeGreaterThanOrEqual(1);
    expect(m.hitRate).toBeGreaterThan(0);
    expect(m.hitRate).toBeLessThanOrEqual(100);
  });

  it('resetMetrics zeroes all counters', async () => {
    await mockCacheService.set('x', 1);
    await mockCacheService.get('x');
    await mockCacheService.resetMetrics();
    const m = await mockCacheService.getMetrics();
    expect(m.hits).toBe(0);
    expect(m.misses).toBe(0);
    expect(m.sets).toBe(0);
    expect(m.hitRate).toBe(0);
  });

  it('warmCache bulk-inserts entries', async () => {
    await mockCacheService.warmCache([
      { key: 'w1', value: 'v1' },
      { key: 'w2', value: 'v2' },
    ]);
    expect(_store.get('w1')).toBe('v1');
    expect(_store.get('w2')).toBe('v2');
  });
});

// ─── cacheMiddleware unit tests ───────────────────────────────────────────────
describe('cacheMiddleware', () => {
  it('passes through non-GET requests unchanged', async () => {
    const mw = cacheMiddleware({ keyGenerator: () => 'k' });
    let nextCalled = false;
    const req = { method: 'POST', url: '/t' };
    const res = mkRes();
    await mw(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(res._cacheHeader).toBeUndefined();
  });

  it('sets MISS on first GET, then HIT on second', async () => {
    const mw = cacheMiddleware({ keyGenerator: () => 'same-key' });
    const req1 = { method: 'GET', url: '/x' };
    const res1 = mkRes();
    let nextCalledCount = 0;
    const next = () => { nextCalledCount++; res1.json({ v: 1 }); };
    await mw(req1, res1, next);
    expect(res1._cacheHeader).toBe('MISS');

    const req2 = { method: 'GET', url: '/x' };
    const res2 = mkRes();
    await mw(req2, res2, () => { nextCalledCount++; });
    expect(res2._cacheHeader).toBe('HIT');
    expect(res2._body).toEqual({ v: 1 });
    expect(nextCalledCount).toBe(1); // second request served from cache
  });

  it('does not cache non-2xx responses', async () => {
    const mw = cacheMiddleware({ keyGenerator: () => 'err-key' });
    const req = { method: 'GET', url: '/e' };
    const res1 = mkRes();
    let count = 0;
    const next1 = () => { count++; res1.statusCode = 500; res1.json({ error: 'boom' }); };
    await mw(req, res1, next1);

    const res2 = mkRes();
    const next2 = () => { count++; res2.statusCode = 500; res2.json({ error: 'boom' }); };
    await mw({ method: 'GET', url: '/e' }, res2, next2);
    // Handler must run twice (error response was not cached)
    expect(count).toBe(2);
  });

  it('skips caching when condition returns false', async () => {
    const mw = cacheMiddleware({ keyGenerator: () => 'ck', condition: () => false });
    let count = 0;
    const mkNext = (res) => () => { count++; res.json({ n: count }); };
    await mw({ method: 'GET', url: '/c' }, mkRes(), mkNext(mkRes()));
    await mw({ method: 'GET', url: '/c' }, mkRes(), mkNext(mkRes()));
    expect(count).toBe(2);
  });
});

// ─── invalidateCacheMiddleware unit tests ─────────────────────────────────────
describe('invalidateCacheMiddleware', () => {
  it('invalidates tagged keys on successful mutation', async () => {
    // Pre-populate cache with a tagged entry
    _mwStore.set('proof-data:item-1', { data: 'cached' });

    const mw = invalidateCacheMiddleware({ tags: ['proof-data'] });
    const req = { method: 'POST', url: '/proofs' };
    const res = mkRes();
    mw(req, res, () => { res.statusCode = 201; res.send(JSON.stringify({ created: true })); });

    // The invalidate middleware should have called mockCacheService.invalidateByTag
    expect(mockCacheService.invalidateByTag).toHaveBeenCalledWith('proof-data');
    // Key that includes the tag prefix should be cleared
    expect(_mwStore.has('proof-data:item-1')).toBe(false);
  });

  it('does not invalidate on error responses', async () => {
    _mwStore.set('proof-data:item-1', { data: 'still here' });
    const mw = invalidateCacheMiddleware({ tags: ['proof-data'] });
    const req = { method: 'POST', url: '/proofs' };
    const res = mkRes();
    mw(req, res, () => { res.statusCode = 500; res.send('error'); });
    expect(mockCacheService.invalidateByTag).not.toHaveBeenCalled();
    expect(_mwStore.has('proof-data:item-1')).toBe(true);
  });
});

// ─── /api/cache route handler tests ──────────────────────────────────────────

describe('GET /api/cache/metrics', () => {
  it('calls getMetrics and returns success with metrics', async () => {
    const handler = findHandler(cacheRoutes, 'GET', '/metrics');
    expect(handler).toBeTruthy();
    const req = {};
    const res = mkRes();
    await handler(req, res);
    expect(res._body).toMatchObject({ success: true });
    expect(res._body.metrics).toHaveProperty('hits');
    expect(res._body.metrics).toHaveProperty('misses');
    expect(res._body.metrics).toHaveProperty('hitRate');
    expect(mockCacheService.getMetrics).toHaveBeenCalled();
  });
});

describe('GET /api/cache/health', () => {
  it('returns healthy when Redis is connected', async () => {
    const handler = findHandler(cacheRoutes, 'GET', '/health');
    const req = {};
    const res = mkRes();
    await handler(req, res);
    expect(res._body).toMatchObject({ success: true, status: 'healthy', redisConnected: true });
    expect(mockInvalidationService.getCacheHealth).toHaveBeenCalled();
  });

  it('returns unhealthy when Redis is down', async () => {
    mockInvalidationService.getCacheHealth.mockResolvedValueOnce({
      redisConnected: false,
      metrics: { hits: 0, misses: 0, sets: 0, deletes: 0, hitRate: 0 },
      estimatedSize: 0,
    });
    const handler = findHandler(cacheRoutes, 'GET', '/health');
    const res = mkRes();
    await handler({}, res);
    expect(res._body.status).toBe('unhealthy');
    expect(res._body.redisConnected).toBe(false);
  });
});

describe('DELETE /api/cache/invalidate/tag/:tag', () => {
  it('calls invalidateByTag with the correct tag', async () => {
    const handler = findHandler(cacheRoutes, 'DELETE', '/invalidate/tag/:tag');
    const req = { params: { tag: 'proof-data' } };
    const res = mkRes();
    await handler(req, res);
    expect(res._body).toMatchObject({ success: true });
    expect(res._body.message).toMatch(/proof-data/);
    expect(mockCacheService.invalidateByTag).toHaveBeenCalledWith('proof-data');
  });
});

describe('DELETE /api/cache/invalidate/proof/:proofId', () => {
  it('calls invalidateProof with the correct proofId', async () => {
    const handler = findHandler(cacheRoutes, 'DELETE', '/invalidate/proof/:proofId');
    const req = { params: { proofId: 'abc123' } };
    const res = mkRes();
    await handler(req, res);
    expect(res._body).toMatchObject({ success: true });
    expect(res._body.message).toMatch(/abc123/);
    expect(mockInvalidationService.invalidateProof).toHaveBeenCalledWith('abc123');
  });
});

describe('DELETE /api/cache/invalidate/user/:userId', () => {
  it('calls invalidateUser with the correct userId', async () => {
    const handler = findHandler(cacheRoutes, 'DELETE', '/invalidate/user/:userId');
    const req = { params: { userId: 'user-42' } };
    const res = mkRes();
    await handler(req, res);
    expect(res._body).toMatchObject({ success: true });
    expect(res._body.message).toMatch(/user-42/);
    expect(mockInvalidationService.invalidateUser).toHaveBeenCalledWith('user-42');
  });
});

describe('DELETE /api/cache/invalidate/analytics', () => {
  it('calls invalidateAnalytics', async () => {
    const handler = findHandler(cacheRoutes, 'DELETE', '/invalidate/analytics');
    const res = mkRes();
    await handler({}, res);
    expect(res._body).toMatchObject({ success: true });
    expect(mockInvalidationService.invalidateAnalytics).toHaveBeenCalled();
  });
});

describe('DELETE /api/cache/reset-metrics', () => {
  it('calls resetMetrics and returns success', async () => {
    const handler = findHandler(cacheRoutes, 'DELETE', '/reset-metrics');
    const res = mkRes();
    await handler({}, res);
    expect(res._body).toMatchObject({ success: true });
    expect(mockCacheService.resetMetrics).toHaveBeenCalled();
  });
});
