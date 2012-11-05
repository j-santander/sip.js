//
// Functions made available
//

exports.parse=parse;
exports.stringify=stringify;


var reM = /^(\w+) +(\d+)(?:\/(\d))? +(\S+) (\d+( +\d+)*)/;
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
		if (!r.a) {
			r.a = new Array();
		}
		r.a.push(value);
		return value;
	}
};

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
	}
};

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

function parseLine(r, key, value) {
	if (parsers[key]) {
		return parsers[key](r, value);
	} else {
		return r[key] = value;
	}
}

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
	s += stringifyLine(sdp, 'a');
	sdp.m.forEach(function(m) {
		s += stringifyLine({
			m : m
		}, 'm');
		s += stringifyLine(m, 'i');
		s += stringifyLine(m, 'c');
		s += stringifyLine(m, 'b');
		s += stringifyLine(m, 'k');
		s += stringifyLine(m, 'a');
	});

	return s;
}

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
