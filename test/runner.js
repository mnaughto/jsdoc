/*global env: true, jasmine: true */
/*
 * Test Steps:
 * 1. Get Jasmine
 * 2. Get the test options
 * 3. Get the list of directories to run tests from
 * 4. Run Jasmine on each directory
 */
var fs = require('jsdoc/fs');
var logger = require('jsdoc/util/logger');
var path = require('path');
var runtime = require('jsdoc/util/runtime');

fs.existsSync = fs.existsSync || path.existsSync;

require( path.join(runtime.dirname, 'test/jasmine-jsdoc') );

var hasOwnProp = Object.prototype.hasOwnProperty;

var opts = {
    verbose: runtime.opts.verbose || false,
    showColors: runtime.opts.nocolor === true ? false : true
};

var extensions = 'js';
var match = runtime.opts.match || '.';
if (match instanceof Array) {
    match = match.join("|");
}
opts.matcher = new RegExp("(" + match + ")\\.(" + extensions + ")$", 'i');

var specFolders = [
    path.join(runtime.dirname, 'test/specs'),
    path.join(runtime.dirname, 'plugins/test/specs')
];

var failedCount = 0;
var index = 0;

var testsCompleteCallback;
var onComplete;

var runNextFolder = module.exports = function(callback) {
    testsCompleteCallback = testsCompleteCallback || callback;

    // silence the logger while we run the tests
    logger.setLevel(logger.LEVELS.SILENT);

    if (index < specFolders.length) {
        jasmine.executeSpecsInFolder(specFolders[index], onComplete, opts);
    }
    else {
        process.nextTick(function() {
            testsCompleteCallback(failedCount);
        });
    }
};

onComplete = function(runner, log) {
    if (runner.results().failedCount !== 0) {
        failedCount += runner.results().failedCount;
    }

    index++;
    runNextFolder();
};
