"use strict";

var debug = require('debug');
var verbose = debug('webot:robot:verbose');
var log = debug('webot:robot:log');
var warn = debug('webot:robot:warn');
var error = debug('webot:robot:error');

var EventEmitter = require('events').EventEmitter;

var utils = require('./utils');

var Info = require('./info');
var Rule = require('./rule');

/**
 * @class Webot
 */
function Webot(config){
  config = config || {};
  if (!(this instanceof Webot)) return new Webot(config);
  this.config = utils.defaults(config, Webot.defaultConfig);

  this.pres = [];
  this.routes = [];
  this.waits = {};
}
Webot.prototype.__proto__ = EventEmitter.prototype;

/**
 * Provide a convinient API for rule/waitRule definations.
 */
Webot.prototype._rule = function(arg1, arg2, arg3){
  var args = arguments;
  var rule = {};
  switch(args.length) {
    case 0:
      return this;
    case 1:
      // 支持纯匿名模式
      // webot.set(function(info) {});
      if (typeof arg1 === 'function') {
        rule.handler = arg1;
        rule.pattern = null;
      } else {
        rule = arg1;
      }
      break;
    case 2:
      // 支持提前命名
      // webot.set('name of rule', {
      //   pattern: /abc/,
      //   handler: function() {
      //   },
      // });
      if (typeof arg1 === 'string' && typeof arg2 === 'object' && arg2.handler) {
        rule = arg2;
        rule.name = arg1;
        break;
      }
    default:
      rule.pattern = arg1;
      rule.handler = arg2;
      rule.replies = arg3;
  }

  return Rule.convert(rule);
};
Webot.prototype.set = function(){
  var rule = this._rule.apply(this, arguments);
  log('define route: [%s]', getRuleName(rule));
  // 添加路由
  this.routes = this.routes.concat(rule);
  return this;
};
Webot.prototype.use = function(fn) {
  if (typeof fn !== 'function') throw new Error('middleware must be a function');
  this.pres = this.pres.concat(this._rule({
    handler: fn
  }));
  return this;
};
/**
 * set or get a wait rule.
 */
Webot.prototype.waitRule = function(rule_name, rule_fn) {
  var rule;
  if (arguments.length === 1) {
    rule = this.waits[rule_name] || this.get(rule_name);
    if (!rule && rule_name.indexOf('_reply_') === 0) {
      var rname = rule_name.replace('_reply_', '', 1);
      var rule = this.get(rname);
      if (rule.replies) {
        rule = this.waits[rule_name] = Rule.convert(rule.replies, rule);
      }
    }
    return rule;
  }
  if (typeof rule_fn === 'function') {
    arguments[1] = { handler: rule_fn };
  }
  var rule = this._rule.apply(this, arguments);
  log('define wait rule: [%s]', getRuleName(rule));
  // 添加路由
  this.waits[rule_name] = rule;
  return this;
};

Webot.prototype.get = function(name){
  return this.gets(name)[0] || this.waits[name] || this.gets(name, this.pres)[0];
};
Webot.prototype.gets = function(name, from) {
  from = from || this.routes;
  return name ? utils.find(from, function(rule){
    return rule.name === name;
  }) : from;
};

/**
 * @param  {String/Array} path 路径, 必须是全路径.可以是路径数组
 */
Webot.prototype.dialog = function(path){
  var self = this;
  var args = path;

  if (!Array.isArray(args)) {
    args = [].slice.call(arguments);
  }

  args.forEach(function(p){
    if (typeof p === 'string') {
      log('require dialog file: %s', p);
      p = require(p);
    }

    utils.each(p, function(item, key){
      var rule;
      if (typeof item === 'string' || Array.isArray(item)) {
        // p is an array of [(a, b), (a, b)...]
        if (typeof key === 'number' && item.length == 2) {
          key = item[0];
          item = item[1];
        }
        rule = {
          name: 'dialog_' + key,
          pattern: key,
          handler: item
        };
      } else {
        rule = item;
        rule.name = rule.name || 'dialog_' + key;
        rule.pattern = rule.pattern || key;
      }
      self.set(rule);
    });
  });
  return this;
};

/**
 * @method reply          根据用户请求回复消息，包含处理等待请求的逻辑
 *
 *
 */
Webot.prototype.reply = function(data, cb){
  var self = this;

  verbose('got req msg: ', data);

  // convert a object to Info instance.
  var info = Info(data);
  info.webot = self;

  if (!self.config.keepBlank && info.text) {
    info.text = info.text.trim();
  }

  // 要执行的rule列表
  var ruleList = self.routes;

  // 如果用户有 waiting rule 待执行
  var waiter = info.session && info.session.waiter;
  if (waiter) {
    log('found waiter: %s', waiter);

    delete info.session.waiter;
    // 但把它存在另外的地方
    info.session.last_waited = waiter;

    waiter = self.waitRule(waiter);
    ruleList = [].concat(waiter).concat(self.routes);

    info.rewaitCount = info.session.rewait_count || 0;
  } else if (info.session) {
    delete info.session.rewait_count;
  }

  ruleList = this.pres.concat(ruleList);

  self._reply(ruleList, info, cb);

  return self;
};

/**
 * 按照既定规则回复消息内容
 *
 * @protected
 */
Webot.prototype._reply = function(ruleList, info, cb) {
  var self = this;

  var rule;

  function end(err) {
    var reply = info.reply;

    if (!reply) err = err || 500;

    if (err) {
      // convert error to human readable
      reply = reply || self.code2reply(err);

      error('webot.reply error: %s', err);
      error('current rule: %s', getRuleName(rule));
    }

    info.reply = reply;

    if (self.config.beforeSend) {
      self.config.beforeSend.call(self, err, info, function(err) {
        cb(err, info);
      });
      return;
    }

    cb(err, info);
  }

  function tick(i) {
    rule = ruleList[i];

    if (!rule) return end(404);
    if (!rule.test(info)) return tick(i+1);

    log('Rule [%s] matched', rule.name);

    info.ruleIndex = i;
    info.currentRule = rule;

    rule.exec(info, function(err, result) {
      if (result || info.ended) {
        // 存在要求回复的规则
        if (rule.replies) {
          info.wait('_reply_' + rule.name);
        }
        if (!result) {
          error('request ended with no good reply.', info);
        }

        info.reply = result;
        return end(err);
      }
      tick(i+1);
    });
  }

  tick(0);
};

Webot.defaultConfig = {
  beforeSend: null,
  keepBlank: true,
};

Webot.prototype.codeReplies = {
  '204': '你的消息已经收到，若未即时回复，还望海涵',
  '403': '鉴权失败,你的Token不正确',
  '404': '听不懂你说的: ',
  '500': '服务器临时出了一点问题，您稍后再来好吗'
};

/**
 * 根据status code 获取友好提示消息
 * @param  {Error} code  错误码,
 * @return {String}      提示消息
 * @protected
 */
Webot.prototype.code2reply = function(code){
  code = String(code);
  return this.codeReplies[code] || code;
};

// backward compatibility
Webot.exec = Rule.exec;
/**
 * Legacy API compatibility
 */
Webot.prototype.exec = function(info, rule, cb){
  return Rule(rule).exec(info, cb);
};

/**
 * get the name of a rule / rules
 */
function getRuleName(rule){
  if(!rule) return '[NULL RULE]';
  return Array.isArray(rule) ? rule[0].name + (rule.length > 1 ? '..' : '') : rule.name;
}


/**
 * Export a default webot
 */
module.exports = new Webot();

module.exports.Rule = Rule;
module.exports.Info = Info;
module.exports.Webot = module.exports.WeBot = Webot;

// export express middlewares
utils.extend(Webot.prototype, require('./middlewares'));
