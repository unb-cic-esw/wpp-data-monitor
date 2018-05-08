var util        = require('util');
var events      = require('events');
var fs          = require('fs');
var querystring = require('querystring');
var path        = require('path');
var common      = require('./common');
var dictionary  = require('./dictionary');
var protocol    = require('./protocol');
var transports  = require('./transport');
var encryption  = require('./encryption');
var processors  = require('./processors');
var MediaType   = require('./MediaType.js');
var ImageTools  = require('./ImageTools.js');

/**
 * Constructor for WhatsApi
 * @class
 * @param {WhatsApiConfig} config
 * @param {Reader} reader
 * @param {Writer} writer
 * @param {Processor} processor
 * @param {Transport} transport
 */
function WhatsApi(config, reader, writer, processor, transport) {
	this.config    = common.extend({}, this.defaultConfig, config);
	this.reader    = reader;
	this.writer    = writer;
	this.processor = processor;
	this.transport = transport;

	events.EventEmitter.call(this);

	this.init();
}

util.inherits(WhatsApi, events.EventEmitter);

/* Magic here
 * Prototype extensions
 * Load modules from the extensions directory to extend the prototype
 */
var files = fs.readdirSync(path.join(__dirname, 'extensions'));
for (var i = 0; i < files.length; i++) {
	var file = files[i];
	if (file.match(/.*\.js/i)) {
		var mod = require('./extensions/' + file);
		var proto = mod.prototype;
		// Merge prototypes
		for (var functionName in proto) {
			// Conflate the function
			WhatsApi.prototype[functionName] = proto[functionName];
		}
	}
}

/**
* @typedef WhatsApiConfig
* @type {Object}
* @property {String} msisdn - phone number in international format, without leading '+'. E.g. 491234567890
* @property {String} device_id - Device ID (only used for registration)
* @property {String} username - User name
* @property {String} password - Password provided by WhatsApp upon registration
* @property {String} ccode -  MCC (Mobile Country Code) See documentation at http://en.wikipedia.org/wiki/Mobile_country_code
* @property {Boolean} reconnect - specify true for automatic reconnect upon disconnect
* @property {String} host - host URI of the WhatsApp server
* @property {String} server - server URI (not used for connecting)
* @property {String} gserver - group server URI (not used for connecting)
* @property {Number} port - port number to connect to WhatsApp server
* @property {String} device_type - name of the device, used when logging in
* @property {String} app_version - version of the WhatsApp App to use in communication
* @property {String} ua - user agent string to use in communication
* @property {String} challenge_file - path to challenge file
* @property {ImageTools} imageTool - image tool to be used when generating thumbnails
* @property {Number} sendReceipt - 0 for none, 1 for standard receipts, 2 for read receipts
*/

/** @type {WhatsApiConfig} */
WhatsApi.prototype.defaultConfig = {
	msisdn         : '',
	device_id      : '',
	username       : '',
	password       : '',
	ccode          : '',
	reconnect      : true,
	host           : 'e{0}.whatsapp.net',
	server         : 's.whatsapp.net',
	gserver        : 'g.us',
	port           : 443,
	device_type    : 'iPhone',
	app_version    : '2.11.16',
	ua             : 'WhatsApp/2.11.16 iPhone_OS/8.3 Device/iPhone_6',
	challenge_file : path.join(__dirname, 'challenge'),
	imageTool      : ImageTools.JIMP,
	sendReceipt    : 2
};

/**
 * Initializes WhatsApi
 * Internal method, should not be called externally
 */
WhatsApi.prototype.init = function() {
	this.transport.onReceive(this.onTransportData, this);
	this.transport.onError(this.onTransportError, this);
	this.transport.onEnd(this.onTransportEnd, this);

	this.connected   = false;
	this.challenge   = null;
	this.messageId   = 0;
	this.queue       = [];
	this.loggedIn    = false;
	this.mediaQueue  = {};
	this.selfAddress = this.createJID(this.config.msisdn);
	
	// Callbacks
	this.connectCallback = null;
	this.loginCallback = null;
	this.callbacksCollection = [];

	this.processor.setAdapter(this);
};

/**
 * Add a new callback to the queue
 * @param  {String}   id   The id of the message that's being sent
 * @param  {Function} cb   The callback to be called when a response for the message is received
 */
WhatsApi.prototype.addCallback = function(id, cb) {
	if (!id || !cb) {
		return;
	}
	if (typeof cb !== "function")
		throw new Error("cb is not a callback");
		
	this.callbacksCollection.push({ id: id, callback: cb });
};

/**
 * Execute the callback for the provided message id and remove it from the queue
 * @param  {String} id    The id of the received message
 * @param  {Array} args   The parameters to be passed to the called callback
 */
WhatsApi.prototype.executeCallback = function(id, args, isError) {
	if (!Array.isArray(args)) {
		args = [args];
	}
	
	// No error --> first parameter should be null
	if (!isError) {
		args.unshift(null);
	}
	
	// Add ID as last parameter
	args.push(id);
	
	// Find the callbacks associated with the id
	for (var i = 0; i < this.callbacksCollection.length; i++) {
		var item = this.callbacksCollection[i];
		if (item.id == id) {
			// Call the callback
			item.callback && item.callback.apply(this, args);
			// Remove it
			this.callbacksCollection.splice(i--, 1);
		}
	};
};

/**
 * Connect to the WhatsApp server using the connection parameters specified in the configuration
 * @param {Function} callback    Called when the connection has completed
 */
WhatsApi.prototype.connect = function(callback) {
	this.loggedIn = false;
	this.connectCallback = callback ? callback : null;
	this.config.host = this.config.host.replace('{0}', common.getRandomInt(1, 16));
	this.transport.connect(this.config.host, this.config.port, this.onTransportConnect, this);
};

/**
 * Disconnect from the WhatsApp server
 */
WhatsApi.prototype.disconnect = function() {
	this.transport.disconnect();
};

/**
 * Login to WhatsApp
 * @param  {Function} callback   Called when the login has completed
 */
WhatsApi.prototype.login = function(callback) {
	if (this.loggedIn) {
		callback('Already logged in');
		return;
	}
	this.loginCallback = callback ? callback : null;
	
	this.reader.setKey(null);
	this.writer.setKey(null);

	var resource = [this.config.device_type, this.config.app_version, this.config.port].join('-');

	this.send(this.writer.stream(this.config.server, resource));
	this.sendNode(this.createFeaturesNode());
	this.sendNode(this.createAuthNode());
};

WhatsApi.prototype.isLoggedIn = function() {
	return this.loggedIn;
};

WhatsApi.prototype.flushQueue = function() {
	var queue  = this.queue;
	this.queue = [];

	queue.forEach(function(elem) {
		this.sendMessageNode(elem.to, elem.node);
	}, this);
};

WhatsApi.prototype.sendNode = function(node) {
	node && this.send(this.writer.node(node));
};

WhatsApi.prototype.send = function(buffer) {
	this.transport.send(buffer);
};

WhatsApi.prototype.createFeaturesNode = function() {
	var features = [
		new protocol.Node('readreceipts'),
		new protocol.Node('groups_v2'),
		new protocol.Node('privacy'),
		new protocol.Node('presence')
	];

	return new protocol.Node('stream:features', null, features);
};

WhatsApi.prototype.createAuthNode = function() {
	var attributes = {
		//xmlns     : 'urn:ietf:params:xml:ns:xmpp-sasl',
		mechanism : 'WAUTH-2',
		user      : this.config.msisdn
	};

	return new protocol.Node('auth', attributes, null, this.createAuthData());
};

WhatsApi.prototype.createAuthData = function() {
	var challenge = fs.readFileSync(this.config.challenge_file);

	if(!challenge.length) {
		return '';
	}

	//this.initKeys(challenge);
	var key = encryption.pbkdf2(new Buffer(this.config.password, 'base64'), challenge, 16, 20);
	this.readerKey = new encryption.KeyStream(new Buffer([key[2]]), new Buffer([key[3]]));
	this.writerKey = new encryption.KeyStream(new Buffer([key[0]]), new Buffer([key[1]]));


	this.reader.setKey(this.readerKey);

	var arr = Buffer.concat([
		new Buffer([0,0,0,0]),
		new Buffer(this.config.msisdn),
		challenge,
		new Buffer(common.tstamp().toString()),
		new Buffer(this.config.ua),
		new Buffer(' MccMnc/' + this.config.ccode + '001')
	]);
	return this.writerKey.encodeMessage(arr, 0, arr.length, 0);
};

WhatsApi.prototype.createAuthResposeNode = function(challenge) {
  //console.log(challenge.toString('hex'));
	this.initKeys(challenge);

	var arr = Buffer.concat([
		new Buffer([0,0,0,0]),
		new Buffer(this.config.msisdn),
		challenge
	]);
	//console.log(arr.toString('hex'));
	var data = this.writerKey.encodeMessage(arr, 0,4,arr.length -4);
  //console.log(data.toString('hex'));
	return new protocol.Node('response', null, null, data);
};

WhatsApi.prototype.generateKeys = function(password, nonce) {
	var keys = [];
	for(var j=1;j<5;j++){
		var currNonce = Buffer.concat( [nonce, new Buffer([j])] );
		keys.push( encryption.pbkdf2(new Buffer(password, 'base64'), currNonce, 2, 20) );		
	}
	return keys;
};

WhatsApi.prototype.initKeys = function(nonce) {
	var keys = this.generateKeys(this.config.password, nonce);

	this.readerKey = new encryption.KeyStream(keys[2], keys[3]);
	this.writerKey = new encryption.KeyStream(keys[0], keys[1]);
};

/**
 * Generate the next ID for outcoming messages
 * @param  {String} prefix    The ID prefix
 * @return {String}           Message ID
 */
WhatsApi.prototype.nextMessageId = function(prefix) {
	return [prefix, common.tstamp(), ++this.messageId].join('-');
};

/**
 * Create the JID for the given number
 * @param  {String} msisdn    Phone number
 * @return {String}           The JID
 */
WhatsApi.prototype.createJID = function(msisdn) {
	msisdn = msisdn.toString();
	if(msisdn.indexOf('@') !== -1) {
		return msisdn;
	}

	var affix = msisdn.indexOf('-') === -1 ? this.config.server : this.config.gserver;

	return msisdn + '@' + affix;
};

WhatsApi.prototype.onTransportConnect = function() {
	this.emit('connect');
	this.connectCallback && this.connectCallback();
	this.connected = true;
};

WhatsApi.prototype.onTransportError = function(e) {
	this.connectCallback && this.connectCallback(e);
	this.emit(this.connected ? 'error' : 'connectError', e);
};

WhatsApi.prototype.onTransportEnd = function() {
	this.connected = false;
	if(this.config.reconnect) {
		this.emit('reconnect');
		this.connect();
	} else {
		this.emit('end');
	}
};

WhatsApi.prototype.onTransportData = function(data) {
	this.reader.appendInput(data);

	while(true) {
		var node = this.reader.nextNode();

		if(node === false) {
			break;
		}

		if(node) {
			this.processNode(node);
		}
	}
};

/**
* @class WhatsApiDebug
* @augments WhatsApi
* @param {WhatsApiConfig} config
* @param {Reader}         reader
* @param {Writer}         writer
* @param {Processor}      processor
* @param {Transport}      transport
*/
function WhatsApiDebug() {
	WhatsApiDebug.super_.apply(this, arguments);
}

util.inherits(WhatsApiDebug, WhatsApi);


WhatsApiDebug.prototype.processNode = function(node) {
	node && console.log(node.toXml('rx '));
	return WhatsApiDebug.super_.prototype.processNode.apply(this, arguments);
};

WhatsApiDebug.prototype.sendNode = function(node) {
	node && console.log(node.toXml('tx '));
	return WhatsApiDebug.super_.prototype.sendNode.apply(this, arguments);
};

/**
 * Create a new instance of the WhatsApi class
 * @param  {WhatsApiConfig} config    Configuration object
 * @param  {Boolean}        debug     Enable debug mode, which outputs all the nodes
 * @param  {Reader}         reader
 * @param  {Writer}         writer
 * @param  {Object}         processor
 * @param  {Object}         transport
 * @return {WhatsApi}       Created WhatsApi instance
 */
function createAdapter(config, debug, reader, writer, processor, transport) {
	reader    = reader    || new protocol.Reader(dictionary);
	writer    = writer    || new protocol.Writer(dictionary);
	processor = processor || processors.createProcessor();
	transport = transport || new transports.Socket;

	var WhatsApp = debug ? WhatsApiDebug : WhatsApi;

	return new WhatsApp(config, reader, writer, processor, transport);
}

/**
 * @private
 * @return {WhatsApiRegistration}
 */
function createRegistration(config) {
	var WhatsApiRegistration = require('./registration/whatsapiregistration');
	return new WhatsApiRegistration(config);
}

exports.createAdapter      = createAdapter;
exports.createRegistration = createRegistration;
exports.imageTools         = ImageTools;
