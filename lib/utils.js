"use strict";

function str2Regex(str){
  var rule = /^\/(.*)\/([igm]*)$/;
  var m = str.match(rule);
  return m && new RegExp(m[1], m[2]);
}

var regSubsti = /([^\\])\{(\w+)\}/g;
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
    return p2 in obj ? (p1 + obj[p2]) : p0;
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

module.exports = {
  each: each,
  defaults: defaults,
  random: randomInt,
  extend: extend,
  merge: merge,
  find: find,
  substitude: substitude,
  regSubsti: regSubsti,
  str2Regex: str2Regex
};
