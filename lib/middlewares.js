"use strict";

var error = require('debug')('webot:middlewares:error');


var middlewares = {};

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
  app.post(path, verify, parser, function(req, res, next) {
    self.reply(req[prop], function(err, info) {
      res[prop] = info;
      next();
    });
  }, send);
};

module.exports = exports = middlewares;
