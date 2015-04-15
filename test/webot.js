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

  var robot = webot.Webot(), robot2 = webot.Webot();

  function reply(info, callback) {
    if (typeof info === 'string') {
      info = { text: info };
    }
    robot.reply(info, callback);
  }

  describe('set', function() {

    var reply1 = ['你也好', '你好', '很高兴认识你'];

    it('should raise exception when no arguments', function() {
      var err;
      try { robot.set(); } catch (e) { err = e; }
      should.exist(err);
    });
    it('should set multiple rule', function() {
      robot.reset();
      robot.set({
        '你好':  function() {
          // 随机回复一句话
          return reply1;
        },
        '你是谁': '我是你的小天使呀'
      });
      robot.routes.should.have.lengthOf(2);
    });
    it('should handle list reply', function(done) {
      reply('你好', function(err, info) {
        reply1.should.include(info.reply);
        done();
      });
    });
    it('should handle function', function() {
      robot.set(function(info) {
        return info.text == 'func';
      }, function(info, next) {
        next(null, 'func' + info.text);
      });
      var rule = robot.routes.slice(-1)[0];
      rule.pattern.should.have.type('function');
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
    var filename = 'dialog.json';
    var full_filename = __dirname + '/' + filename;
    it('should load all', function() {
      robot.dialog(filename);
      should.exist(robot.get('dialog_haha_1'));
      should.exist(robot.get('dialog_haha_2'));
    });
    it('should pick one from list', function(done) {
      reply('haha_1', function(err, info) {
        require(full_filename)['haha_1'].should.include(info.reply);
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

  describe('loads', function() {
    it('should pass *args', function() {
      robot.loads('rules/a', 'rules/b');
      should.exist(robot.get('/^a$/'));
      should.exist(robot.get('rules/b'));
    });
    it('should pass Array args', function() {
      robot2.loads(['rules/a']);
    });
    it('should pass full path', function() {
      var fullpath = __dirname + '/rules/b';
      robot2.loads(fullpath);
      should.exist(robot2.get('rules/b'));
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

  describe('domain rule', function() {
    var info;

    before(function() {
      robot.domain('domain_1', function(info) {
        if (!info.my_user_id) {
          return 'please login first';
        }
        info._in_domain_1 = true;
      });
      robot.set({
        domain: 'domain_1',
        pattern: 'my profile',
        handler: function(info) {
          return 'user_id: ' + info.my_user_id;
        }
      });
      robot.set({
        domain: 'domain_1',
        pattern: 'my id',
        handler: function(info) {
          return info.my_user_id;
        }
      });
      robot.set({
        pattern: 'outside domain',
        handler: function(info) {
          return 'this is outside';
        }
      });
    });

    beforeEach(function() {
      info = webot.Info();
    });

    it('should exit from domain 1', function(done) {
      info.my_user_id = null;
      info.text = 'my profile';
      reply(info, function(err, info) {
        info.reply.should.include('please login');
        done();
      });
    });

    it('should run into domain A', function(done) {
      info.my_user_id = 'me';
      info.text = 'my profile';
      reply(info, function(err, info) {
        should.equal(info.reply, 'user_id: me');
        should.equal(info._in_domain_1, true);
        done();
      });
    });

    it('should run into domain B', function(done) {
      info.my_user_id = 'meme';
      info.text = 'my id';
      reply(info, function(err, info) {
        should.equal(info.reply, 'meme');
        should.equal(info._in_domain_1, true);
        done();
      });
    });


    it('should not run into domain', function(done) {
      info.my_user_id = 'me';
      info.text = 'domain_2';
      reply(info, function(err, info) {
        info.should.not.have.property('_in_domain_1');
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

  describe('reset', function() {
    it('should reset', function(done) {
      robot.reset();
      robot.routes.should.be.empty;
      robot.befores.should.be.empty;
      robot.afters.should.be.empty;
      robot.waits.should.be.empty;
      robot.domain_rules.should.be.empty;
      done();
    });

    it('set should work after reset', function(done) {
      robot.reset();
      robot.set(function(info) {
        return info.text == 'func';
      }, function(info, next) {
        next(null, 'func' + info.text);
      });
      var rule = robot.routes.slice(-1)[0];
      rule.pattern.should.have.type('function');
      rule.handler.should.have.lengthOf(2);
      done();
    });
  });

  describe('delete', function() {
    it('should delete', function(done) {
      robot.reset();
      robot.set('rule1', {
        pattern: 'hi',
        handler: function(info) {
          info.reply = 'hi';
        }
      });
      robot.set('rule2', {
        pattern: 'hi',
        handler: function(info) {
          info.reply = 'hi';
        }
      });
      robot.set('rule3', {
        pattern: 'hi',
        handler: function(info) {
          info.reply = 'hi';
        }
      });
      robot.delete('rule2');
      should.not.exist(robot.get('rule2'));
      robot.routes.should.have.lengthOf(2);
      done();
    });
  });

  describe('update', function() {
    it('should update', function(done) {
      robot.reset();
      robot.set('rule1', {
        pattern: 'hi',
        handler: function(info) {
          info.reply = 'hi';
        }
      });
      robot.update('rule1', {
        pattern: 'hello',
        handler: function(info) {
          info.reply = 'hello';
        }
      });
      var rule = robot.routes.slice(-1)[0];
      rule.pattern.toString().should.equal('/hello/');
      done();
    });
  });

});
