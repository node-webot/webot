"use strict";

var debug = require('debug');
var log = debug('webot:robot:log');
var warn = debug('webot:robot:warn');
var error = debug('webot:robot:error');

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

  this.routes = [];

  this._data_cache = {};
}

// backward compatibility
Webot.exec = Rule.exec;

/**
 * @method set 路由, 设定动作规则
 *
 * @param {Mixed} pattern 匹配规则
 *
 *  - 当入参个数只有一个时,该参数作为{@link Rule}或Rule的配置
 *  - 否者作为匹配规则,参见{@link Rule#pattern}
 *
 * @param {Mixed} handler   处理逻辑,参见{@link Rule#handler}
 * @param {Mixed} [replies] 下次回复动作,参见{@link Rule#replies}
 */
Webot.prototype.set = function(arg1, arg2, arg3){
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
      if (typeof arg1 === 'string' && typeof arg2 === 'object') {
        rule = arg2;
        rule.name = arg1;
        break;
      }
    default:
      rule.pattern = arg1;
      rule.handler = arg2;
      rule.replies = arg3;
  }

  rule = Rule.convert(rule);

  log('define route: [%s]', getRuleName(rule));

  // 添加路由
  this.routes = this.routes.concat(rule);

  return this;
};

/**
 * 获取已注册的动作
 * @param  {String} name  动作名
 * @return {Object/Array} 返回动作,如果入参为空,则返回全部动作.
 */
Webot.prototype.get = function(name){
  return this.gets(name)[0];
};
Webot.prototype.gets = function(name) {
  return name ? utils.find(this.routes, function(rule){
    return rule.name === name;
  }) : this.routes;
};

/**
 * @param  {String/Array} path 路径,必须是全路径.可以是路径数组
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
 * @param {Object/Info}   data    微信发来的消息 
 * @param {Function}      cb      回调函数, function(err,reply)
 *
 * @api public
 *
 */
Webot.prototype.reply = function(data, cb){
  var self = this;

  log('got req msg: %j', data);

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
    log('found waiter: %s', getRuleName(waiter));

    ruleList = [].concat(waiter).concat(self.routes);

    info.rewaitCount = info.session.rewait_count || 0;

    delete info.session.waiter;
    // 但把它存在另外的地方
    info.session.last_waited = waiter;
  } else {
    delete info.session.rewait_count;
  }

  self._reply(ruleList, info, cb);

  return self;
};

/**
 * Legacy API compatibility
 */
Webot.prototype.exec = function(info, rule, cb){
  return Rule(rule).exec(info, cb);
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
        //存在要求回复的动作
        if (rule.replies) {
          // replies can be dynamic, so need a safely convert
          info.wait(Rule.convert(rule.replies, rule));
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

/**
 * get the name of a rule / rules
 */
function getRuleName(rule){
  if(!rule) return '[NULL RULE]';
  return Array.isArray(rule) ? rule[0].name + '..' : rule.name;
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
