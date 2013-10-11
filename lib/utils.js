"use strict";

function str2Regex(str){
  var rule = /^\/(.*)\/([igm]*)$/;
  var m = str.match(rule);
  return m && new RegExp(m[1], m[2]);
}

var regSubsti = /([^\\])?\{(\w+)\}/g;
/**
 * @method formatStr
 *
 * 格式化字符串模版
 *
 * 如果不希望被转义，在 `{` 前加反斜线 `\`
 *
 */
function substitude(tpl, obj) {
  return tpl.replace(regSubsti, function (p0, p1, p2) {
    return p2 in obj ? (p1 || '') + obj[p2] : p0;
  });
}

function merge(a, b) {
  for (var key in b) {
    a[key] = b[key];
  }
  return a;
}

function extend(a, b) {
  for (var key in b) {
    a[key] = b[key];
  }
}

function find(obj, fn) {
  var ret = [];
  for (var key in obj) {
    if (fn(obj[key])) {
      ret.push(obj[key]);
    }
  }
  return ret;
}

function remove(obj, fn) {
  var index = [];
  for (var key in obj) {
    if (fn(obj[key])) {
      index.push(key);
    }
  }
  for(var i in index) {
    obj.splice(i, 1);
  }
}

function defaults(a, b) {
  for (var key in b) {
    if (!(key in a)) {
      a[key] = b[key];
    }
  }
  return a;
}

function each(obj, fn) {
  if (Array.isArray(obj)) {
    obj.forEach(fn);
  } else {
    Object.keys(obj).forEach(function(key, i) {
      var item = obj[key];
      fn.call(item, item, key, i);
    });
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * get the filename of Function.caller
 */
function getCallerFile(level) {
  var orig = Error.prepareStackTrace;
  var orig_limit = Error.stackTraceLimit;
  Error.prepareStackTrace = function(_, stack){ return stack; };
  Error.stackTraceLimit = level + 1; // should add level of current function

  var stack = (new Error()).stack;

  Error.prepareStackTrace = orig;
  Error.stackTraceLimit = orig_limit;

  return stack[level].getFileName();
}

module.exports = {
  each: each,
  defaults: defaults,
  random: randomInt,
  extend: extend,
  merge: merge,
  find: find,
  remove: remove,
  getCallerFile: getCallerFile,
  substitude: substitude,
  regSubsti: regSubsti,
  str2Regex: str2Regex
};
