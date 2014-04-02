"use strict";

var PATH = require('path');
var debug = require('debug');
var verbose = debug('webot:robot:verbose');
var log = debug('webot:robot:log');
var error = debug('webot:robot:error');
var util = require('util');

var EventEmitter = require('events').EventEmitter;

var utils = require('./utils');

var Info = require('./info');
var Rule = require('./rule');

/**
 * @class Webot
 */
function Webot(config){
  config = config || {};
  if (!(this instanceof Webot) || this === module.exports) {
    return new Webot(config);
  }

  this.config = utils.defaults(config, Webot.defaultConfig);

  this.befores = [];
  this.afters = [];
  this.routes = [];
  this.waits = {};
  this.domain_rules = {}; // rules specified by domain
}

util.inherits(Webot, EventEmitter);

/**
 * Parse rule definations.
 */
Webot.prototype._rule = function(arg1, arg2, arg3){
  var self = this;
  var args = arguments;
  var rule = {};
  switch(args.length) {
  case 0:
    throw new Error('Invalid rule');
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

/**
 * Add a reply rule.
 */
Webot.prototype.set = function(){
  var rule = this._rule.apply(this, arguments);
  log('define route: [%s]', getRuleName(rule));
  this.routes = this.routes.concat(rule);
  return this;
};

/**
 * Preprocess on a request message
 */
Webot.prototype.beforeReply = Webot.prototype.use = function() {
  var rule = this._rule.apply(this, arguments);
  rule.forEach(function(item) {
    item._is_before_rule = true;
  });
  this.befores = this.befores.concat(rule);
  return this;
};

/**
 * Add domain specified rules
 */
Webot.prototype.domain = function(domain) {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 1);
  var rules = self._rule.apply(self, args);

  if (!(domain in self.domain_rules)) {
    self.domain_rules[domain] = [];
  }
  self.domain_rules[domain] = self.domain_rules[domain].concat(rules);

  return this;
};

/**
 * Post-process of a reply message
 *
 * Example:
 *
 * webto.afterReply(function convert_fanjian(err, info, next) {
 * });
 */
Webot.prototype.afterReply = function() {
  this.afters = this.afters.concat(this._rule.apply(this, arguments));
  return this;
};

/**
 * get a wait rule
 */
Webot.prototype.getWaitRule = function(rule_name) {
  var rule = this.waits[rule_name] || this.get(rule_name);
  if (!rule && rule_name.indexOf('_reply_') === 0) {
    var rname = rule_name.replace('_reply_', '', 1);
    rule = this.get(rname);
    if (rule.replies) {
      rule = this.waits[rule_name] = Rule.convert(rule.replies, rule);
    }
  }
  return rule;
};

/**
 * set or get a wait rule.
 *
 * wait rule must be named.
 */
Webot.prototype.waitRule = function(rule_name, rule) {
  if (arguments.length === 1) {
    return this.getWaitRule(rule_name);
  }

  log('define wait rule: [%s]', rule_name);

  if (rule_name in this.waits) {
    throw new Error('Wait rule name conflict');
  }

  if (typeof rule !== 'object') {
    rule = { handler: rule };
  }
  rule.name = rule_name;

  this.waits[rule_name] = this._rule(rule);

  return this;
};

/**
 * Get a route or wait rule
 */
Webot.prototype.get = function(name){
  return this.gets(name)[0] || this.waits[name];
};
Webot.prototype.gets = function(name, from) {
  from = from || this.routes;
  return name ? utils.find(from, function(rule){
    return rule.name === name;
  }) : from;
};

Webot.prototype.update = function() {
  var newRule = this._rule.apply(this, arguments);
  utils.each(this.routes, function(rule) {
    utils.each(newRule, function(r) {
      if (rule.name === r.name) {
        utils.merge(rule, r);
      }
    });
  });
  return this;
}

Webot.prototype.delete = function(name) {
  utils.remove(this.routes, function(rule) {
    return rule.name === name;
  });
}

/**
 * @param  {String/Array} filepath, could be a list of files.
 */
Webot.prototype.dialog = function(args){
  var self = this;

  if (!Array.isArray(args)) {
    args = Array.prototype.slice.call(arguments);
  }

  var dir = getCallerDir();

  args.forEach(function(p){
    if (typeof p === 'string') {
      p = PATH.resolve(dir, p);
      log('require dialog file: %s', p);
      p = require(p);
    }
    utils.each(p, function(item, key){
      var rule;
      if (typeof item === 'string' || Array.isArray(item)) {
        // p is an array of [(a, b), (a, b)...]
        if (typeof key === 'number' && item.length === 2) {
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
 * Load a list of nodejs modules as webot rules.
 *
 * Usage:
 *
 *     webot.loads('rules/a', 'rules/b', ..);
 *
 * `rule/a` and `rule/b` are module ids relative to the filepath
 * where this function is being called.
 *
 *
 * In `./rules/a.js` and `./rules/b.js`:
 *
 *     module.exports = function(webot) {
 *     };
 *
 * or:
 *
 *    module.exports = {
 *      pattern: ...
 *      handler: ...
 *    };
 *
 */
Webot.prototype.loads = function(mods){
  if (!Array.isArray(mods)) {
    mods = Array.prototype.slice.call(arguments);
  }

  var self = this;
  var dir = getCallerDir();

  mods.forEach(function(name) {
    var mod = require(PATH.resolve(dir, name));
    if (typeof mod == 'function') {
      mod(self);
    } else {
      mod.name = mod.name || name;
      self.set(mod);
    }
  });
  return self;
};

/**
 * Empty all rules.
 */
Webot.prototype.reset = function() {
  this.befores = [];
  this.afters = [];
  this.routes = [];
  this.waits = {};
  this.domain_rules = {};
  return this;
}

/**
 * Reply to a message.
 *
 * @param {object/Info} data
 * @param {function} cb
 * @api public
 */
Webot.prototype.reply = function(data, cb){
  var self = this;

  // convert a object to Info instance.
  var info = Info(data);
  info.webot = self;

  verbose('got req msg: ', {
    text: info.text,
    type: info.type,
    param: info.param
  });

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

  ruleList = this.befores.concat(ruleList);

  self._reply(ruleList, info, cb);

  return self;
};

/**
 * Reply a message according to specified rule list.
 */
Webot.prototype._reply = function(ruleList, info, cb) {
  var self = this;
  var breakOnError = self.config.breakOnError;

  var isAfter = false;

  function end(err, reply) {
    if (reply == undefined && !err) {
      err = 500;
    }
    if (err) {
      error('webot.reply error: %s', err);
      info.err = err;
      // convert error to human readable
      reply = reply || self.code2reply(err);
    }

    if (Array.isArray(reply) && typeof reply[0] === 'string') {
      reply = reply[utils.random(0, reply.length - 1)];
    }

    info.reply = reply || info.reply || '';

    // Run after reply rules.
    if (!isAfter) {
      ruleList = self.afters;
      isAfter = true;
      tick(0);
      return;
    }

    cb(err, info);
  }

  function tick(i, domain) {
    var rule = ruleList[i];

    if (!rule) {
      return end(isAfter ? null : 404, info.reply);
    }

    info.ruleIndex = i;
    info.currentRule = rule;

    if (rule._is_before_rule && rule.domain !== domain) {
      return tick(i + 1, domain);
    }
    if (!rule.test(info)) {
      verbose('Rule [%s] skipped..', rule.name);
      return tick(i + 1, domain);
    }
    if (rule.domain && !domain) {
      var _domain = rule.domain;
      log('Matched rule in domain "%s"', _domain);
      // insert domain befores to the begining
      ruleList = self.domain_rules[_domain].concat(ruleList.slice(i));
      // run from start again
      return tick(0, _domain);
    }
    if (isAfter) {
      rule.exec(info, function(err, result) {
        if (err && breakOnError) {
          return end(err, result);
        }
        tick(i + 1);
      });
      return;
    }

    log('Rule [%s] matched', rule.name);

    rule.exec(info, function(err, result) {
      if (err && breakOnError) {
        return end(err, result);
      }
      if (result || info.ended) {
        // 存在要求回复的规则
        if (rule.replies) {
          info.wait('_reply_' + rule.name);
        }
        if (!result) {
          error('request ended with no good reply.');
        }
        return end(err, result);
      }
      tick(i + 1, domain);
    });
  }

  tick(0);
};

Webot.defaultConfig = {
  keepBlank: true,
  breakOnError: true,
};

Webot.prototype.codeReplies = {
  '204': 'OK, got that.',
  '403': 'You have no permission to do this.',
  '404': 'Don\'t know what you are saying.',
  '500': 'Something is broken...'
};

/**
 * 根据status code 获取友好提示消息
 * @param  {Error} code  错误码,
 * @return {String}      提示消息
 * @protected
 */
Webot.prototype.code2reply = function(code){
  code = String(code);
  return code in this.codeReplies ? this.codeReplies[code] : code;
};

// backward compatibility
Webot.exec = Rule.exec;
/**
 * Legacy API compatibility
 */
Webot.prototype.exec = function(info, rule, cb){
  return Rule(rule).exec(info, cb);
};

// export express middlewares
utils.extend(Webot.prototype, require('./middlewares'));


/**
 * get the name of a rule / rules
 */
function getRuleName(rule){
  if (!rule) {
    return '[NULL RULE]';
  }
  return Array.isArray(rule) ? rule[0].name + (rule.length > 1 ? '..' : '') : rule.name;
}

/**
 * get dirname of caller function
 */
function getCallerDir(){
  var file = utils.getCallerFile(3);
  return PATH.dirname(file);
}


/**
 * Export a default webot
 */
module.exports = new Webot();

module.exports.Rule = Rule;
module.exports.Info = Info;
module.exports.Webot = module.exports.WeBot = Webot;
