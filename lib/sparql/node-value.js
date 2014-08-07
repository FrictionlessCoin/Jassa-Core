var Expr = require('./expr');
var xsd = require('../vocab/xsd');
var NodeFactory = require('../rdf/node-factory');

// TODO Not sure about the best way to design this class
// Jena does it by subclassing for each type e.g. NodeValueDecimal

// TODO Do we even need this class? There is NodeValueNode now!

var NodeValue = function(node) {
    Expr.call(this);

    this.initialize(node);

    /**
     * Static functions for ns.NodeValue
     *
     * Note: It seems we could avoid all these specific sub types and
     * do something more generic
     */
    var NodeValueNode = require('./node-value-node');

    this.createLiteral = function(val, typeUri) {
        var node = NodeFactory.createTypedLiteralFromValue(val, typeUri);
        var result = new NodeValueNode(node);
        return result;
    };


    this.makeString = function(str) {
        return NodeValue.createLiteral(str, xsd.str.xstring);
    };

    this.makeInteger = function(val) {
        return new NodeValue.createLiteral(val, xsd.str.xint);
    };

    this.makeDecimal = function(val) {
        return new NodeValue.createLiteral(val, xsd.str.decimal);
    };

    this.makeFloat = function(val) {
        return new NodeValue.createLiteral(val, xsd.str.xfloat);
    };

    this.makeNode = function(node) {
        var result = new NodeValueNode(node);
        return result;
    };


};
// inherit
NodeValue.prototype = Object.create(Expr.prototype);
// hand back the constructor
NodeValue.prototype.constructor = NodeValue;


NodeValue.prototype.initialize = function(node) {
    this.node = node;
};

NodeValue.prototype.isConstant = function() {
    return true;
};

NodeValue.prototype.getConstant = function() {
    return this;
};


NodeValue.prototype.getArgs = function() {
    return [];
};

NodeValue.prototype.getVarsMentioned = function() {
    return [];
};

NodeValue.prototype.asNode = function() {
    throw 'makeNode is not overridden';
};

NodeValue.prototype.copySubstitute = function() { //fnNodeMap) {
    // TODO Perform substitution based on the node value
    // But then we need to map a node to a nodeValue first...
    return this;
    //return new ns.NodeValue(this.node.copySubstitute(fnNodeMap));
};

NodeValue.prototype.toString = function() {
    var node = this.node;

    var result;
    if (node.isLiteral()) {
        if (node.getLiteralDatatypeUri() === xsd.xstring.getUri()) {
            result = '"' + node.getLiteralLexicalForm() + '"';
        } else if (node.dataType === xsd.xdouble.value) {
            // TODO This is a hack - why is it here???
            return parseFloat(this.node.value);
        }
    } else {
        result = node.toString();
    }
    // TODO Numeric values do not need the full rdf term representation
    // e.g. "50"^^xsd:double - this method should output "natural/casual"
    // representations
    return result;
};

module.exports = NodeValue;