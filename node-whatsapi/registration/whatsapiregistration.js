var fs = require('fs');
var crypto = require('crypto');
var https = require('https');
var querystring = require('querystring');
var common = require('../common');

var INVALID_PHONE = {
	code: '1',
	message: 'The provided phone number is not valid'
};
var REQUEST_ERROR = {
	code: '2',
	message: 'Request failed'
};
var WRONG_RESPONSE = {
	code: '3',
	message: 'Response is non-json'
};
var NETWORK_ERROR = {
	code: '4',
	message: 'Network error'
};

/**
 * @class WhatsApiRegistration
 * @param {WhatsApiRegistationConfig} config
 */
var WhatsApiRegistration = module.exports =
	function WhatsApiRegistration(config) {
		this.config = common.extend({}, this.defaultConfig, config);
	};

WhatsApiRegistration.prototype.defaultConfig = {
	msisdn: '',
	device_id: '',
	device_type: 'S40',
	app_version: '2.12.81',
	ua: 'WhatsApp/2.12.81 S40Version/14.26 Device/Nokia302'
};

WhatsApiRegistration.prototype.countries = require(__dirname + '/countries');

/**
 * Request a code for registration
 * @param  {String}   method   One of two methods: 'sms' or 'voice'
 */
WhatsApiRegistration.prototype.codeRequest = function(method, callback) {
	var cc = null;
	var found = false;
	for (var i = 1; i <= 4 && !found; i++) {
		cc = this.config.msisdn.slice(0, i);
		
		if (this.countries[cc])
		{
			found = true;
		}
	}

	if (!cc)
		return callback(INVALID_PHONE);

	var settings = this.countries[cc];
	this.config.cc = cc;
	this.config.ccode = settings.mcc[0];
	this.config.language = settings.ISO639;
	this.config.country = settings.ISO3166;

	var token = this.generateToken(settings.country, this.config.msisdn.substr(cc.length));
	var params = {
		in: this.config.msisdn.substr(cc.length),
		cc: this.config.cc,
		lg: this.config.language,
		lc: this.config.country,
		method: method,
		sim_mcc: this.config.ccode,
		sim_mnc: settings.mnc,
		id: this.config.device_id,
		token: token
	};

	this.request('code', params, callback);
};

/**
 * Finish register with code
 * @param  {String}   code     Code from sms or voice
 * @param  {Function} callback Callback on finish request
 */
WhatsApiRegistration.prototype.codeRegister = function(code, callback) {
	var params = {
		cc: this.config.cc,
		in : this.config.msisdn.substr(this.config.cc.length),
		id: this.config.device_id,
		code: code
	};

	this.request('register', params, callback);
};

WhatsApiRegistration.prototype.request = function(method, query, callback) {

	var raw = {
		hostname: 'v.whatsapp.net',
		path: '/v2/' + method + '?' + querystring.stringify(query),
		headers: {
			'User-Agent': this.config.ua,
			'Accept': 'text/json'
		}
	};

	var req = https.get(raw, function(res) {
		var buffers = [];

		res.on('data', function(buf) {
			buffers.push(buf);
		});

		res.on('end', function() {
			var jsonbody = Buffer.concat(buffers).toString();
			var response = null;

			try {
				response = JSON.parse(jsonbody);
			} catch (err) {
				WRONG_RESPONSE.response = JSON.stringify(jsonbody);
				return callback(WRONG_RESPONSE);
			}

			if (response.status !== 'sent' && response.status !== 'ok') {
				REQUEST_ERROR.response = response;
				return callback(REQUEST_ERROR);
			}

			callback(null, response);
		});
	});

	req.on('error', function(err) {
		NETWORK_ERROR.info = err;
		return callback(NETWORK_ERROR);
	});
};

WhatsApiRegistration.prototype.generateToken = function(country, phone) {
	function md5(str) {
		var hash = crypto.createHash('md5');
		hash.update(str);
		return hash.digest('hex');
	}
	var part = 'PdA2DJyKoUrwLw1Bg6EIhzh502dF9noR9uFCllGk';
	var releaseTime = '1430860548912';
	var token = md5(part + releaseTime + phone);
	return token;
};
