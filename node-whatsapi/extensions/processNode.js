// processNode submodule
// Includes the function for processing the incoming nodes

var fs = require('fs');
var WhatsApi = module.exports = function() {};

/**
 * Process incoming node
 * @param  {Node} node    Node to parse
 * @private
 */
WhatsApi.prototype.processNode = function(node) {
	var nodeId = node.attribute('id');
	
	if (node.isError()) {
		var errorNode = node.child('error');
		var error = {
			code: errorNode.attribute('code'),
			message: errorNode.attribute('text')
		};
		
		if (errorNode.attribute('backoff')) {
			error.backoff = +errorNode.attribute('backoff');
		}
		
		this.executeCallback(nodeId, error, true);
		
		return;
	}
	
	/**
	 * Response error; 'null' means success
	 * @typedef ResponseError
	 * @type {Object}
	 * @property {String} code      Error code
	 * @property {String} message   Error text
	 */
	
	// Got new message, send a 'receipt' node
	if (node.shouldBeReplied() && node.attribute('from') !== this.selfAddress) {
		// Standard receipt
		if (this.config.sendReceipt >= 1) {
			this.sendNode(this.createReceiptNode(node));
		}
		// Read receipt
		if (this.config.sendReceipt == 2) {
			this.sendNode(this.createReceiptNode(node, 'read'));
		}		
	}
	
	// Notification node
	if (node.isNotification()) {
		this.sendNode(this.createNotificationAckNode(node));
		
		this.processNotification(node);
		
		return;
	}
	
	/**
	 * Group object
	 * @typedef Group
	 * @type {Object}
	 * @property {String} id            Group ID
	 * @property {String} creator       JID of the creator. Equal to s.whatsapp.net when the creator is self
	 * @property {Date}   creation      Group creation date
	 * @property {String} subject       Subject (name) of the group
	 * @property {Array<Participant>}  participants  Collection of group participants
	 */
	
	/**
	 * Information about a change in group participants
	 * @typedef ParticipantsChanged
	 * @type {Object}
	 * @property {String} groupId      Group ID
	 * @property {String} action       Action performed: 'add', 'remove', 'promote'(, 'demote')
	 * @property {String} by           JID of the participant who performed the action
	 * @property {Date}   time         When the action has been made
	 * @property {Array<Participant>} participants Collection of group participants involved in the action
	 */
	
	/**
	 * @typedef Participant
	 * @type {Object}
	 * @property {String} jid      User JID
	 * @property {Boolean} admin   Whether the user is admin of the group; 'undefined' when unknown
	 */
	
	// Client received the message
	if (node.isReceipt()) {
		// Reply with ack
		this.sendNode(this.createAckNode(node));
		
		var type = node.attribute('type') || 'received';
		var from = node.attribute('from');
		var time = new Date(+node.attribute('time') * 1000);
		
		var messageIds = [];
		
		// Main ID
		messageIds.push(nodeId);
		
		// Other IDs
		if (node.child('list')) {
			var list = node.child('list');
			for (var i = 0; i < list.children().length; i++) {
				messageIds.push(list.child(i).attribute('id'));
			}
		}
		
		for (var i = 0; i < messageIds.length; i++) {
			var id = messageIds[i];
			
			var args = {
				id: id,
				from: from,
				type: type,
				time: time
			};
			/**
			 * 
			 * Emitted when a client received your message
			 * 
			 * @event clientReceived
			 * @type {Object}
			 * @param {ClientReceived} args    Information about the event
			 */
			this.emit('clientReceived', args);
		}
		
		return;
	}
	
	/**
	 * Client received the message (receipt)
	 * @typedef ClientReceived
	 * @type {Object}
	 * @property {String} id      ID of the involved message
	 * @property {String} from    JID of the user who received the message
	 * @property {String} type    Event type: 'received' or 'read'
	 * @property {Date}   time    Date of the event
	 */
	
	
	// Server received the message
	// And general ack callbacks
	if (node.isAck() || node.isProfilePictureAck() || node.isSetStatusAck()) {
		this.executeCallback(nodeId, []);
		
		return;
	}

	// Authentication
	if (node.isChallenge()) {
		this.sendNode(this.createAuthResposeNode(node.data()));
		this.reader.setKey(this.readerKey);
		this.writer.setKey(this.writerKey);
		return;
	}

	// Successfully logged in
	if (node.isSuccess()) {
		fs.writeFile(this.config.challenge_file, node.data());
		
		//this.initKeys(node.data());
		//this.reader.setKey(this.readerKey);
		this.writer.setKey(this.writerKey);
		
		this.loggedIn = true;
		this.flushQueue();
		this.emit('login');
		this.loginCallback && this.loginCallback();
		return;
	}
	
	// Login failed
	if (node.isFailure()) {
		this.loggedIn = false;
		
		var xml = node.toXml();
		this.emit('error', xml);
		this.loginCallback && this.loginCallback(xml);
		
		return;
	}
	
	// Messages offline count
	if (node.isOfflineCount()) {
		/**
		 * Emitted when the count of messages received while offline is received
		 *
		 * @event offlineCount
		 * @param {Number} count    Count of messages/notifications
		 */
		this.emit('offlineCount', +node.child('offline').attribute('count'));
	}
	
	// Contact presence update
	if (node.isPresence() && node.attribute('from') != this.selfAddress) {
		var type = node.attribute('type') || 'available';
		var who = node.attribute('from');
		if (node.attribute('last') == 'deny') {
			var date = null;
		}
		else {
			var date = new Date(+node.attribute('last') * 1000);
		}
		
		var presence = {
			from: who,
			type: type,
			date: date
		}
		
		/**
		 * Emitted when a presence update node is received
		 * 
		 * @event presence
		 * @param {Presence} presence
		 */
		this.emit('presence', presence);
		return;
	}
	/**
	 * @typedef {Presence}
	 * @type {Object}
	 * @param {String} from    JID of the user
	 * @param {String} type    'available' or 'unavailable'
	 * @param {Date}   date    Last seen date. 'null' if denied
	 */
	
	if (node.isDirty()) {
		this.sendNode(this.createCleanDirtyNode(node));
		return;
	}
	
	// Last seen
	if (node.isLastSeen()) {
		var secondsAgo = +node.child('query').attribute('seconds');
		var millisecondsAgo = millisecondsAgo * 1000;
		var timestamp = Date.now() - millisecondsAgo;
		var date = new Date(timestamp);
		var who = node.attribute('from');
		
		var lastSeen = {
			from: who,
			date: date,
			secondsAgo: secondsAgo / 1000
		}
		
		this.executeCallback(nodeId, lastSeen);
		return;
	}
	/**
	 * @callback LastSeenCallback
	 * @param {ResponseError} err
	 * @param {LastSeen} response
	 */
	/**
	 * @typedef LastSeen
	 * @type {Object}
	 * @property {String} from       User JID
	 * @property {Date}   date       Last seen Date object
	 * @property {Number} secondsAgo
	 */
	
	// Ping/pong
	if (node.isPing()) {
		this.sendNode(this.createPongNode(nodeId));
		return;
	}

	// Groups list response
	if (node.isGroupsList()) {
		var nodes = node.child('groups').children();
				
		var groupsList = nodes.map(function(n) {
			var date = new Date(+n.attribute('creation') * 1000);
			return {
				groupId : n.attribute('id'),
				subject : n.attribute('subject'),
				creationDate : date,
				creator : n.attribute('creator'),
				participants : n.children().map(function(p) {
					return {
						admin : p.attribute('type') == 'admin' ? true : false,
						jid   : p.attribute('jid')
					}
				})
			};
		});
		
		this.executeCallback(nodeId, [groupsList]);
		
		return;
	}
	/**
	 * @callback GroupsListCallback
	 * @param {ResponseError} err
	 * @param {Array<Group>} groupsList
	 */
	
	/**
	 * @typedef {Group}
	 * @type {Object}
	 * @property {String} groupId     Group ID (not JID)
	 * @property {String} subject     Group subject (name)
	 * @property {Date} creationDate  When the group was created
	 * @property {String} creator     JID of the group creator
	 * @property {Array<Participant>} participants    Collection of group participants
	 */
	
	// Group info or group created
	if (node.isGroupInfo() || node.isGroupCreated()) {
		var groupNode = node.child('group');
		
		var date = new Date(+groupNode.attribute('creation') * 1000);
		
		var group = {
			groupId : groupNode.attribute('id'),
			creator : groupNode.attribute('creator'),
			creationDate : date,
			subject : groupNode.attribute('subject'),
			participants : groupNode.children().map(function(p) {
				return {
					admin : p.attribute('type') == 'admin' ? true : false,
					jid   : p.attribute('jid')
				}
			})
		};
		
		this.executeCallback(nodeId, group);
		
		return;
	}
	
	/**
	 * @callback GroupInfoCallback
	 * @param {ResponseError} err
	 * @param {Group} group
	 */
	
	/**
	 * @callback GroupCreatedCallback
	 * @param {ResponseError} err
	 * @param {Group} group
	 */
	
	// Added/removed/promoted/demoted group participants
	if (node.isChangeGroupParticipants()) {
		var child = node.child(0);
		
		var action = child.tag();
		
		var change = child.children().map(function(p) {
			return {
				jid   : p.attribute('jid'),
				error : p.attribute('error') || null
			}
		});
		
		var groupId = this.JIDtoId(node.attribute('from'));
		
		this.executeCallback(nodeId, [action, change, groupId]);
		
		return;
	}
	/**
	 * @callback GroupParticipantsCallback
	 * @param {ResponseError} err
	 * @param {String} action     Action performed (add, remove, promote, demote)
	 * @param {Array<GroupParticipantChange>} change
	 * @param {String} groupId
	 */
	
	/**
	 * @typedef GroupParticipantChange
	 * @property {String} jid     JID of the user
	 * @property {String} error   If something went wrong with the change, the error code; otherwise null
	 */
	
	if (node.isLeaveGroup()) {
		this.executeCallback(nodeId, []);
		
		return;
	}
	/**
	 * @callback GroupLeaveCallback
	 * @param {ResponseError} err
	 */
	
	if (node.isGroupSubjectChanged()) {
		this.executeCallback(nodeId, []);
		
		return;
	}
	/**
	 * @callback GroupSubjectCallback
	 * @param {ResponseError} err
	 */
	
	if (node.isMediaReady()) {
		this.createMediaUploadNode(node, function(err, ackCallback, to, node) {
			if (err) {
				var errObj = {
					code: 100,
					message: err
				};
				ackCallback(errObj);
				return;
			}
			
			this.sendMessageNode(to, node, null, ackCallback); // null message ID
		}.bind(this));
		return;
	}

	if (node.isProfilePicture()) {
		var preview = node.child('picture').attribute('type') == 'preview';
		
		var profileImage = {
			jid : node.attribute('from'), 
			isPreview : preview, 
			pictureData : node.child('picture').data(),
			pictureId : node.child('picture').attribute('id')
		};
		
		this.executeCallback(nodeId, profileImage);
		
		return;
	}
	/**
	 * @callback ProfilePictureCallback
	 * @param {ResponseError} err
	 * @param {ProfilePicture} profilePicture
	 */
	
	/**
	 * @typedef ProfilePicture
	 * @type {Object}
	 * @property {String}  jid         JID of the users the profile picture belongs to
	 * @property {Boolean} isPreview   Is this a preview (true) or the full picture (false)
	 * @property {Buffer}  pictureData Raw picture data
	 * @property {Number}  pictureId   ID from this picture
	 */
	
	// User statuses
	if (node.isGetStatus()) {
		var statusNode = node.child('status');
		
		var statuses = statusNode.children().map(function(s) {
			var date = new Date(+s.attribute('t') * 1000);
			
			return {
				jid : s.attribute('jid'),
				status : s.data().toString('utf8'),
				date : date
			};
		});
		
		this.executeCallback(nodeId, [statuses]);
		
		return;
	}
	/**
	 * @callback StatusCallback
	 * @param {ResponseError} err
	 * @param {Array<Status>} statuses    Array of Status objects
	 */
	
	/**
	 * @typedef Status
	 * @type {Object}
	 * @property {String}  jid      JID of the users the status belongs to
	 * @property {String}  status   Status message (UTF-8)
	 * @property {Date}    date     When the status was set
	 */
	
	// Incoming plain message
	if (node.isMessage()) {
		// Emit stopped typing
		if (node.attribute('type') == 'text') {
			var type = 'paused';
			var from = node.attribute('from');
			var author = node.attribute('participant') || '';
			this.emit('typing', type, from, author);
		}
		
		// Process message
		this.processor.process(node);
		return;
	}
	
	// Emit typing (composing or paused)
	if (node.isTyping()) {
		var from = node.attribute('from');
		var type = node.child(0).tag();
		var author = node.attribute('participant') || '';
		
		/**
		 * Emitted when a contact is writing or stopped writing a message
		 * @event typing
		 * @param {String} type    'composing' or 'paused'
		 * @param {String} from    Contact or group JID
		 * @param {String} author  If 'from' is a group, the actual contact JID
		 */
		this.emit('typing', type, from, author);
		
		return;
	}
	
	// Sync response
	if (node.isSync()) {		
		var sync = node.child('sync');
		var existing = sync.child('in');
		var nonExisting = sync.child('out');
		var invalid = sync.child('invalid');
		
		var existingUsers = [];
		if (existing) {
			for (var i = 0; i < existing.children().length; i++) {
				existingUsers.push(existing.child(i).data().toString());
			}
		}
		
		var nonExistingUsers = [];
		if (nonExisting) {
			for (var i = 0; i < nonExisting.children().length; i++) {
				nonExistingUsers.push(nonExisting.child(i).data().toString());
			}
		}
		
		var invalidNumbers = [];
		if (invalid) {
			for (var i = 0; i < invalid.children().length; i++) {
				invalidNumbers.push(invalid.child(i).data().toString());
			}
		}
		
		var result = {
			existingUsers    : existingUsers,
			nonExistingUsers : nonExistingUsers,
			invalidNumbers   : invalidNumbers
		};
		this.executeCallback(node.attribute('id'), result);
		
		return;
	}
	/**
	 * @callback SyncCallback
	 * @param {ResponseError} err
	 * @param {ContactsSync} result
	 */
	
	/**
	 * @typedef ContactsSync
	 * @type {Object}
	 * @property {Array}  existingUsers       An array of numbers of users that have a WhatsApp account
	 * @property {Array}  nonExistingUsers    An array of numbers of users that don't have a WhatsApp account
	 * @property {Array}  invalidNumbers      An array of numbers that are invalid according to WhatsApp
	 */
	
	// Server properties response
	if (node.isProperties()) {
		var properties = {};
		
		var propElements = node.child('props').children();
		for (var i = 0; i < propElements.length; i++) {
			properties[propElements[i].attribute('name')] = propElements[i].attribute('value');
		}
		
		this.executeCallback(nodeId, properties);
		return;
	}
	
	// Service pricing response
	if (node.isServicePricing()) {
		var pricingNode = node.child('pricing');
		
		var pricing = {
			price: pricingNode.attribute('price'),
			cost: pricingNode.attribute('cost'),
			currency: pricingNode.attribute('currency'),
			expiration: new Date(+pricingNode.attribute('expiration') * 1000)
		};
		
		this.executeCallback(nodeId, pricing);
		return;
	}
	/**
	 * @callback PricingCallback
	 * @param {ResponseError} err
	 * @param {ServicePricing} pricing
	 */
	/**
	 * @typedef ServicePricing
	 * @type {Object}
	 * @property {String} price       Price with currency symbol
	 * @property {String} cost        Price number
	 * @property {String} currency    Currency as string
	 * @property {String} expiration  Expiration date of the pricing
	 */
	
	// Get privacy settings
	if (node.isGetPrivacySettings()) {
		var privacyNode = node.child('privacy');
		
		var settings = {};
		for (var i = 0; i < privacyNode.children().length; i++) {
			var s = privacyNode.child(i);
			settings[s.attribute('name')] = s.attribute('value');
		};
		
		this.emit('privacySettings', settings);
		return;
	}
	
	// Set privacy settings
	if (node.isSendPrivacySettings()) {
		var privacyNode = node.child('privacy');
		
		var settings = {};
		for (var i = 0; i < privacyNode.children().length; i++) {
			var s = privacyNode.child(i);
			settings[s.attribute('name')] = s.attribute('value');
		};
		
		this.emit('privacySettingsUpdated', settings);
		return;
	}
	
	if (node.isAccountExtended()) {
		var accountNode = node.child('extend').child('account');
		
		var accountInfo = {
			kind: accountNode.attribute('kind'),
			status: accountNode.attribute('status'),
			creation: new Date(+accountNode.attribute('creation') * 1000),
			expiration: new Date(+accountNode.attribute('expiration') * 1000)
		};
		
		this.emit('accountExtended', accountInfo);
		
		return;
	}
};

/**
 * Process an incoming notification node
 * @param  {Node} node - Incoming node
 * @private
 */
WhatsApi.prototype.processNotification = function(node) {
	var nodeId = node.attribute('id');
	
	var type = node.attribute('type');
	
	// Group related notification
	if (type == 'w:gp2') {
		this.processGroupNotification(node, nodeId);	
	}
	// Status update
	else if (type == 'status') {
		var not = {
			from: node.attribute('from'),
			value: node.child(0).data().toString()
		};
		
		/**
		 * Fired when a contact's status has changed
		 * @event notificationStatusUpdated
		 * @type {Object}
		 * @param {StatusUpdated} notification
		 * @param {String} nodeId
		 */
		
		/**
		 * @typedef StatusUpdated
		 * @type {Object}
		 * @property {String} from - Involved user jid
		 * @property {String} value - New status value (string)
		 */
		
		this.emit('notificationStatusUpdated', not, nodeId);
	}
	else if (type == 'picture') {
		var not = {
			from: node.attribute('from'),
			action: node.child(0).tag()
		};
		
		/**
		 * Fired when a contact's profile picture has changed
		 * @event notificationPictureUpdated
		 * @type {Object}
		 * @param {PictureUpdated} notification
		 * @param {String} nodeId
		 */
		
		/**
		 * @typedef PictureUpdated
		 * @type {Object}
		 * @property {String} from - Involved user jid
		 * @property {String} action - `set` or `delete`
		 */
		
		this.emit('notificationPictureUpdated', not, nodeId);
	}
};

/**
 * Process a group notification node
 * @param  {Node} node
 * @param  {String} nodeId
 * @private
 */
WhatsApi.prototype.processGroupNotification = function(node, nodeId) {
	var childNode = node.child(0);
	
	var time = new Date(+node.attribute('t') * 1000);
	
	var tag = childNode.tag();
	
	// New group created
	if (tag == 'create') {
		var groupNode = childNode.child(0);
		
		var group = {
			id : groupNode.attribute('id'),
			creator : groupNode.attribute('creator'),
			creation : new Date(+groupNode.attribute('creation') * 1000),
			subject : groupNode.attribute('subject'),
			participants : groupNode.children().map(function(p) {
				return {
					admin : p.attribute('type') == 'admin' ? true : false,
					jid   : p.attribute('jid')
				}
			})
		};
		
		/**
		 * Fired when a new group has been created
		 * @event notificationGroupCreated
		 * @type {Object}
		 * @param {Group} group      Information about the group
		 * @param {String} id        Notification message ID
		 */
		this.emit('notificationGroupCreated', group, nodeId);
	}
	// Actions on participants
	else if (tag == 'add' || tag == 'remove' || tag == 'promote' || tag == 'demote') {
		var args = {
			groupId: this.JIDtoId(node.attribute('from')),
			action: tag,
			by: node.attribute('participant'),
			time: time,
			participants: childNode.children().map(function(p) {
				return {
					admin : undefined,
					jid   : p.attribute('jid')
				}
			})
		};
		
		/**
		 * Fired when a notification about participants is received
		 * @event notificationGroupParticipantsChanged
		 * @type {Object}
		 * @param {ParticipantsChanged} args
		 * @param {String} id Notification message ID
		 */
		this.emit('notificationGroupParticipantsChanged', args, nodeId);
	}
	// Subject changed
	else if (tag == 'subject') {
		var args = {
			groupId : this.JIDtoId(node.attribute('from')),
			action: 'subject',
			by: node.attribute('participant'),
			time: time,
			subject: childNode.attribute('subject')
		};
		
		/**
		 * Fired when group subject has changed
		 * @event notificationGroupSubjectChanged
		 * @type {Object}
		 * @param {SubjectChanged} args
		 * @param {String} id Notification message ID
		 */
		this.emit('notificationGroupSubjectChanged', args, nodeId);
	}
};

/**
 * Convert a group JID to ID only
 * @param {String} jid
 */
WhatsApi.prototype.JIDtoId = function(jid) {
	return jid.split('@')[0];
};
