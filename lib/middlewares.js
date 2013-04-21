"use strict";

var error = require('debug')('webot:middlewares:error');

var Session = require('./session');
var Memstore = require('./memstore');


var middlewares = {};

/**
 * @method session 生成
 * @protected
 */
middlewares.session = function(options){
  options = options || {};

  var store = options.store || new Memstore();
  var prop = options.prop || 'webot_info';

  return function(req, res, next) {
    var info = req[prop];

    var end = res.end;
    res.end = function(data, encoding) {
      res.end = end;
      var sess = info.session;
      if (!sess) {
        return res.end(data, encoding);
      }
      sess.save(function(err) {
        if (err) {
          console.error(err.stack);
        }
        res.end(data, encoding);
      });
    };

    store.get(info.uid, function(err, s) {
      if (err) {
        error('get session failed: ', err);
      }
      info.session = new Session(info, s);
      info.sessionStore = store;
      next();
    });
  };
};

middlewares.watch = function(app, options) {
  options = options || {};

  var pass = function(req, res, next) { next(); };

  var path = options.path || '/';
  var verify = options.verify || pass;
  var prop = options.prop || 'webot_info';

  var parser = options.parser || function(req, res, next) {
    req[prop] = req.body;
    next();
  };

  var send = options.send || function(req, res) {
    res.json(res[prop]);
  };

  var self = this;

  app.get(path, verify);
  app.post(path, verify, parser, self.session({
    store: options.sessionStore,
    prop: prop,
  }), function(req, res, next) {
    self.reply(req[prop], function(err, info) {
      res[prop] = info;
      next();
    });
  }, send);
};

module.exports = exports = middlewares;
