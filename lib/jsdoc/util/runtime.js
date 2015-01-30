/*global env, java */
/**
 * Helper functions to enable JSDoc to run on multiple JavaScript runtimes.
 *
 * @module jsdoc/util/runtime
 * @private
 */
'use strict';

var os = require('os');
var stripJsonComments = require('strip-json-comments');
var Scanner = require('../src/scanner').Scanner;
var scanner = new Scanner();

// These strings represent directory names; do not modify them!
/** @private */
var RHINO = exports.RHINO = 'rhino';
/** @private */
var NODE = exports.NODE = 'node';

/**
 * The JavaScript runtime that is executing JSDoc:
 *
 * + `module:jsdoc/util/runtime~RHINO`: Mozilla Rhino.
 * + `module:jsdoc/util/runtime~NODE`: Node.js.
 *
 * @private
 */
var runtime = (function() {
    if (global.Packages && typeof global.Packages === 'object' &&
        Object.prototype.toString.call(global.Packages) === '[object JavaPackage]') {
        return RHINO;
    } else if (require && require.main && module) {
        return NODE;
    } else {
        // unknown runtime
        throw new Error('Unable to identify the current JavaScript runtime.');
    }
})();

function readPackageJson(filepath) {
    var fs = require('jsdoc/fs');

    try {
        return stripJsonComments( fs.readFileSync(filepath, 'utf8') );
    }
    catch (e) {
        logger.error('Unable to read the package file "%s"', filepath);
        return null;
    }
}

function buildSourceList(runtime) {
    var fs = require('jsdoc/fs');
    var Readme = require('jsdoc/readme');

    var packageJson;
    var readmeHtml;
    var sourceFile;
    var sourceFiles = runtime.opts._ ? runtime.opts._.slice(0) : [];

    if (runtime.conf.source && runtime.conf.source.include) {
        sourceFiles = sourceFiles.concat(runtime.conf.source.include);
    }

    // load the user-specified package/README files, if any
    if (runtime.opts.package) {
        packageJson = readPackageJson(runtime.opts.package);
    }
    if (runtime.opts.readme) {
        readmeHtml = new Readme(runtime.opts.readme).html;
    }

    // source files named `package.json` or `README.md` get special treatment, unless the user
    // explicitly specified a package and/or README file
    for (var i = 0, l = sourceFiles.length; i < l; i++) {
        sourceFile = sourceFiles[i];

        if ( !runtime.opts.package && /\bpackage\.json$/i.test(sourceFile) ) {
            packageJson = readPackageJson(sourceFile);
            sourceFiles.splice(i--, 1);
        }

        if ( !runtime.opts.readme && /(\bREADME|\.md)$/i.test(sourceFile) ) {
            readmeHtml = new Readme(sourceFile).html;
            sourceFiles.splice(i--, 1);
        }
    }

    runtime.opts.packageJson = packageJson;
    runtime.opts.readme = readmeHtml;

    return sourceFiles;
}

function initializeRhino(self, args) {
    // the JSDoc dirname is the main module URI, minus the filename, converted to a path
    var uriParts = require.main.uri.split('/');
    uriParts.pop();

    self.dirname = String( new java.io.File(new java.net.URI(uriParts.join('/'))) );
    self.pwd = String( java.lang.System.getenv().get('PWD') );
    self.args = args;

    require(self.dirname + '/rhino/rhino-shim.js');
}

function initializeNode(self, args) {
    var fs = require('fs');
    var path = require('path');

    var jsdocPath = args[0];
    var pwd = args[1];

    // resolve the path if it's a symlink
    if ( fs.statSync(jsdocPath).isSymbolicLink() ) {
        jsdocPath = path.resolve( path.dirname(jsdocPath), fs.readlinkSync(jsdocPath) );
    }

    self.dirname = jsdocPath;
    self.pwd = pwd;
    self.args = process.argv.slice(2);

}

var Runtime = function(runtime){
    this.runtime = runtime;
    this.opts = {};
    this.args = [];
    this.conf = {};
    this.dirname = '.';
    this.pwd = null;
    this.opts = {};
    this.sourceFiles = [];    
}

Runtime.prototype = {
    initialize: function(args){
        switch (this.runtime) {
            case RHINO:
                initializeRhino(this, args);
                break;
            case NODE:
                initializeNode(this, args);
                break;
            default:
                throw new Error('Cannot initialize the unknown JavaScript runtime "' + runtime + '"!');
        }
    },

    loadSourceFiles: function(){
        var Filter = require('jsdoc/src/filter').Filter;

        var filter;

        this.opts._ = buildSourceList();

        // are there any files to scan and parse?
        if (this.conf.source && this.opts._.length) {
            filter = new Filter(this.conf.source);

            this.sourceFiles = scanner.scan(this.opts._, (this.opts.recurse ? 10 : undefined),
                filter);
        }

        return this.sourceFiles;
    },

    /**
     * Check whether Mozilla Rhino is running JSDoc.
     * @return {boolean} Set to `true` if the current runtime is Mozilla Rhino.
     */
    isRhino: function(){
        return this.runtime === RHINO;
    },

    /**
     * Check whether Node.js is running JSDoc.
     * @return {boolean} Set to `true` if the current runtime is Node.js.
     */
    isNode: function(){
        return this.runtime === NODE;
    },

    /**
     * Retrieve the identifier for the current JavaScript runtime.
     *
     * @private
     * @return {string} The runtime identifier.
     */
    getRuntime: function(){
        return this.runtime;
    },

    /**
     * Parse the arguments into an opts member variable. May throw an exception if parse fails. 
     * 
     * @return {Object} The parsed options. The value is also available as the `opts` member variable.
     */
    parseOptions: function(){
        var args = require('jsdoc/opts/args');
        var files = this.opts._ || [];
        this.opts = args.parse(this.args);
        this.opts._ = files;
        return this.opts;
    },

    /**
     * Get the require path for the runtime-specific implementation of a module.
     *
     * @param {string} partialPath - The partial path to the module. Use the same format as when calling
     * `require()`.
     * @return {object} The require path for the runtime-specific implementation of the module.
     */
    getModulePath: function(partialPath) {
        var path = require('path');

        return path.join(this.dirname, this.runtime, partialPath);
    }
};

module.exports = new Runtime(runtime);