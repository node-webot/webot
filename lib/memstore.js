/**
 * A simple version of connect memory store.
 * see: https://github.com/senchalabs/connect/blob/master/lib/middleware/session/memory.js
 */

var Memstore = module.exports = function Memstore() {
  this.sessions = {};
};

Memstore.prototype.get = function(sid, fn) {
  var self = this;
  process.nextTick(function() {
    fn(null, self.sessions[sid] || {});
  });
};

Memstore.prototype.set = function(sid, val, fn) {
  var self = this;
  process.nextTick(function() {
    self.sessions[sid] = val;
    fn && fn(null);
  });
};
Memstore.prototype.destroy = function(sid, fn) {
  var self = this;
  process.nextTick(function() {
    delete self.sessions[sid];
    fn && fn(null);
  });
};
