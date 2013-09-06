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

  describe('set', function() {
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

  describe('dialog', function() {
    var file = __dirname + '/dialog.json';
    it('should load all', function() {
      robot.dialog(file);
      should.exist(robot.get('dialog_haha_1'));
      should.exist(robot.get('dialog_haha_2'));
    });
    it('should pick one from list', function(done) {
      reply('haha_1', function(err, info) {
        require(file)['haha_1'].should.include(info.reply);
        done();
      });
    });
    it('should replace match', function(done) {
      reply('match ABC', function(err, info) {
        should.equal(info.reply, 'ABC');
        done();
      });
    });
    it('should replace match2', function(done) {
      reply('match2 ABC', function(err, info) {
        should.equal(info.reply, 'return ABC');
        done();
      });
    });
  });


  describe('get', function() {
    it('can get named rule', function() {
      should.exist(robot.get('named'));
    });
    it('should return undefined when nothing', function() {
      should.strictEqual(robot.get('nothing'), undefined);
    });
  });

  describe('wait', function() {
    var info, session;

    before(function() {
      session = {};
    });
    beforeEach(function() {
      info = new webot.Info();
      info.session = session;
    });

    it('should handle replies', function(done) {
      robot.set('dial', 'choose: 1. A, 2. B, 3. C', {
        '=1': 'A',
        '=2': 'B',
        '=3': 'C',
        '/.*/': function(info) {
          info.rewait();
          return 'wrong choice, please input one of 1/2/3';
        }
      });
      info.text = 'dial';
      reply(info, function(err, info) {
        info.reply.should.include('choose');
        done();
      });
    });
    it('should choose dial', function(done) {
      info.text = '1';
      reply(info, function(err, info) {
        should.equal(info.reply, 'A');
        done();
      });
    });
    it('could run again', function(done) {
      info.text = 'dial';
      reply(info, function(err, info) {
        info.reply.should.include('choose');
        done();
      });
    });
    it('should go into rewait', function(done) {
      info.text = 'not 1,2,3';
      reply(info, function(err, info) {
        info.reply.should.include('wrong choice');
        done();
      });
    });
    it('should do rewait', function(done) {
      info.text = '2';
      reply(info, function(err, info) {
        should.equal(info.reply, 'B');
        done();
      });
    });

    it('should allow waitRule function', function(done) {
      robot.set('go wait_1', function(info) {
        info.session.wait_1_data = 'me';
        info.wait('wait_1');
        return 'ok';
      });
      robot.waitRule('wait_1', function(info) {
        return 'waited ' + info.session.wait_1_data;
      });
      info.text = 'go wait_1';
      reply(info, function(err, info) {
        should.equal(info.reply, 'ok');
        done();
      });
    });

    it('should raise exception for wait rule name conflicts', function() {
      var err;
      try { robot.waitRule('wait_1', function(){ }); } catch (e) { err = e; }
      should.exist(err);
    });

    it('should do wait_1', function(done) {
      info.text = 'whatever';
      reply(info, function(err, info) {
        should.equal(info.reply, 'waited me');
        done();
      });
    });

    it('should pass waitRule as getter', function() {
      should.exist(robot.waitRule('wait_1'));
      // hidden reply rules
      should.exist(robot.waitRule('_reply_/dial/'));
    });

    it('should allow waitRule object', function(done) {
      robot.set('your sex', function(info) {
        info.wait('guess sex');
        return 'you guess!';
      });
      robot.waitRule('guess sex', {
        '=female': 'wrong',
        '=male': 'right',
        '/.*/': function(info) {
          info.rewait();
          return 'guess again';
        }
      });
      info.text = 'your sex';
      reply(info, function(err, info) {
        should.equal(info.reply, 'you guess!');
        done();
      });
    });

    it('should reply waitRule', function(done) {
      info.text = 'male';
      reply(info, function(err, info) {
        should.equal(info.reply, 'right');
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

});
