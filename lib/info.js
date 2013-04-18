"use strict";

var debug = require('debug');
var log = debug('webot:info:log');
var verbose = debug('webot:info:verbose');
var warn = debug('webot:info:warn');
var error = debug('webot:info:error');

/**
 * @param {Object}  props
 */
function Info(props){
  if (props instanceof Info) return props;

  if (!(this instanceof Info)) return new Info(props);

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

/**
 * @property {Object} 解析后的原始JSON
 */
Info.prototype.originJSON = null;

/**
 * @property {XMLElement} 原始XML
 */
Info.prototype.originXML = null;

/**
* @method wait 标记消息为需要等待操作
*/
Info.prototype.wait = function(rule) {
  return this.webot.wait(this.user, rule);
};
Info.prototype.rewait = function(rule) {
  return this.webot.rewait(this.user, rule);
};

/**
* @method data 为用户存储数据，优先调用绑定的 session
*/
Info.prototype.data = function(key, val) {
  var args = [].slice.call(arguments);

  args.unshift(this.session || this.user);

  var webot = this.webot;
  var ret = webot.data.apply(webot, args);
  if (ret === webot) return this;
  return ret;
};

module.exports = exports = Info;
