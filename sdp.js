
/****************************
 * 
 * SDP Parsing functions
 * 
 ****************************/
//
// Functions made available
//

exports.parse=parse;
exports.stringify=stringify;


// Regular expression to parse media lines
var reM = /^(\w+) +(\d+)(?:\/(\d))? +(\S+) (\d+( +\d+)*)/;
// Regular expression to parse attribute lines.
var reA = /^([\w-]+)(?::(.*))?$/;

// Specialized parsers for each line
var parsers = {
	//v=0
	//o=+34913305131 0 0 IN IP4 127.0.0.1 
	o : function(r, value) {
		var t = value.split(/\s+/);
		r.o = {
			username : t[0],
			id : t[1],
			version : t[2],
			nettype : t[3],
			addrtype : t[4],
			address : t[5]
		};
		return r.o;
	},
	//c=IN IP4 127.0.0.1		
	c : function(r, value) {
		var t = value.split(/\s+/);
		r.c = {
			nettype : t[0],
			addrtype : t[1],
			address : t[2]
		};
		return r.c;
	},
	//m=audio 5000 RTP/AVP 9 96 97 98 100 0 8 102 3 103 5 6 4 104 101
	m : function(r, value) {
		var t = reM.exec(value);
		if (!r.m) {
			r.m = new Array();
		}
		var m = {
			media : t[1],
			port : +t[2],
			portnum : +(t[3] || 1),
			proto : t[4],
			fmt : t[5].split(/\s+/).map(function(x) {
				return +x;
			})
		};
		r.m.push(m);
		return m;
	},
	//a=rtpmap:9 G722/8000
	//a=recvonly
	a : function(r, value) {
		var t = reA.exec(value);
		if(!r.a) {
			r.a={};
		}
		// For attributes 
		// we're going to store them as key-values under 'a' key.
		// the exception will be the codec-related attributes that
		// will go under a separate key (fmta) keyed by the codec number
		// attributes key-only (e.g. 'recvonly') will have null value.		
		if(t) {
			var key=t[1];
			var value=null;
			if(t[2]) {
				value=t[2];
			}
			if (aParsers[key]) {
				aParsers[key](r, value);
			} else {
				r.a[key]=value
			}
		} else {
			// Couldn't parse the attribute
			// add it as an array under "a"
			if (!r.a.other) {
				r.a.other = new Array();
			}			
			r.a.other.push(value);	
		}
		return value;
	}
};

//
// Specialized parsers for attribute lines
//
var aParsers={
	rtcp: function(r,value) {
		//port IN IP4 192.168.1.37
		var t = value.split(/\s+/);
		r.a.rtcp = {
				port : t[0],
				nettype : t[1],
				addrtype : t[2],
				address : t[3]
		};
		return r.a.rtcp;
	},
	rtpmap: function(r,value) {
		// codec options
		return parseCodecAttribute("rtpmap",r,value);
	},
	fmtp: function(r,value) {
		//codec options
		return parseCodecAttribute("fmtp",r,value);
	}	
}

/**
 * Function to add an attribute to a particular codec.
 * @param attribute the attribute name
 * @param r the media object
 * @param value the attribute value
 * @returns the media object
 */
function parseCodecAttribute(attribute,r,value) {
	var t = /^(\d+) ?(.*)/.exec(value);
	if(t) {
		var codec=t[1];
		var value=t[2];
		if(!r.fmta) {
			r.fmta={};
		} 
		if(!r.fmta[codec]) {
			r.fmta[codec]={}
		}
		r.fmta[codec][attribute]=value;
		return r.fmta[codec][attribute];
	} 
	return r;
	
}


// Contains specialized stringifiers for the
// different SDP lines.
var stringifiers = {
	o : function(o) {
		return [ o.username || '-', o.id, o.version, o.nettype || 'IN',
				o.addrtype || 'IP4', o.address ].join(' ');
	},
	c : function(c) {
		return [ c.nettype || 'IN', c.addrtype || 'IP4', c.address ].join(' ');
	},
	m : function(m) {
		return [ m.media || 'audio', m.port, m.transport || 'RTP/AVP',
				m.fmt.join(' ') ].join(' ');
	},
};

// Contains specialized stringifiers for
// attribute values.
var aStringifiers = {
	rtcp: function(a) {
		return ':'+([ a.port, a.nettype || 'IN', a.addrtype || 'IP4', a.address ].join(' '));
	},
	rtpmap: function(a) {
		return ':'+([ a.codec, a.value].join(' '));
	},
	fmtp: function(a) {
		return ':'+([ a.codec, a.value].join(' '));
	},
	other: function(a) {
		return a;
	}
}

/**
 * Parse an SDP content
 * @param sdp
 * @returns 
 */
function parse(sdp) {
	var lines = sdp.split(/\r\n/);
	var result = {};
	var r = result;
	for ( var i = 0; i < lines.length; ++i) {		
		var tmp = /^(\w)=(.*)/.exec(lines[i]);
		if(tmp) {
			if (tmp[1] == 'm') {
				r = result;
			}
			var c = parseLine(r, tmp[1], tmp[2]);
			if (tmp[1] == 'm') {
				r = c;
			}			
		}
	}
	return result;
}

/**
 * Parse a Line
 * @param r base object to add to 
 * @param key type of line
 * @param value value of the line
 * @returns the resulting object
 */
function parseLine(r, key, value) {
	if (parsers[key]) {
		return parsers[key](r, value);
	} else {
		return r[key] = value;
	}
}

/**
 * Provides a string version of
 * the SDP structure
 * @param sdp the SDP to map
 * @returns the result
 */
function stringify(sdp) {
	var s = '';
	s += stringifyLine(sdp, 'v', 0);
	s += stringifyLine(sdp, 'o');
	s += stringifyLine(sdp, 's', '-');
	s += stringifyLine(sdp, 'i');
	s += stringifyLine(sdp, 'u');
	s += stringifyLine(sdp, 'e');
	s += stringifyLine(sdp, 'p');
	s += stringifyLine(sdp, 'c');
	s += stringifyLine(sdp, 'b');
	s += stringifyLine(sdp, 't', '0 0');
	s += stringifyLine(sdp, 'r');
	s += stringifyLine(sdp, 'z');
	s += stringifyLine(sdp, 'k');
	s += stringifyAttributes(sdp);
	sdp.m.forEach(function(m) {
		s += stringifyLine({
			m : m
		}, 'm');
		s += stringifyLine(m, 'i');
		s += stringifyLine(m, 'c');
		s += stringifyLine(m, 'b');
		s += stringifyLine(m, 'k');
		s += stringifyCodecAttributes(m);
		s += stringifyAttributes(m);
	});

	return s;
}

/**
 * Process a line type to produce
 * its line version
 * @param sdp the structure
 * @param type the type of line
 * @param def the default value if not present
 * @returns the string representation
 */
function stringifyLine(sdp, type, def) {
	if (sdp[type] != undefined) {
		var stringifier = function(x) {
			return type + '='
					+ ((stringifiers[type] && stringifiers[type](x)) || x)
					+ '\r\n';
		};
		if (Array.isArray(sdp[type])) {
			return sdp[type].map(stringifier).join('');
		}
		return stringifier(sdp[type]);
	}

	if (def != undefined) {
		return type + '=' + def + '\r\n';
	}
	return '';
}

/**
 * Process all the attribute key-values 
 * @param sdp the sdp structure containing the attributes
 * @returns the string representation.
 */
function stringifyAttributes(sdp) {
	if(!sdp.a) {
		return '';
	}
	
	//
	// Now, go over all keys, mapping each item
	return Object.keys(sdp.a).map(function(k) {
		// Mapping function, transform each elemt
		var stringifier = function(x) {
			// Stringifier function: get the string representation.
			var result='a=';
			if(aStringifiers[k]) {
				// Found a function to process this
				result+=k+aStringifiers[k](x);
			} else {
				// No function, check if it just a presence key
				if(x==null) {
					result+=k;
				} else {
					// Then it is a name value
					result+=k+":"+x;
				}
			}
			return result+'\r\n';
		}
		// If the key contains an array, map all of them
		if (Array.isArray(sdp.a[k])) {
			return sdp.a[k].map(stringifier).join('');
		}
		// Otherwise just call the function.
		return stringifier(sdp.a[k]);		
	}).join('');
}

/**
 * Handle the special case of the codec attributes
 * @param m the sdp structure (media)
 * @return the string representation.
 */
function stringifyCodecAttributes(m) {
	if(!m.fmta) {
		return '';
	}
	// We're going to create a fake 'a' object.
	// where we will add the attributes and then
	// process as if they were regular a= lines.
	return Object.keys(m.fmta).map(function(codec) {
		var a={};
		Object.keys(m.fmta[codec]).forEach(function (k) {
			a[k]={
					codec: codec,
					value: m.fmta[codec][k]
			};
		});
		return stringifyAttributes({a:a});
	}).join('');
}
