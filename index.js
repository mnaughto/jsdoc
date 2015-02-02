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
	
	function JsDoc(cwd, configuration, options){
		runtime.initialize([__dirname, cwd]);
		runtime.conf = new Config(configuration || {});
		runtime.opts = options || {};
	}

	JsDoc.prototype = {
		createParser: function(){
			var handlers = require('jsdoc/src/handlers');
			var path = require('jsdoc/path');
			var plugins = require('jsdoc/plugins');

			parser = Parser.createParser(runtime.conf.parser);

			if (runtime.conf.plugins) {
			    runtime.conf.plugins = resolvePluginPaths(runtime.conf.plugins);
			    plugins.installPlugins(runtime.conf.plugins, parser);
			}

			handlers.attachTo(parser);
			return parser;
		},

		parseFiles: function(){
			var augment = require('jsdoc/augment');
			var borrow = require('jsdoc/borrow');
			var Package = require('jsdoc/package').Package;

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
			var dump = require('jsdoc/util/dumper').dump;
			return dump(this.parseFiles());
		}
	};

	module.exports = JsDoc;
})();