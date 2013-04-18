"use strict";

var log = require('debug')('webot:middlewares:log');
var warn = require('debug')('webot:middlewares:warn');
var error = require('debug')('webot:middlewares:error');

var utils = require('./utils');

var Info = require('./info');

var middlewares = {};

/**
 * @method session 生成
 * @protected
 */
middlewares.session = function(options){
  options = options || {};

  var store = options.store;

  return function(req, res, next) {
    var info = req.wx_data;

    var end = res.end;
    res.end = function(data, encoding) {
      res.end = end;
      var sess = info.session;
      if (!sess) return res.end(data, encoding);
      sess.save(sess.id, function(err) {
        if (err) console.error(err.stack);
        res.end(data, encoding);
      });
    };

    store.get(info.from, function(err, s) {
      info.session = new Session(info, s);
      error('get session failed: ', err);
      info.sessionStore = store;
      next();
    });
  };
};

module.exports = exports = middlewares;
