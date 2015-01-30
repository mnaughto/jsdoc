/*global java */
/*eslint no-process-exit:0 */
/**
 * Helper methods for running JSDoc on the command line.
 *
 * A few critical notes for anyone who works on this module:
 *
 * + The module should really export an instance of `cli`, and `props` should be properties of a
 * `cli` instance. However, Rhino interpreted `this` as a reference to `global` within the
 * prototype's methods, so we couldn't do that.
 * + On Rhino, for unknown reasons, the `jsdoc/fs` and `jsdoc/path` modules can fail in some cases
 * when they are required by this module. You may need to use `fs` and `path` instead.
 *
 * @private
 */
module.exports = (function() {
'use strict';

var logger = require('jsdoc/util/logger');
var stripJsonComments = require('strip-json-comments');
var Scanner = require('./lib/jsdoc/src/scanner').Scanner;
var scanner = new Scanner();
var Parser = require('./lib/jsdoc/src/parser');
var parser;
var timer = {};
var runtime = require('./lib/jsdoc/util/runtime');

var hasOwnProp = Object.prototype.hasOwnProperty;

var props = {
    docs: [],
    packageJson: null,
    shouldExitWithError: false,
    tmpdir: null
};

var FATAL_ERROR_MESSAGE = 'Exiting JSDoc because an error occurred. See the previous log ' +
    'messages for details.';
var cli = {};

// TODO: docs
cli.loadConfig = function() {
    var _ = require('underscore');
    var args = require('jsdoc/opts/args');
    var Config = require('jsdoc/config');
    var fs = require('jsdoc/fs');
    var path = require('jsdoc/path');

    var confPath;
    var isFile;

    var defaultOpts = {
        destination: './out/',
        encoding: 'utf8'
    };

    try {
        runtime.parseOptions();
    }
    catch (e) {
        console.error(e.message + '\n');
        cli.printHelp(function() {
            cli.exit(1);
        });
    }

    confPath = runtime.opts.configure || path.join(runtime.dirname, 'conf.json');
    try {
        isFile = fs.statSync(confPath).isFile();
    }
    catch(e) {
        isFile = false;
    }

    if ( !isFile && !runtime.opts.configure ) {
        confPath = path.join(runtime.dirname, 'conf.json.EXAMPLE');
    }

    try {
        runtime.conf = new Config( stripJsonComments(fs.readFileSync(confPath, 'utf8')) )
            .get();
    }
    catch (e) {
        cli.exit(1, 'Cannot parse the config file ' + confPath + ': ' + e + '\n' +
            FATAL_ERROR_MESSAGE);
    }

    // look for options on the command line, in the config file, and in the defaults, in that order
    runtime.opts = _.defaults(runtime.opts, runtime.conf.opts, defaultOpts);

    return cli;
};

// TODO: docs
cli.configureLogger = function() {
    function recoverableError() {
        props.shouldExitWithError = true;
    }

    function fatalError() {
        cli.exit(1);
    }

    if (runtime.opts.debug) {
        logger.setLevel(logger.LEVELS.DEBUG);
    }
    else if (runtime.opts.verbose) {
        logger.setLevel(logger.LEVELS.INFO);
    }

    if (runtime.opts.pedantic) {
        logger.once('logger:warn', recoverableError);
        logger.once('logger:error', fatalError);
    }
    else {
        logger.once('logger:error', recoverableError);
    }

    logger.once('logger:fatal', fatalError);

    return cli;
};

// TODO: docs
cli.logStart = function() {
    logger.debug( cli.getVersion() );

    logger.debug('Environment info: %j', {
        env: {
            conf: runtime.conf,
            opts: runtime.opts
        }
    });
};

// TODO: docs
cli.logFinish = function() {
    var delta;
    var deltaSeconds;

    if (timer.finish && timer.start) {
        delta = timer.finish.getTime() - timer.start.getTime();
    }

    if (delta !== undefined) {
        deltaSeconds = (delta / 1000).toFixed(2);
        logger.info('Finished running in %s seconds.', deltaSeconds);
    }
};

// TODO: docs
cli.runCommand = function(cb) {
    var cmd;

    var opts = runtime.opts;

    function done(errorCode) {
        if (!errorCode && props.shouldExitWithError) {
            cb(1);
        }
        else {
            cb(errorCode);
        }
    }

    if (opts.help) {
        cmd = cli.printHelp;
    }
    else if (opts.test) {
        cmd = cli.runTests;
    }
    else if (opts.version) {
        cmd = cli.printVersion;
    }
    else {
        cmd = cli.main;
    }

    cmd(done);
};

// TODO: docs
cli.printHelp = function(cb) {
    cli.printVersion();
    console.log( '\n' + require('jsdoc/opts/args').help() + '\n' );
    console.log('Visit http://usejsdoc.org for more information.');
    cb(0);
};

// TODO: docs
cli.runTests = function(cb) {
    var path = require('jsdoc/path');

    var runner = require( path.join(runtime.dirname, 'test/runner') );

    console.log('Running tests...');
    runner(function(failCount) {
        cb(failCount);
    });
};

// TODO: docs
cli.getVersion = function() {
    var version = require('jsdoc/version');
    return 'JSDoc ' + version.number + ' (' + version.revision + ')';
};

// TODO: docs
cli.printVersion = function(cb) {
    console.log( cli.getVersion() );

    if (cb) {
        cb(0);
    }
};

// TODO: docs
cli.main = function(cb) {
    timer.start = new Date();
    runtime.loadSourceFiles();

    if (runtime.sourceFiles.length) {
        cli.createParser()
            .parseFiles()
            .processParseResults();
    }
    else {
        console.log('There are no input files to process.\n');
        cli.printHelp(cb);
    }

    timer.finish = new Date();
    cb(0);
};

function resolvePluginPaths(paths) {
    var path = require('jsdoc/path');

    var pluginPaths = [];

    paths.forEach(function(plugin) {
        var basename = path.basename(plugin);
        var dirname = path.dirname(plugin);
        var pluginPath = path.getResourcePath(dirname);

        if (!pluginPath) {
            logger.error('Unable to find the plugin "%s"', plugin);
            return;
        }

        pluginPaths.push( path.join(pluginPath, basename) );
    });

    return pluginPaths;
}

cli.createParser = function() {
    var handlers = require('jsdoc/src/handlers');
    var path = require('jsdoc/path');
    var plugins = require('jsdoc/plugins');

    parser = Parser.createParser(runtime.conf.parser);

    if (runtime.conf.plugins) {
        runtime.conf.plugins = resolvePluginPaths(runtime.conf.plugins);
        plugins.installPlugins(runtime.conf.plugins, parser);
    }

    handlers.attachTo(parser);

    return cli;
};

cli.parseFiles = function() {
    var augment = require('jsdoc/augment');
    var borrow = require('jsdoc/borrow');
    var Package = require('jsdoc/package').Package;

    var docs;
    var packageDocs;

    props.docs = docs = parser.parse(runtime.sourceFiles, runtime.opts.encoding);

    // If there is no package.json, just create an empty package
    packageDocs = new Package(runtime.opts.packageJson);
    packageDocs.files = runtime.sourceFiles || [];
    docs.push(packageDocs);

    logger.debug('Indexing doclets...');
    borrow.indexAll(docs);
    logger.debug('Adding inherited symbols, mixins, and interface implementations...');
    augment.augmentAll(docs);
    logger.debug('Adding borrowed doclets...');
    borrow.resolveBorrows(docs);
    logger.debug('Post-processing complete.');

    parser.fireProcessingComplete(docs);

    return cli;
};

cli.processParseResults = function() {
    if (runtime.opts.explain) {
        cli.dumpParseResults();
    }
    else {
        cli.resolveTutorials();
        cli.generateDocs();
    }

    return cli;
};

cli.dumpParseResults = function() {
    var dump = require('jsdoc/util/dumper').dump;
    console.log(dump(props.docs));

    return cli;
};

cli.resolveTutorials = function() {
    var resolver = require('jsdoc/tutorial/resolver');

    if (runtime.opts.tutorials) {
        resolver.load(runtime.opts.tutorials);
        resolver.resolve();
    }

    return cli;
};

cli.generateDocs = function() {
    var path = require('jsdoc/path');
    var resolver = require('jsdoc/tutorial/resolver');
    var taffy = require('taffydb').taffy;

    var template;

    runtime.opts.template = (function() {
        var publish = runtime.opts.template || 'templates/default';
        var templatePath = path.getResourcePath(publish);

        // if we didn't find the template, keep the user-specified value so the error message is
        // useful
        return templatePath || runtime.opts.template;
    })();

    try {
        template = require(runtime.opts.template + '/publish');
    }
    catch(e) {
        logger.fatal('Unable to load template: ' + e.message || e);
    }

    // templates should include a publish.js file that exports a "publish" function
    if (template.publish && typeof template.publish === 'function') {
        logger.printInfo('Generating output files...');
        template.publish(
            taffy(props.docs),
            runtime.opts,
            resolver.root
        );
        logger.info('complete.');
    }
    else {
        logger.fatal(runtime.opts.template + ' does not export a "publish" function. Global ' +
            '"publish" functions are no longer supported.');
    }

    return cli;
};

// TODO: docs
cli.exit = function(exitCode, message) {
    if (message && exitCode > 0) {
        console.error(message);
    }

    process.exit(exitCode || 0);
};

return cli;
})();
