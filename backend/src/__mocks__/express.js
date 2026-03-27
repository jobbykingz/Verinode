/**
 * Minimal express mock for Jest — no third-party package needed.
 * Implements Router() with route registration, sync handler lookup via _routes.
 */

function Router() {
  const _routes = []; // { method, path, handlers[] }

  function addRoute(method, path) {
    const handlers = Array.prototype.slice.call(arguments, 2);
    _routes.push({ method: method.toUpperCase(), path, handlers });
  }

  const router = {
    _routes,
    get:    function (path) { addRoute.apply(null, ['GET',    path].concat(Array.prototype.slice.call(arguments, 1))); return router; },
    post:   function (path) { addRoute.apply(null, ['POST',   path].concat(Array.prototype.slice.call(arguments, 1))); return router; },
    put:    function (path) { addRoute.apply(null, ['PUT',    path].concat(Array.prototype.slice.call(arguments, 1))); return router; },
    delete: function (path) { addRoute.apply(null, ['DELETE', path].concat(Array.prototype.slice.call(arguments, 1))); return router; },
    use:    function () { return router; },
  };

  return router;
}

const express = function () {
  const app = {
    use:    function () { return app; },
    get:    function () { return app; },
    post:   function () { return app; },
    put:    function () { return app; },
    delete: function () { return app; },
    listen: function (port, cb) { if (cb) cb(); return { close: function (cb) { if (cb) cb(); } }; },
    set:    function () { return app; },
  };
  return app;
};

express.Router = Router;
express.json   = function () { return function (req, res, next) { if (next) next(); }; };
express.static = function () { return function (req, res, next) { if (next) next(); }; };
express.urlencoded = function () { return function (req, res, next) { if (next) next(); }; };

module.exports = express;
