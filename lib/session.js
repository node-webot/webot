// basicly a copy of https://github.com/senchalabs/connect/blob/master/lib/middleware/session/session.js

var utils = require('./utils');

/**
* @param {Info} req
* @param {Object} data
*/
function Session(req, data) {
  Object.defineProperty(this, 'req', { value: req });
  Object.defineProperty(this, 'info', { value: req });
  Object.defineProperty(this, 'id', { value: req.uid });
  if (data && 'object' === typeof data) {
    utils.merge(this, data);
  }
}

/**
 * Save the session data with optional callback `fn(err)`.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.save = function(fn) {
  this.req.sessionStore.set(this.id, this, fn || function(){});
  return this;
};


Session.prototype.reload = function(fn){
  var req = this.req,
    store = this.req.sessionStore;
  store.get(this.id, function(err, sess){
    if (err) {
      return fn(err);
    }
    if (!sess) {
      return fn(new Error('failed to load session'));
    }
    req.session = new Session(req, sess);
    fn();
  });
  return this;
};

/**
 * Destroy `this` session.
 *
 * @param {Function} fn
 * @return {Session} for chaining
 * @api public
 */

Session.prototype.destroy = function(fn){
  delete this.req.session;
  this.req.sessionStore.destroy(this.id, fn);
  return this;
};

module.exports = Session;
