var Triple = require('../rdf/Triple');
var NodeFactory = require('../rdf/NodeFactory');
var NodeUtils = require('../rdf/NodeUtils');

var TalisRdfJsonUtils = {

    triplesToTalisRdfJson: function(triples) {
        var result = {};

        triples.forEach(function(triple) {
            var _s = triple.getSubject();
            var s = _s.isUri() ? _s.getUri() : _s;

            var pos = result[s] = result[s] || {};

            var p = triple.getPredicate().getUri();

            var os = pos[p] = pos[p] || [];

            var _o = triple.getObject();
            var o = NodeUtils.toTalisRdfJson(_o);

            os.push(o);
        });

        return result;
    },

    talisRdfJsonToTriples: function(data) {
        var result = [];

        var ss = Object.keys(data);
        ss.sort();

        ss.forEach(function(sStr) {

            var s = NodeFactory.createUri(sStr);

            var po = data[sStr];
            var ps = Object.keys(po);
            ps.sort();

            ps.forEach(function(pStr) {
                var p = NodeFactory.createUri(pStr);

                var os = po[pStr];

                os.forEach(function(oJson) {

                    // Create a clone with defaults applied
                    var clone = TalisRdfJsonUtils.createTalisRdfJsonObjectWithDefaults(oJson);

                    try {
                        var o = NodeFactory.createFromTalisRdfJson(clone);

                        var triple = new Triple(s, p, o);
                        result.push(triple);

                    } catch(err) {
                      console.log('Error: could not create node from ' + oJson);
                    }
                });
            });
        });

        return result;
    },

    shortForm: function(iriStr, prefixMapping) {
        var result = prefixMapping ? prefixMapping.shortForm(iriStr) : iriStr;
        if(result === iriStr) {
            result = '<' + iriStr + '>\n';
        }

        return result;
    },

    talisRdfJsonToTurtle: function(data, prefixMapping) {
        var ss = Object.keys(data);
        ss.sort();

        var result = '';
        ss.forEach(function(s) {

            result += TalisRdfJsonUtils.shortForm(s, prefixMapping);

            var po = data[s];
            var ps = Object.keys(po);
            ps.sort();

            ps.forEach(function(p) {
                result += '   ' + TalisRdfJsonUtils.shortForm(p, prefixMapping);

                var os = po[p];

                var oStrs = os.map(function(o) {

                    var clone = TalisRdfJsonUtils.createTalisRdfJsonObjectWithDefaults(o);

                    var r;
                    try {
                        var node = NodeFactory.createFromTalisRdfJson(clone);
                        r = node.isUri()
                            ? TalisRdfJsonUtils.shortForm(node.getUri(), prefixMapping)
                            : '' + node
                            ;

                    } catch(err) {
                        r = '\n';

                        //console.log('Error: could not create node from ' + o);
                        r += '        // Invalid data for RDF generation:\n';
                        r += '        // raw: ' + JSON.stringify(o) + '\n';
                        r += '        // defaults: ' + JSON.stringify(o) + '\n';
                        r += '        // ' + err + '\n';
                        r += '\n';
                    }

                    return r;
                });

                result += oStrs.join(', ') + ' ; \n';
            });
            result += '    . \n';
        });

        return result;
    },

    createTalisRdfJsonObjectWithDefaults: function(o) {
        var result = {
            type: o.type || 'literal',
            value: o.value || '',
            lang: o.lang || '',
            datatype: o.datatype || ''
        };

        return result;
    }


    // TODO: Add method to parse Turtle into TalisRdfJson (reuse Ruben's parser for this)
};

module.exports = TalisRdfJsonUtils;
