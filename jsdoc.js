#!/usr/bin/env node
/*global arguments, require: true */
/**
 * @project jsdoc
 * @author Michael Mathews <micmath@gmail.com>
 * @license See LICENSE.md file included in this distribution.
 */

// initialize the environment for the current JavaScript VM
(function(args) {
    'use strict';

    var path;

    if (args[0] && typeof args[0] === 'object') {
        // we should be on Node.js
        args = [__dirname, process.cwd()];
        path = require('path');

        // Create a custom require method that adds `lib/jsdoc` and `node_modules` to the module
        // lookup path. This makes it possible to `require('jsdoc/foo')` from external templates and
        // plugins, and within JSDoc itself. It also allows external templates and plugins to
        // require JSDoc's module dependencies without installing them locally.
        require = require('requizzle')({
            requirePaths: {
                before: [path.join(__dirname, 'lib')],
                after: [path.join(__dirname, 'node_modules')]
            },
            infect: true
        });
    }

    require('./lib/jsdoc/util/runtime').initialize(args);
})( Array.prototype.slice.call(arguments, 0) );

(function() {
    'use strict';

    var logger = require('./lib/jsdoc/util/logger');
    var runtime = require('./lib/jsdoc/util/runtime');
    var cli = require('./cli');

    function cb(errorCode) {
        cli.logFinish();
        cli.exit(errorCode || 0);
    }

    cli.loadConfig();

    if (!runtime.opts.test) {
        cli.configureLogger();
    }

    cli.logStart();

    // On Rhino, we use a try/catch block so we can log the Java exception (if available)
    if ( runtime.isRhino() ) {
        try {
            cli.runCommand(cb);
        }
        catch(e) {
            if (e.rhinoException) {
                logger.fatal( e.rhinoException.printStackTrace() );
            } else {
                console.trace(e);
                cli.exit(1);
            }
        }
    }
    else {
        cli.runCommand(cb);
    }
})();
