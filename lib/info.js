"use strict";

var debug = require('debug');
var log = debug('webot:info:log');

var utils = require('./utils');
var Rule = require('./rule');

/**
 * @param {Object}  props
 */
function Info(props){
  if (props instanceof Info) {
    return props;
  }
  if (!(this instanceof Info)) {
    return new Info(props);
  }
  utils.extend(this, props);
}

/**
 * @property {Webot}
 */
Info.prototype.webot = null;

/**
 * @property {Object}
 */
Info.prototype.session = null;

Object.defineProperty(Info.prototype, 'sessionId', {
  get: function() {
    return this.session && this.session.id || this.uid;
  }
});

/**
 * Check request info type
 */
Info.prototype.is = function(type) {
  return this.type === type;
};

/**
* @method wait 标记消息为需要等待操作，需要 session 支持
*/
Info.prototype.wait = function(rule) {
  var self = this;
  if (rule) {
    if (rule instanceof Rule) {
      rule = rule.name;
    }
    if (typeof rule !== 'string') {
      throw new Error('Invalid wait rule name');
    }
    log('add wait rule [%s] for user %s', rule, self.uid);
    self.session.waiter = rule;
  }
  return self;
};

Info.prototype.rewait = function() {
  var sess = this.session;
  var c = sess.rewait_count || 0;
  sess.rewait_count = c + 1;
  log('rewait rule %s', sess.last_waited);
  this.wait(sess.last_waited);
};

Info.prototype.resolve = function() {
  var sess = this.session;
  delete sess.rewait_count;
  delete sess.waiter;
  delete sess.last_waited;
};

module.exports = exports = Info;
