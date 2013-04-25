"use strict";

/**
 * General DOM utilities
 */

var Util = require('./mediawiki.Util.js').Util,
	Node = require('./mediawiki.wikitext.constants.js').Node,
	pd = require('./mediawiki.parser.defines.js');

// define some constructor shortcuts
var KV = pd.KV;

var DOMUtils = {
	isElt: function(node) {
		return node.nodeType === Node.ELEMENT_NODE;
	},

	isText: function(node) {
		return node.nodeType === Node.TEXT_NODE;
	},

	isBlockNode: function(node) {
		return node && Util.isBlockTag(node.nodeName.toLowerCase());
	},

	// Decode a JSON object into the data member of DOM nodes
	loadDataAttrib: function(node, name, defaultVal) {
		if ( node.nodeType !== node.ELEMENT_NODE ) {
			return;
		}

		if ( ! node.data ) {
			node.data = {};
		}
		if ( node.data[name] === undefined ) {
			node.data[name] = this.getJSONAttribute(node, 'data-' + name, defaultVal);
		}
		// nothing to do if already loaded
	},

	// Save all node.data.* structures to data attributes
	saveDataAttribs: function(node) {
		if ( node.nodeType !== node.ELEMENT_NODE ) {
			return;
		}

		for(var key in node.data) {
			if ( key.match( /^tmp_/ ) !== null ) {
				continue;
			}
			var val = node.data[key];
			if ( val && val.constructor === String ) {
				node.setAttribute('data-' + key, val);
			} else if (val instanceof Object) {
				this.setJSONAttribute(node, 'data-' + key, val);
			}
			// Else: throw error?
		}
	},

	// Decode data-parsoid into node.data.parsoid
	loadDataParsoid: function(node) {
		this.loadDataAttrib(node, 'parsoid', {});
	},

	getDataParsoid: function ( n ) {
		if ( ! ( n.data && n.data.parsoid ) ) {
			this.loadDataParsoid( n );
		}
		return n.data.parsoid;
	},

	setDataParsoid: function(n, dpObj) {
		n.setAttribute("data-parsoid", JSON.stringify(dpObj));
		return n;
	},

	getJSONAttribute: function(n, name, defaultVal) {
		if ( n.nodeType !== n.ELEMENT_NODE ) {
			return defaultVal !== undefined ? defaultVal : {};
		}

		var attVal = n.getAttribute(name);
		if (!attVal) {
			return defaultVal !== undefined ? defaultVal : {};
		}
		try {
			return JSON.parse(attVal);
		} catch(e) {
			console.warn('ERROR: Could not decode attribute ' +
					name + ' on node ' + n);
			return defaultVal !== undefined ? defaultVal : {};
		}
	},

	setJSONAttribute: function(n, name, obj) {
		n.setAttribute(name, JSON.stringify(obj));
	},

	getAttributeShadowInfo: function ( node, name, tplAttrs ) {
		var curVal = node.getAttribute(name),
			dp = node.data.parsoid;

		// If tplAttrs is truish, check if this attribute was
		// template-generated. Return that value if set.
		if ( tplAttrs ) {
			var type = node.getAttribute('typeof'),
				about = node.getAttribute('about') || '',
				tplAttrState = tplAttrs[about];
			if (type && type.match(/\bmw:ExpandedAttrs\/[^\s]+/) &&
					tplAttrState &&
					tplAttrState.vs[name] )
			{
				return {
					value: tplAttrState.vs[name],
					modified: false,
					fromsrc: true
				};
			}
		}

		// Not the case, continue regular round-trip information.
		if ( dp.a === undefined ) {
			return {
				value: curVal,
				// Mark as modified if a new element
				modified: Object.keys(dp).length === 0,
				fromsrc: false
			};
		} else if ( dp.a[name] !== curVal ||
				dp.sa[name] === undefined )
		{
			//console.log(name, node.getAttribute(name), node.attributes.name.value);
			//console.log(
			//		node.outerHTML, name, JSON.stringify([curVal, dp.a[name]]));
			return {
				value: curVal,
				modified: true,
				fromsrc: false
			};
		} else {
			return {
				value: dp.sa[name],
				modified: false,
				fromsrc: true
			};
		}
	},

	getAttributeKVArray: function(node) {
		var attribs = node.attributes,
			kvs = [];
		for(var i = 0, l = attribs.length; i < l; i++) {
			var attrib = attribs.item(i);
			kvs.push(new KV(attrib.name, attrib.value));
		}
		return kvs;
	},



	// Build path from n ---> ancestor
	// Doesn't include ancestor in the path itself
	pathToAncestor: function (n, ancestor) {
		var path = [];
		while (n && n !== ancestor) {
			path.push(n);
			n = n.parentNode;
		}

		return path;
	},

	pathToRoot: function(n) {
		return this.pathToAncestor(n, null);
	},

	// Build path from n ---> sibling (default)
	// If left is true, will build from sibling ---> n
	// Doesn't include sibling in the path in either case
	pathToSibling: function(n, sibling, left) {
		var path = [];
		while (n && n !== sibling) {
			path.push(n);
			n = left ? n.previousSibling : n.nextSibling;
		}

		return path;
	},

	// Does 'n1' occur before 'n2 in their parent's children list?
	inSiblingOrder: function(n1, n2) {
		while (n1 && n1 !== n2) {
			n1 = n1.nextSibling;
		}
		return n1 !== null;
	},

	// Is 'n1' an ancestor of 'n2' in the DOM?
	isAncestorOf: function (n1, n2) {
		while (n2 && n2 !== n1) {
			n2 = n2.parentNode;
		}
		return n2 !== null;
	},

	hasNodeName: function(n, name) {
		return n.nodeName.toLowerCase() === name;
	},

	isNodeOfType: function(n, name, type) {
		return this.hasNodeName(n, name) && n.getAttribute("typeof") === type;
	},

	isMarkerMeta: function(n, type) {
		return this.isNodeOfType(n, "meta", type);
	},

	isTplMetaType: function(nType)  {
		return nType && nType.match(/\bmw:Object(\/[^\s]+)*\b/);
	},

	isExpandedAttrsMetaType: function(nType) {
		return nType && nType.match(/\bmw:ExpandedAttrs(\/[^\s]+)*\b/);
	},

	isTplMarkerMeta: function(n)  {
		return (
			this.hasNodeName(n, "meta") &&
			this.isTplMetaType(n.getAttribute("typeof"))
		);
	},

	isTplStartMarkerMeta: function(n)  {
		if (this.hasNodeName(n, "meta")) {
			var t = n.getAttribute("typeof");
			var tMatch = t && t.match(/\bmw:Object(\/[^\s]+)*\b/);
			return tMatch && !t.match(/\/End\b/);
		} else {
			return false;
		}
	},

	isTplEndMarkerMeta: function(n)  {
		if (this.hasNodeName(n, "meta")) {
			var t = n.getAttribute("typeof");
			return t && t.match(/\bmw:Object(\/[^\s]+)*\/End\b/);
		} else {
			return false;
		}
	},

	hasLiteralHTMLMarker: function(dp) {
		return dp.stx === 'html';
	},

	isLiteralHTMLNode: function(n) {
		return this.hasLiteralHTMLMarker(this.getDataParsoid(n));
	},

	isIndentPre: function(n) {
		return this.hasNodeName(n, "pre") && !this.isLiteralHTMLNode(n);
	},

	isList: function(n) {
		return n && n.nodeName in {OL:1, UL:1, DL:1};
	},

	isListElt: function(n) {
		return n && n.nodeName in {LI:1, DD:1, DT:1};
	},

	isListOrListElt: function(n) {
		return n && n.nodeName in {OL:1, UL:1, DL:1, LI:1, DT:1, DD:1};
	},

	getPrecedingElementSibling: function(node) {
		var sibling = node.previousSibling;
		while (sibling) {
			if (sibling.nodeType === node.ELEMENT_NODE) {
				return sibling;
			}
			sibling = node.previousSibling;
		}
		return null;
	},

	hasElementChild: function(node) {
		var children = node.childNodes;
		for (var i = 0, n = children.length; i < n; i++) {
			if (this.isElt(children[i])) {
				return true;
			}
		}

		return false;
	},

	// This function tests if its end tag is outside a template.
	endTagOutsideTemplate: function(node, dp) {
		if (dp.tsr) {
			return true;
		}

		var next = node.nextSibling;
		if (next && this.isElt(next) && this.getDataParsoid(next).tsr) {
			// If node's sibling has a valid tsr, then the sibling
			// is outside a template, and since node's start tag itself
			// is inside a template, this automatically implies that
			// the end tag is outside a template as well.
			return true;
		}

		// Descend into children -- walk backward
		var children = node.childNodes;
		for (var n = children.length, i = n-1; i >= 0; i--) {
			var c = children[i];
			if (this.isElt(c)) {
				return this.endTagOutsideTemplate(c, this.getDataParsoid(c));
			}
		}

		// We ran out of children to test
		return false;
	},

	indentPreDSRCorrection: function(textNode) {
		// NOTE: This assumes a text-node and doesn't check that it is one.
		//
		// FIXME: Doesn't handle text nodes that are not direct children of the pre
		if (this.isIndentPre(textNode.parentNode)) {
			var numNLs;
			if (textNode.parentNode.lastChild === textNode) {
				// We dont want the trailing newline of the last child of the pre
				// to contribute a pre-correction since it doesn't add new content
				// in the pre-node after the text
				numNLs = (textNode.nodeValue.match(/\n./g)||[]).length;
			} else {
				numNLs = (textNode.nodeValue.match(/\n/g)||[]).length;
			}
			return numNLs;
		} else {
			return 0;
		}
	},

	// Check if node is an ELEMENT node belongs to a template/extension.
	//
	// NOTE: Use with caution. This technique works reliably for the
	// root level elements of tpl-content DOM subtrees since only they
	// are guaranteed to be  marked and nested content might not
	// necessarily be marked.
	isTplElementNode: function(env, node) {
		if (this.isElt(node)) {
			var about = node.getAttribute('about');
			return about && env.isParsoidObjectId(about);
		} else {
			return false;
		}
	},

	/**
	 * This method should return "true" for a node that can be edited in the
	 * VisualEditor extension. We're using this to basically ignore changes on
	 * things that can't have changed, because nothing could possibly have changed
	 * them.
	 *
	 * For now, template/extension content is not editable.
	 * TODO: Add anything else that is not covered here.
	 */
	isNodeEditable: function(env, someNode) {
		return !this.isTplElementNode(env, someNode);
	},

	convertDOMtoTokens: function(tokBuf, node) {
		function domAttrsToTagAttrs(attrs) {
			var out = [];
			for (var i = 0, n = attrs.length; i < n; i++) {
				var a = attrs.item(i);
				out.push(new KV(a.name, a.value));
			}
			return out;
		}

		switch(node.nodeType) {
			case Node.ELEMENT_NODE:
				var nodeName = node.nodeName.toLowerCase(),
					children = node.childNodes,
					tagAttrs = domAttrsToTagAttrs(node.attributes);

				if (Util.isVoidElement(nodeName)) {
					tokBuf.push(new pd.SelfclosingTagTk(nodeName, tagAttrs));
				} else {
					tokBuf.push(new pd.TagTk(nodeName, tagAttrs));
					for (var i = 0, n = children.length; i < n; i++) {
						tokBuf = this.convertDOMtoTokens(tokBuf, children[i]);
					}
					tokBuf.push(new pd.EndTagTk(nodeName));
				}
				break;

			case Node.TEXT_NODE:
				tokBuf = tokBuf.concat(Util.newlinesToNlTks(node.nodeValue));
				break;

			case Node.COMMENT_NODE:
				tokBuf.push(new pd.CommentTk(node.nodeValue));
				break;

			default:
				console.warn( "Unhandled node type: " + node.outerHTML );
				break;
		}
		return tokBuf;
	},

	/**
	 * Helper function to check for a change marker in data-ve-changed structure
	 */
	isModificationChangeMarker: function( dvec ) {
		return dvec && (
				dvec['new'] || dvec.attributes ||
				dvec.content || dvec.annotations ||
				dvec.childrenRemoved || dvec.rebuilt
				);
	},

	currentDiffMark: function(node, env) {
		if (!node || !this.isElt(node)) {
			return false;
		}
		if ( !( node.data && node.data["parsoid-diff"] ) ) {
			this.loadDataAttrib(node, "parsoid-diff");
		}
		var dpd = node.data["parsoid-diff"];
		return dpd !== {} && dpd.id === env.page.id ? dpd : null;
	},

	hasCurrentDiffMark: function(node, env) {
		return this.currentDiffMark(node, env) !== null;
	},

	hasInsertedOrModifiedDiffMark: function(node, env) {
		var diffMark = this.currentDiffMark(node, env);
		return diffMark &&
			(diffMark.diff.indexOf('modified') >= 0 ||
			 diffMark.diff.indexOf('inserted') >= 0);
	},

	setDiffMark: function(node, env, change) {
		var dpd = this.getJSONAttribute(node, 'data-parsoid-diff', null);
		if (dpd !== null && dpd.id === env.page.id) {
			// Diff is up to date, append this change
			dpd.diff.push(change);
		} else {
			// Was an old diff entry or no diff at all, reset
			dpd = {
				// The base page revision this change happened on
				id: env.page.id,
				diff: [change]
			};
		}

		// Add serialization info to this node
		this.setJSONAttribute(node, 'data-parsoid-diff', dpd);
	},

	/**
	 * Is a node representing inter-element ws?
	 */
	isIEW: function (node) {
		// ws-only
		return this.isText(node) && node.nodeValue.match(/^\s*$/);
	},

	isContentNode: function(node) {
		return node.nodeType !== node.COMMENT_NODE &&
			!this.isIEW(node) &&
			!this.isMarkerMeta(node, "mw:DiffMarker");
	},

	/**
	 * Get the first child element or non-IEW text node, ignoring
	 * whitespace-only text nodes and comments.
	 */
	getFirstNonSepChildNode: function(node) {
		var child = node.firstChild;
		while (child && !this.isContentNode(child)) {
			child = child.nextSibling;
		}
		return child;
	},

	previousNonSepSibling: function (node) {
		var prev = node.previousSibling;
		while (prev && !this.isContentNode(prev)) {
			prev = prev.previousSibling;
		}
		return prev;
	},

	nextNonSepSibling: function (node) {
		var next = node.nextSibling;
		while (next && !this.isContentNode(next)) {
			next = next.nextSibling;
		}
		return next;
	},

	/**
	 * Are all children of this node text nodes?
	 */
	allChildrenAreText: function (node) {
		var child = node.firstChild;
		while(child) {
			if(child.nodeType !== node.TEXT_NODE) {
				return false;
			}
			child = child.nextSibling;
		}
		return true;
	},

	wrapTextInTypedSpan: function(node, type) {
		var wrapperSpanNode = node.ownerDocument.createElement('span');
		wrapperSpanNode.setAttribute('typeof', type);
		// insert the span
		node.parentNode.insertBefore(wrapperSpanNode, node);
		// move the node into the wrapper span
		wrapperSpanNode.appendChild(node);
		return wrapperSpanNode;
	},


	prependTypedMeta: function(node, type) {
		var meta = node.ownerDocument.createElement('meta');
		meta.setAttribute('typeof', type);
		node.parentNode.insertBefore(meta, node);
		return meta;
	},

	// Create a TagTk corresponding to a DOM node
	mkTagTk: function (node) {
		var attribKVs = this.getAttributeKVArray(node);
		return new pd.TagTk(node.nodeName.toLowerCase(), attribKVs, node.data.parsoid);
	},

	// Create a EndTagTk corresponding to a DOM node
	mkEndTagTk: function (node) {
		var attribKVs = this.getAttributeKVArray(node);
		return new pd.EndTagTk(node.nodeName.toLowerCase(), attribKVs, node.data.parsoid);
	}

};

if (typeof module === "object") {
	module.exports.DOMUtils = DOMUtils;
}
