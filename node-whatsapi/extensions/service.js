// Service submodule
// Includes functions for general interaction with WhatsApp

var common = require('../common.js');
var protocol = require('../protocol.js');
var WhatsApi = module.exports = function() {};

WhatsApi.prototype.createCleanDirtyNode = function(node) {
	var cleanNodes = node.children().map(function(c) {
		return new protocol.Node('clean', { type: c.attribute('type') });
	});

	var attributes = {
		id: this.nextMessageId('cleandirty'),
		type : 'set',
		to: this.config.server,
		xmlns: 'urn:xmpp:whatsapp:dirty'
	};

	return new protocol.Node('iq', attributes, cleanNodes);
};

/**
 * Create a pong node, to be sent in response to ping
 * @param  {String} messageId    The ping message ID
 * @return {Node}       Created node
 */
WhatsApi.prototype.createPongNode = function(messageId) {
	var attributes = {
		to   : this.config.server,
		id   : messageId,
		type : 'result'
	};

	return new protocol.Node('iq', attributes);
};

/**
 * Create a 'receipt' node, to be sent when a new message is received/read
 * @param  {Node} node    The received message node
 * @private
 * @return {Node}         Created node
 */
WhatsApi.prototype.createReceiptNode = function(node, type) {
	var attributes = {
		to   : node.attribute('from'),
		id   : node.attribute('id'),
		t    : common.tstamp().toString()
	};
	
	if (type) {
		attributes['type'] = type;
	}
	
	if (node.attribute('participant')) {
		attributes['participant'] = node.attribute('participant');
	}

	return new protocol.Node('receipt', attributes);
};

/**
 * Send the receipt for a message
 * @param  {Object} message
 * @param  {String} type - `read` or null for standard receipts
 */
WhatsApi.prototype.sendMessageReceipt = function(message, type) {
	var attributes = {
		to   : message['from'],
		id   : message['id'],
		t    : common.tstamp().toString()
	};
	
	if (type) {
		attributes['type'] = type;
	}
	
	if (message['author']) {
		attributes['participant'] = message['author'];
	}

	this.sendNode(new protocol.Node('receipt', attributes));
};

/**
 * Create a 'ack' node, to be sent when a new notification is received
 * @param  {Node} node    The notification node
 * @private
 * @return {Node}         Created node
 */
WhatsApi.prototype.createNotificationAckNode = function(node) {
	var attributes = {
		to    : node.attribute('from'),
		class : 'notification',
		id    : node.attribute('id'),
		type  : node.attribute('type')
	};
	if (node.attribute('to')) {
		attributes['from'] = node.attribute('to');
	}
	if (node.attribute('participant')) {
		attributes['participant'] = node.attribute('participant');
	}

	return new protocol.Node('ack', attributes);
};

/**
 * Create a 'ack' node, to be sent when a 'receipt' node is received
 * @param  {Node} node     The 'receipt' node
 * @return {Node}          Created node
 */
WhatsApi.prototype.createAckNode = function(node) {
	var attributes = {
		to: node.attribute('from'),
		class: 'receipt',
		id: node.attribute('id'),
		type: node.attribute('type') || 'delivery'
	};
	
	var node = new protocol.Node(
		'ack',
		attributes
	);
	
	return node;
};

/**
 * Request WhatsApp server properties
 * @param  {Function} callback Called when the properties are received
 */
WhatsApi.prototype.requestServerProperties = function(callback) {
	var messageId = this.nextMessageId('getproperties');
	this.addCallback(messageId, callback);
	
	var node = new protocol.Node(
		'iq',
		{
			id    : messageId,
			type  : 'get',
			xmlns : 'w',
			to    : this.config.server
		},
		[
			new protocol.Node('props')
		]
	);
	
	this.sendNode(node);
};

/**
 * Request WhatsApp service pricing
 * @param {String}    language    Language code (e.g. 'en')
 * @param {String}    country     Country code (e.g. 'us')
 * @param {PricingCallback}  callback    Called when the pricing is recived
 */
WhatsApi.prototype.requestServicePricing = function(language, country, callback) {	
	var messageId = this.nextMessageId('get_service_pricing_');
	this.addCallback(messageId, callback);
	
	var node = new protocol.Node(
		'iq',
		{
			id    : messageId,
			xmlns : 'urn:xmpp:whatsapp:account',
			type  : 'get',
			to    : this.config.server
		},
		[
			new protocol.Node('pricing', { lg: language || 'en', lc: country || 'us' })
		]
	);
	
	this.sendNode(node);
};
