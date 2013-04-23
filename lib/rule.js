"use strict";

var debug = require('debug');
var verbose = debug('webot:rule:verbose');
var warn = debug('webot:rule:warn');
var error = debug('webot:rule:error');

var utils = require('./utils');

/**
 * @class Rule
 *
 * 动作规则
 *
 * 执行流程: pattern -> handler -> register reply rule
 *
 * @constructor 动作规则
 * @param {Mixed}  cfg    Rule的配置
 */
function Rule(cfg, parent){
  if (cfg instanceof Rule) {
    return cfg;
  }
  if (!(this instanceof Rule)) {
    return new Rule(cfg, parent);
  }

  switch(typeof cfg) {
  case 'string':
    this.name = cfg;
    this.description = '直接返回: ' + cfg;
    this.handler = cfg;
    break;
  case 'function':
    this.description = cfg.description || '直接执行函数并返回';
    this.handler = cfg;
    break;
  case 'object':
    utils.extend(this, cfg);
  }

  var p = this.pattern;
  if (typeof p === 'string') {
    if (p in Rule.shorthands) {
      this.pattern = Rule.shorthands[p];
    } else {
      var reg = utils.str2Regex(p);
      if (reg) {
        this.pattern = reg;
      } else if (p[0] === '=') {
        this.pattern = p.slice(1);
      } else {
        this.pattern = new RegExp(p);
      }
    }
  }

  if (!this.name) {
    var n = this.pattern || this.handler;
    this.name = typeof n === 'function' ? (n.name || 'annonymous_fn') : n.toString(); 
  }

  if (parent) {
    this.parent = parent;
  }

  return this;
}

var yep = /^(是|yes|yep|yeah|Y|阔以|可以|要得|好|需?要|OK|恩|嗯|找|搜|搞起)[啊的吧嘛诶啦唉哎\!\.。]*$/i;
var nope = /^(不(是|需?要|必|用|需|行|可以)?了?|no?|nope|不好|否|算了)[啊的吧嘛诶啦唉哎\!\.。]*$/i;
/**
 * @property {Object} 常用 pattern 的缩写
 */
Rule.shorthands = {
  Y: yep,
  N: nope
};

/**
 * 把rule的cfg转换为标准格式
 *
 * @param  {Rule} cfg    参见动作的构造函数
 *
 * 支持的格式:
 *
 * - {String/Function/Object} 参见动作的构造函数
 * - {Array} 每个元素都是动作的配置,遍历生成动作数组
 * - {Object} 还支持这种方式,生成动作数组: (注意: 因为是Object,所以没有执行顺序)
 *
 *       @example
 *       {
 *         '/^g(irl)?\\??$/i': '猜错',
 *         'boy': function(info, rule, next){
 *           return next(null, '猜对了')
 *         },
 *         'both': '对你无语...'
 *       }
 *
 *
 * @return {Array}         rule数组
 * @method convert  返回Rule数组
 * @static
 */
Rule.convert = function(cfg){
  if (cfg instanceof Rule) {
    return cfg;
  }

  switch(typeof cfg) {
  case 'string':
  case 'function':
    // will return as reply redirectly when exec
    return [new Rule(cfg)];
    break;
  case 'object':
    if (Array.isArray(cfg)) {
      return cfg.map(function(item){
        return new Rule(item);
      });
    }
    // with handler defined.
    if ('handler' in cfg) {
      return [new Rule(cfg)];
    }
    break;
  default:
    return [];
  }

  var result = [];
  utils.each(cfg, function(item, key){
    result.push(new Rule({ pattern: key, handler: item }));
  });
  return result;
};

/**
 * test rule pattern against some request info
 */
Rule.prototype.test = function(info){
  var rule = this;

  var p = rule.pattern;

  if (info === null) {
    warn('info is null');
    return false;
  }

  if (!p && p !== false) {
    return true;
  }

  // call pattern is it's a function
  if (typeof p === 'function') {
    return p.call(rule, info);
  }

  // 非函数, 则仅对文本消息支持正则式匹配
  if (info.type === 'text' && info.text !== null) {
    if (p instanceof RegExp) {
      var m = info.text.match(p);
      verbose('mathing against %s: %s', p, m);
      if (m) {
        info.param = info.param || {};
        utils.extend(info.param, m);
        return true;
      }
      return false;
    } else {
      return info.text === p;
    }
  }

  error('[%s] has an unsupported pattern.', rule.name);
  return false;
};


/**
 * 执行动作,返回回复消息.
 *
 * @method exec
 * @param {Object}   info      微信发来的消息
 *
 * 转换后的handler:
 *
 * - NULL: 跳过,执行下一条rule
 * - String: 直接返回字符串
 * - Array: 随机返回数组中的一个元素
 * - Function: 执行函数并返回(视fn的参数签名个数,可以通过直接返回或回调的方式)
 *
 * @param {Function} cb        回调函数
 * @param {Error}    cb.err    错误信息
 * @param {Boolean}  cb.result 回复消息
 *
 * - String: 回复文本消息
 * - Array:  回复图文消息,子元素格式参见 {@link Info#reply}
 * - Null:   执行下一个动作
 *
 * @static
 */
Rule.prototype.exec = function(info, cb) {
  var rule = this;

  verbose('executing rule [%s]..', rule.name);

  var fn = rule.handler;
  
  // 为空则跳过
  if (!fn && fn !== 0) {
    warn('[%s] handler not defined.', rule.name);
    return cb();
  }

  // 为数组时会随机挑一个
  if (Array.isArray(fn) && fn.length >= 1) {
    verbose('handler is an array, pick one');
    fn = fn[utils.random(0, fn.length - 1)];
  }

  switch(typeof fn) {
  case 'string':
    verbose('handler is string: [%s]', fn);
    if (info.param) {
      fn = utils.substitude(fn, info.param);
    }
    return cb(null, fn);
    break;
  case 'function':
    verbose('handler is a function with length %d', fn.length);

    // 只定义了一个参数时直接调用
    if (fn.length < 2) {
      // 当返回falsie值时会执行下一个 rule
      return cb(null, fn.call(rule, info));
    }
    return fn.call(rule, info, cb);
    break;
  case 'object':
    return cb(null, fn);
    break;
  }

  error('Invalid Handler!');
  return cb();
};

module.exports = exports = Rule;
