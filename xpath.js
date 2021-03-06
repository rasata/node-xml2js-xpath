var _ = require("lodash");
var xml2js = require("xml2js");

// Given a JSON document returned by xml2js (with _ and $ keys), return the
// combined text value of the tags.
var jsonText = function(json) {
	if (_.isString(json)) {
		return json;
	}
	var result = json._ || '';
	_.forEach(_.keys(json),function(key) {
		if (key === '$' || key === '_') {
			return;
		}
    debugger;
		var value = json[key];
		if (_.isArray(value)) {
			_.forEach(value,function(entry) {
				result += jsonText(entry);
			});
		} else {
			result += jsonText(value);
		}
	});
	return result;
};

var findAllKeys = function(json, key, matches) {
  if (_.isString(json)) {
    return matches;
  }
	_.forEach(_.keys(json),function(jsonKey) {
		if (jsonKey === '$' || jsonKey === '_') {
			return;
		}
		if (key === jsonKey && key in json) {
			if (!_.isArray(json[jsonKey])) {
				matches.push(json[jsonKey]);
			} else {
				_.forEach(json[jsonKey], function(val) {
					matches.push(val);
				});
			}
		} else {
			findAllKeys(json[jsonKey], key, matches);
		}
	});
	return matches;
};

var findAllProperties = function(json, property, matches) {
	var foundMatch = false;
	_.forEach(_.keys(json.$),function(jsonProperty) {
		if (property === jsonProperty && property in json.$) {
			matches.push(json);
			foundMatch = true;
		}
	});

	if (!foundMatch) {
		_.forEach(_.keys(json),function(jsonKey) {
			if (jsonKey === '$' || jsonKey === '_') {
				return;
			}
			findAllProperties(json[jsonKey], property, matches);
		});
	}

	return matches;
};

// Perform simple search of a xml2js document with XPath.
//
// This function supports simple XPath queries like:
//	* //Element/SubElement
//	* /Element/Subelement/SubSubElement
//	* //Element[@id='4']/SubElement
//	* //Element[@id='4']/@property
//
// Returns an array of matches.
var find = function(json, path) {
	if (path === "") {
		if (!_.isArray(json)) {
			return [json];
		}
		return json;
	}
	if (path.length > 0 && path[0] === ".") {
		path = path.substring(1);
	}

	// match Element[@key='value']
	var match = path.match(/^\/(\w+)\[@(\w+)='(\w+)'\]/);
	if (match) {
		var node = match[1];
		var key = match[2];
		var value = match[3];
		if (node in json && "$" in json[node]) {
			if (key in json[node].$ && json[node].$[key] === value) {
				return find(json[node],path.replace(/^\/(\w+)\[@(\w+)='(\w+)'\]/,""))
			}
		}
	}

	// match //Element[@key='value']
	var match = path.match(/^\/\/(\w+)\[@(\w+)='(\w+)'\]/);
	if (match) {
		// see if the current dictionary has a match, for all that do not match, see
		// if their values have matches, etc...
		var node = match[1];
		var key = match[2];
		var value = match[3];
		var newPath = path.replace(/^\/\/(\w+)\[@(\w+)='(\w+)'\]/, "");
		var matches = findAllKeys(json, node, []);
		var matches = _.filter(matches, function(val) {
			if ('$' in val) {
				return key in val.$ && val.$[key] === value;
			}
			return false;
		});
		var results = [];
		_.forEach(matches, function(value) {
			var matches = find(value, newPath);
			results = results.concat(matches);
		});
		return results;
	}

	// match //Element
	match = extractAllKeys(json, path, /^\/\/(\w+)/);
	if (match !== false) {
		return match;
	}

	// match /Element
	match = extractAllKeys(json, path, /^\/(\w+)/);
	if (match !== false) {
		return match;
	}

	// match //@property
	match = extractAllProperties(json, path, /^\/\/@(\w+)/);
	if (match !== false) {
		return match;
	}

	// match /@property
	match = path.match(/^\/@(\w+)/);
	if (match) {
		var matches = [];
		_.forEach(_.keys(json),function(key) {
			if (_.isArray(json[key])) {
				_.forEach(json[key], function(sub) {
					if (_.has(sub,"$") && match[1] in sub.$) {
						matches.push(sub);
					}
				});
			} else {
				if (_.has(json,"$") && match[1] in json.$) {
					matches.push(json);
				}
			}
		});
		return matches;
	}
	return [];
};

var extractAll = function(json, path, pattern, extractFn) {
	var match = path.match(pattern);
	if (match) {
		// see if the current dictionary has a match, for all that do not match, see
		// if their values have matches, etc...
		var newPath = path.replace(pattern, '');
		var matches = extractFn(json, match[1], []);
		var results = [];
		_.forEach(matches, function(value) {
			var matches = find(value, newPath);
			results = results.concat(matches);
		});
		return results;
	}

	return false;
};
var extractAllKeys = _.partialRight(extractAll,findAllKeys);
var extractAllProperties = _.partialRight(extractAll,findAllProperties);

// Use find to search a JSON object.
//
// Parameters:
//	* json	= the JSON document to search (genearted by xml2js)
//	* path	= An XPath search.
//	* fetch = If true, run jsonText() on the output. If a string, try to return
//						the tag property. If not supplied, return the node.
//
// Returns a node (one with no attributes and a null value if no match)
// If more than one match is found, the first is returned.
var evalFirst = function(json, path, fetch) {
	var matches = find(json, path);
	if (matches.length === 0) {
		if (fetch) {
			return undefined;
		}
		return undefined;
	}
	// searches like //Somehting/SomethingElse return nested arrays
	matches = matches[0];
	if (_.isArray(matches)) {
		matches = matches[0];
	}
	if (fetch === true) {
		return jsonText(matches);
	}
	if (_.isString(fetch)) {
		if ("$" in matches && fetch in matches.$) {
			return matches.$[fetch];
		}
		return undefined;
	}
	return matches;
};

module.exports.evalFirst = evalFirst;
module.exports.find = find;
module.exports.jsonText = jsonText;
