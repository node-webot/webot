# node webot [![Build Status](https://api.travis-ci.org/node-webot/webot.png?branch=master)](https://travis-ci.org/node-webot/webot)

A web robot for node.js.

With simple rules based on RegExp and custom functions,
you can easily run a robot as web service.

## Quick Start

```javascript
var express = require('express');
var webot = require('webot');

var app = express();

webot.set('hi', "Hi, I'm Webot.");

webot.set('subscribe', {
  pattern: function(info) {
    return info.event === 'subscribe';
  },
  handler: function(info) {
    return 'Thank you for subscribe.';
  }
});

app.get('/webot', function(req, res, next) {
  var message = req.query.message;

  webot.reply({
    text: message, 
  }, function(err, info) {
    if (err) return res.json({ r: err });
    res.json({
      r: 0,
      reply: info.reply
    });
  });
});

```

# API Referrence

## Webot

### webot.set(pattern, handler, _[, replies]_)

Add new reply rule.

```javascript
webot.set(pattern, handler, replies)

// or 

webot.set({
  name: 'rule name',
  pattern: function(info) { ... },
  handler: function(info, next) {
  }
})
```

我们建议你给每条规则都命名，以方便规则之间互相调用。

```javascript
webot.set('rule A', {
  pattern: /ruleA/,
  handler: function() {
  },
});

// webot.get('rule A') 即可获得刚才定义的规则

// 可以省略第二个参数里的 pattern ,
// 则规则名会被转换为一个用于匹配的正则
webot.set('你好', function() {
  // 随机回复一句话
  return ['你也好', '你好', '很高兴认识你'];
});

// 更简单地
webot.set('你好', ['你也好', '你好', '很高兴认识你']);

// 如果 handler 是一个 object ，也会直接作为 reply 返回
webot.set('test music message', {
  type: 'music',
  url: 'http://example.com/a.mp3'
});
```

你甚至还可以直接传入一个 Object ，
其 key 为 pattern ， value 为 handler 
（只要里面不包括 'handler' 这个 key）：

```javascript
webot.set({
  '你好':  function() {
    // 随机回复一句话
    return ['你也好', '你好', '很高兴认识你'];
  },
  '你是谁': '我是你的小天使呀'
});
```

有关 `replies` 的使用，请参考 [rule.replies](#optionsreplies) 。

### webot.get(ruleName)

Get a rule based on its name. `ruleName` must be a string.

### webot.waitRule(name, [handler])

Set a wait rule for `info.wait` to use. Must provide a valid `name`.
If handler not presented, try get the wait rule with that name.

`等待规则` 即只在等待用户回复时才执行的规则。

### webot.beforeReply()

Add a preprocess rule. `rule.handler` will be called every time before checking reply rules.

### webot.afterReply()

Add a post-repy rule. `rule.handler` will be called every time after a reply is got.

### webot.dialog(file1, _[file2, ...]_)

增加对话规则

```javascript
webot.dialog({
  'hello': '哈哈哈',
  'hi': ['好吧', '你好']
});

// or
webot.dialog('./rules/foo.js', './rules/bar.js');
```

In `rules/foo.js`:

```javascript
module.exports = {
  'hello': '哈哈哈',
  'hi': ['好吧', '你好']
};
```

#### 使用YAML

你也可以在你的项目中 `require('js-yaml')` ，
采用简洁的 yaml 语法来定义纯文本的对话规则：

In `package.json`:
```javascript
   "dependencies": {
       ...
     "js-yaml": "~2.0.3"
       ...
   }
```

In your `app.js`:

```javascript
require('js-yaml');

webot.dialog(__dirname__ + './rules/abc.yaml');
```

In `rules/abc.yaml`:

```yaml
---
# 直接回复
hi: 'hi,I am robot'

# 随机回复一个
hello: 
  - 你好
  - fine
  - how are you

# 匹配组替换
/key (.*)/i: '你输入了: {1}, \{1}这样写就不会被替换'

# 也可以是一个rule定义；如果没有定义pattern，自动使用key
yaml:
  name: 'test_yaml_object'
  handler: '这是一个yaml的object配置'
```

### webot.watch(app, _[options]_)

Add serveral standard middlewares to an express app. Including:

- **options.verify**:  to verify request. Default: always pass.
- **options.parser**: to parse request post body. Default: use `req.body`.
- **options.send**: to send reply. Default: use `res.json`.
- **options.sessionStore**: the storage for webot sessions, just like express's cookieSession.
- **options.path**: where to watch. Default: "/".
- **options.prop**: `req` or `res`'s property name to attach parsed and replied data. Default: "webot_data".

The middleware layout would be:

```javascript
  app.get(path, verify);
  app.post(path, verify, parser, function(req, res, next) {
    webot.reply(req[prop], function(err, info) {
      res[prop] = info;
      next();
    });
  }, send);
```

## Rule(options)

使用 `webot.set` 和 `webot.wait` 等方法时，会自动新建一条 rule ，
rule 定义的具体可用参数如下：

### options.name

为规则命名，方便使用 `webot.get` 获取规则。

### options.pattern
 
匹配用户发送的消息的方法。如果为正则表达式和字符串，
则只在用户发送的时文本消息时才匹配。

所有支持的格式：
 
- {String}   如果是潜在的 RegExp （如 '/abc/igm' ），会被转为 RegExp，如果以 '#' 打头，则完全匹配，否则模糊匹配
- {RegExp}   仅匹配文本消息正则式，匹配到的捕获组会被赋值给 info.param
- {Function} 只接受一个参数 info ，返回布尔值，可用以处理特殊类型的消息
- {NULL}     为空则视为通过匹配

示例：

```javascript
// 匹配下列所有消息：
//
//    你是机器人吗
//    难道你是机器人？
//    你是不是机器人？
//    ...
//
webot.set('Blur match', {
  pattern: '是机器人',
  handler: '是的，我就是一名光荣的机器人'
});

// 当字符串 pattern 以 "=" 开头时，需要完全匹配
webot.set('Exact match', {
  pattern: '=a',
  handler: '只有回复「a」时才会看到本消息'
});

// 利用正则来匹配
webot.set('your name', {
  pattern: /^(?:my name is|i am|我(?:的名字)?(?:是|叫)?)\s*(.*)$/i,
  handler: '你好,{1}'
});

// 类正则的字符串会被还原为正则 
webot.set('/(good\s*)morning/i', '早上好，先生');

// 可以接受 function
webot.set('pattern as fn', {
  pattern: function(info){
    return info.param.eventKey === 'subscribe';
  },
  handler: '你好，欢迎关注我'
});

```

### options.handler

指定如何生成回复消息

当返回非真值(null/false)时继续执行下一个动作，否则返回值会被回复给用户。

支持的定义格式:

- {String}    直接返回字符串
- {Array}     从数组中随机取一个作为 handler
- {Object}    直接返回
- {Function}  执行函数获取返回值，第一个参数为消息请求的 info 对象

支持异步：

```javascript

webot.set('search_database', {
  description: 'Search a keyword from database',
  pattern: /^(?:s\s+)(.+)$/i,
  handler: function(info, next) {
    // assert(this.name == 'search_database');
    // 函数内的 this 变量即此规则

    // 执行一个异步操作..
    query_from_database(info.text, function(err, ret) {
      if (err) return next(500);
      return next(null, ret);
    });
  }
});
```

在函数执行过程中，如果设置 `info.ended = true` ，则不会再继续下一条规则。 

**注意**：`pattern` 并不支持异步，你可以把需要异步进行的 pattern 匹配
视为一个 `handler` 。此时，你只需在定义规则时省略钓 `pattern` 定义即可。

```javascript
webot.set('test', function(info, next) {
  var uid = info.user;
  User.findOne(uid, function(err, doc) {
    if (!doc) return next();
    return next(null, '欢迎，' + doc.name);
  });
});
```

### options.replies

指定如何**再次回复用户的回复**。即用户回复了根据当前规则回复的消息后，如何继续对话。
必须先配置 [session支持](#session-support)。

```javascript
webot.set('guess my sex', {
  pattern: /是男.还是女.|你.*男的女的/,
  handler: '你猜猜看呐',
  replies: {
    '/女|girl/i': '人家才不是女人呢',
    '/男|boy/i': '是的，我就是翩翩公子一枚',
    'both|不男不女': '你丫才不男不女呢',
    '不猜': '好的，再见',
    '/.*/': function(info) {
      // 在 replies 的 handler 里可以获得等待回复的重试次数参数
      if (info.rewaitCount < 2) {
        info.rewait();
        return '你到底还猜不猜嘛！';
      }
      return '看来你真的不想猜啊';
    },
  }
  
  // 也可以用一个函数搞定:
  // replies: function(info){
  //   return '嘻嘻，不告诉你'
  // }

  // 也可以是数组格式，每个元素为一条rule
  // replies: [{
  //   pattern: '/^g(irl)?\\??$/i',
  //   handler: '猜错'
  // },{
  //   pattern: '/^b(oy)?\\??$/i',
  //   handler: '猜对了'
  // },{
  //   pattern: 'both',
  //   handler: '对你无语...'
  // }]
});
```

## Info

Request and response in one place, with session support enabled.

### info.session

当你在你的 express 中间件中为 `info` 加入了 `session` 支持，即可使用等待操作的高级功能。

### info.wait(rule)

等待用户回复。并根据 `rule` 定义来回复用户。
`rule` 可以是一个 function 或 object。
用法与 `webot.set` 的参数类似。

### info.rewait()

重试上次等待操作。一般在 `replies` 的 handler 里调用。

以上两个方法均需要 session 支持。
具体用法请参看[示例](https://github.com/node-webot/webot-example)。

### info.err

Each time we got an error from `rule.handler`, `info.err` will be updated. The last error will always stay there.

## Session Support

TODO: 待完善

## 命令行工具

提供可执行文件 `webot` 用于发送测试消息。
使用 `npm` 安装 [webot-cli](https://github.com/node-webot/webot-cli)：

    npm install webot-cli -g

Have fun with wechat, and enjoy being a robot!

## LICENSE

(The MIT License)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
