var Class = require('../../ext/class');
var Expr = require('../expr/expr');

// helper
var getSubstitute = function(node, fnNodeMap) {
    var result = fnNodeMap(node);
    if (!result) {
        result = node;
    }
    return result;
};

// TODO Change to ExprFunction1
var EOneOf = Class.create(Expr, {
    // TODO Jena uses an ExprList as the second argument
    initialize: function(lhsExpr, nodes) {

        this.lhsExpr = lhsExpr;
        // this.variable = variable;
        this.nodes = nodes;
    },

    getVarsMentioned: function() {
        // return [this.variable];
        var result = this.lhsExpr.getVarsMentioned();
        return result;
    },

    copySubstitute: function(fnNodeMap) {
        var newElements = this.nodes.map(function(x) {
            return getSubstitute(x, fnNodeMap);
        });
        return new EOneOf(this.lhsExpr.copySubstitute(fnNodeMap), newElements);
    },

    toString: function() {

        if (!this.nodes || this.nodes.length === 0) {
            //
            return 'FALSE';
        } else {
            return '(' + this.lhsExpr + ' In (' + this.nodes.join(', ') + '))';
        }
    },
});

module.exports = EOneOf;
