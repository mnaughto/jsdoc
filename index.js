/*global arguments, require: true */
/**
 * @project jsdoc
 * @author Mike Naughton <michael.d.naughton@gmail.com>
 * @license See LICENSE.md file included in this distribution.
 */

(function() {
	var path = require('path');

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
})();

(function() {
	var runtime = require('./lib/jsdoc/util/runtime');
	var Config = require('./lib/jsdoc/config');
	var Parser = require('./lib/jsdoc/src/parser');

	function resolvePluginPaths(paths) {
	    var path = require('./lib/jsdoc/path');

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
	
	function JsDoc(cwd, configuration, options){
		runtime.initialize([__dirname, cwd]);
		runtime.conf = new Config(JSON.stringify(configuration || {})); //TODO: change config to support actual objects
		runtime.conf = runtime.conf.get();
		runtime.opts = options || {};
		runtime.opts._ = ['.'];
		runtime.loadSourceFiles();
	}

	JsDoc.prototype = {
		createParser: function(){
			var handlers = require('./lib/jsdoc/src/handlers');
			var path = require('./lib/jsdoc/path');
			var plugins = require('./lib/jsdoc/plugins');

			parser = Parser.createParser(runtime.conf.parser);

			if (runtime.conf.plugins) {
			    runtime.conf.plugins = resolvePluginPaths(runtime.conf.plugins);
			    plugins.installPlugins(runtime.conf.plugins, parser);
			}

			handlers.attachTo(parser);
			return parser;
		},

		parseFiles: function(){
			var augment = require('./lib/jsdoc/augment');
			var borrow = require('./lib/jsdoc/borrow');
			var Package = require('./lib/jsdoc/package').Package;

			var docs;
			var packageDocs;
			var parser = this.createParser();

			docs = parser.parse(runtime.sourceFiles, runtime.opts.encoding);

			// If there is no package.json, just create an empty package
			packageDocs = new Package(runtime.opts.packageJson);
			packageDocs.files = runtime.sourceFiles || [];
			docs.push(packageDocs);

			borrow.indexAll(docs);
			augment.augmentAll(docs);
			borrow.resolveBorrows(docs);

			parser.fireProcessingComplete(docs);
			return docs;
		},

		dumpResults: function(){
			var dump = require('./lib/jsdoc/util/dumper').dump;
			return dump(this.parseFiles());
		}
	};

	module.exports = JsDoc;
})();