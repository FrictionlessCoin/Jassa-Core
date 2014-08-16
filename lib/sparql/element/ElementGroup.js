var Class = require('../../ext/Class');
var Element = require('./Element');
var ElementTriplesBlock = require('./ElementTriplesBlock');
var ElementUtils = require('./../ElementUtils');
var PatternUtils = require('../PatternUtils');

var ElementGroup = Class.create(Element, {
    classLabel: 'jassa.sparql.ElementGroup',
    initialize: function(elements) {
        this.elements = elements ? elements : [];
    },

    addElement: function(element) {
        this.elements.push(element);
    },

    getArgs: function() {
        return this.elements;
    },

    copy: function(args) {
        var result = new ElementTriplesBlock(args);
        return result;
    },

    copySubstitute: function(fnNodeMap) {
        var newElements = this.elements.map(function(x) {
            return x.copySubstitute(fnNodeMap);
        });
        return new ElementGroup(newElements);
    },

    getVarsMentioned: function() {
        var result = PatternUtils.getVarsMentioned(this.elements);
        return result;
    },

    toString: function() {
        // return this.elements.join(" . ");
        return ElementUtils.joinElements(' . ', this.elements);
    },

    flatten: function() {
        var processed = ElementUtils.flatten(this.elements);

        if (processed.length === 1) {
            return processed[0];
        } else {
            return new ElementGroup(ElementUtils.flattenElements(processed));
        }
    },
});

module.exports = ElementGroup;