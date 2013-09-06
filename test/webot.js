var should = require('should');
var webot = require('../lib/webot');

var async = require('async');


describe('webot module', function() {
  it('should exports constructors', function() {
    webot.should.have.property('Webot');
    webot.should.have.property('Info');
    webot.should.have.property('Rule');
  });
  it('should be an ready to use instance', function() {
    webot.should.be.an.instanceof(webot.Webot);
  });
  it('should be newable', function() {
    (new webot.Webot()).should.be.an.instanceof(webot.Webot);
    webot.Webot().should.be.an.instanceof(webot.Webot);
  });
  it('should handle config', function() {
    webot.Webot({ keepBlank: false }).config.keepBlank.should.equal(false);
  });
});


describe('webot', function() {

  var robot = webot.Webot();

  function reply(info, callback) {
    if (typeof info === 'string') {
      info = { text: info };
    }
    robot.reply(info, callback);
  }

  describe('set rule', function() {
    it('should raise exception when no arguments', function() {
      var err;
      try { robot.set(); } catch (e) { err = e; }
      should.exist(err);
    });
    it('should handle function', function() {
      robot.set(function(info) {
        return info.text == 'func';
      }, function(info, next) {
        next(null, 'func' + info.text);
      });
      var rule = robot.routes.slice(-1)[0];
      rule.pattern.should.be.a('function');
      rule.handler.should.have.lengthOf(2);
    });
    it('should handle object', function() {
      var config = {
        pattern: '=strict', // strict equal
        handler: function(info) {
          return 'strict' + info.text;
        }
      }
      robot.set(config);
      var rule = robot.routes.slice(-1)[0];
      should.strictEqual(rule.handler, config.handler);
    });
    it('should allow custom name', function() {
      var config = {
        pattern: /named/,
        handler: function(info) {
          return 'named' + info.text;
        }
      };
      robot.set('named', config);
      var rule = robot.routes.slice(-1)[0];
      should.strictEqual(rule.name, 'named');
    });
  });


  describe('beforeReply', function() {

    it('should do before reply', function(done) {
      robot.set({
        pattern: 'test before',
        handler: function(info) {
          return info._flag + 'haha';
        }
      });
      robot.beforeReply(function(info){
        info._flag = 'cool';
      });
      reply('test before', function(err, info) {
        should.not.exist(err);
        should.equal(info.reply, 'coolhaha');
        done();
      });
    });
    it('should pass multi before reply rule', function(done) {
      robot.set({
        pattern: 'test multi before',
        handler: function(info) {
          return info._flag;
        }
      });
      robot.beforeReply(function(info){
        info._flag += 'cold';
      });
      reply('test multi before', function(err, info) {
        should.not.exist(err);
        should.equal(info.reply, 'coolcold');
        done();
      });
    });
  });

  describe('afterReply', function() {
    it('should do after reply', function(done) {
      robot.afterReply(function(info){
        info.reply += 'cool';
      });
      robot.set({
        pattern: 'test after',
        handler: function(info) {
          return 'haha';
        }
      });
      reply('test after', function(err, info) {
        should.not.exist(err);
        should.equal(info.reply, 'hahacool');
        done();
      });
    });
  });

  describe('reply', function() {
    it('should handle plain object', function(done) {
      robot.reply({ text: 'test' }, function(err, info) {
        should.not.exist(err);
        should.exist(info.reply);
        done();
      });
    });
    it('should handle Info request', function(done) {
      var req = webot.Info({ text: 'test' });
      reply(req, function(err, info) {
        should.not.exist(err);
        should.exist(info.reply);
        should.equal(req, info);
        done();
      });
    });
    it('should handle func', function(done) {
      reply('func', function(err, info) {
        info.reply.should.include('func');
        done();
      });
    });
    it('should pass strict equal', function(done) {
      async.map(['strict', 'not strict'], reply, function(err, results) {
        results[0].reply.should.include('strict');
        results[1].reply.should.not.include('strict');
        done();
      });
    });
  });


});
