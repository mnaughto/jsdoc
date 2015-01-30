var fs = require('fs');
var path = require('path');
var runtime = require('./util/runtime');

// allow this to throw--something is really wrong if we can't read our own package file
var info = JSON.parse( fs.readFileSync(path.join(runtime.dirname, 'package.json'), 'utf8') );

exports.number = info.version;
exports.revision = new Date( parseInt(info.revision, 10) ).toUTCString();