/*global describe, expect, it, jasmine */
'use strict';

describe('sourcetag plugin', function() {
    var parser = jasmine.createParser();
    var path = require('jsdoc/path');
    var runtime = require('jsdoc/util/runtime');

    var docSet;

    var pluginPath = 'plugins/sourcetag';
    var pluginPathResolved = path.join(runtime.dirname, pluginPath);
    var plugin = require(pluginPathResolved);

    require('jsdoc/plugins').installPlugins([pluginPathResolved], parser);
    docSet = jasmine.getDocSetFromFile(pluginPath + '.js', parser);

    it("should set the lineno and filename of the doclet's meta property", function() {
        var doclet = docSet.getByLongname('module:plugins/sourcetag.handlers.newDoclet');
        expect(doclet[0].meta).toBeDefined();
        expect(doclet[0].meta.filename).toEqual('sourcetag.js');
        expect(doclet[0].meta.lineno).toEqual(13);
    });
});
