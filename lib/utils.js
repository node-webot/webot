"use strict";

function str2Regex(str){
  var rule = /^\/(.*)\/([igm]*)$/;
  var m = str.match(rule);
  return m && new RegExp(m[1], m[2]);
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

function defaults(a, b) {
  for (var key in b) {
    if (!(key in a)) {
      a[key] = b[key];
    }
  }
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

module.exports = {
  each: each,
  defaults: defaults,
  extend: extend,
  merge: merge,
  str2Regex: str2Regex
};
