var util = require('util');

function Abstract() {}

Abstract.prototype.setAdapter = function(adapter) {
	this.adapter = adapter;
};

Abstract.prototype.match = function() {
	return false;
};

function Aggregate(list) {
	this.list = list;
}

Aggregate.prototype.setAdapter = function(adapter) {
	this.adapter = adapter;

	this.list.forEach(function(processor) {
		processor.setAdapter(adapter);
	}, this);
};

Aggregate.prototype.process = function(node) {
	this.list.forEach(function(processor) {
		if(processor.match(node)) {
			processor.process(node);
		}
	}, this);
};

function Text() {}

util.inherits(Text, Abstract);

Text.prototype.match = function(node) {
	return node.attribute('notify') && node.attribute('type') == 'text'
		&& node.child('body');
};

Text.prototype.process = function(node) {
	var message = {
		body    : node.child('body').data().toString('utf8'),
		from    : node.attribute('from'),
		id      : node.attribute('id'),
		date    : new Date(+node.attribute('t') * 1000),
		notify  : node.attribute('notify'),
		author  : node.attribute('participant') || '',
		isGroup : node.attribute('from').indexOf('g.us') != -1 ? true : false
	};
	
	/**
	 * 
	 * receivedMessage - emitted when a new text message is received
	 * 
	 * @event receivedMessage
	 * @property {Message} message     Message object
	 */
	this.adapter.emit('receivedMessage', message);
};

/**
 * @typedef Message
 * @type {Object}
 * @property {String} body      UTF-8 decoded body text message
 * @property {String} from      Sender JID
 * @property {String} author    If `from` is a group ID, this is the real sender JID
 * @property {String} id        Message ID
 * @property {Date}   date      Message date/time
 * @property {String} notify
 * @property {Boolean} isGroup  Whether the message comes from a group or not
 */

function Location() {}

util.inherits(Location, Abstract);

Location.prototype.match = function(node) {
	return node.attribute('notify') && node.child('media')
		&& node.child('media').attribute('type') == 'location';
};

Location.prototype.process = function(node) {
	var location = node.child('media');

	/**
	 * 
	 * receivedLocation - emitted when a location message is received
	 * 
	 * @event receivedLocation
	 * @type {object}
   * @property {Location} location Location object
	 * @example
	 * wa.on('receivedLocation', function(location){
	 *   console.log(
	 *     "Received location:\n From: %s\n id: %s\n date: %s\n notify: %s\n latitude: %d\n longitude: %s\n name: %s \n url: %s",
	 *     location.from, location.id, location.date.toString(), location.notify, location.latitude, location.longitude, location.name, location.url
	 *   );
	 *   fs.writeFile('whatsapi/media/location-'+location.latitude+'-'+location.longitude+'-thumb.jpg', location.thumbData);
	 * });
	 */
	this.adapter.emit(
		'receivedLocation',{
			from       : node.attribute('from'),
			id         : node.attribute('id'),
			date       : new Date(+node.attribute('t') * 1000),
			notify     : node.attribute('notify'),
			latitude   : +location.attribute('latitude'),
			longitude  : +location.attribute('longitude'),
			name       : location.attribute('name'),
			url        : location.attribute('url'),
			thumbData  : location.data(),
			author     : node.attribute('participant') || '',
			isGroup    : node.attribute('from').indexOf('g.us') != -1 ? true : false
		}
	);
};
/**
 * @typedef Location
 * @type {Object}
 * @property {String} from       Sender JID
 * @property {String} id         Message ID
 * @property {Date}   date       Message date/time
 * @property {String} notify
 * @property {Number} latitude
 * @property {Number} longitude
 * @property {String} name       Name of the place
 * @property {String} url        URL of the place
 * @property {Buffer} thumbData  Raw body (thumbnail of the map)
 * @property {String} author     If the message comes from a group, the real sender jid
 * @property {Boolean} isGroup   Whether the message comes from a group or not
 */

function Media() {}

util.inherits(Media, Abstract);

Media.prototype.match = function(node) {
	return node.attribute('notify') &&
		   node.child('media') &&
		   node.child('media').attribute('type') === this.type;
};

function Image() {
	this.type = 'image';
}

util.inherits(Image, Media);

Image.prototype.process = function(node) {
	var image = node.child('media');

	/**
	 * Is fired when an image is received
	 *  
	 * @event receivedImage
	 * @property {Image} image Image object
	 * @example
	 * wa.on('receivedImage', function(image){
	 *   console.log(
	 *     "Received image:\n From: %s\n id: %s\n date: %s\n notify: %s\n size: %d bytes\n url: %s\n caption: %s \n file: %s\n encoding: %s\n ip: %s\n mimetype: %s\n filehash: %s\n width: %d px\n height: %d px",
	 *     image.from, image.id, image.date.toString(), image.notify, image.size, image.url, image.caption, image.file, image.encoding, image.ip, image.mimetype, image.filehash, image.width, image.height
	 *   );
	 *   fs.writeFile('whatsapi/media/image-'+image.from+'-'+image.file+'-thumb.jpg', image.thumbData); 
	 *   wa.downloadMediaFile(image.url,function(err,path){
	 *     if(err){
	 *       console.log('error storing file: ' + err);
	 *     }else{
	 *       console.log('file downloaded at: '+ path);
	 *     }
	 *   });
	 * });
	 */			
	this.adapter.emit(
		'receivedImage',{
			from       : node.attribute('from'),
			id         : node.attribute('id'),
			date       : new Date(+node.attribute('t') * 1000),
			notify     : node.attribute('notify'),
			size       : +image.attribute('size'),
			url        : image.attribute('url'),
			caption    : image.attribute('caption') || '',
			file       : image.attribute('file'),
			encoding   : image.attribute('encoding'),
			ip         : image.attribute('ip'),
			mimetype   : image.attribute('mimetype'),
			filehash   : image.attribute('filehash'),
			width      : +image.attribute('width'),
			height     : +image.attribute('height'),
			thumbData  : image.data(),
			author     : node.attribute('participant') || '',
			isGroup    : node.attribute('from').indexOf('g.us') != -1 ? true : false
		}
	);
};
/**
 * @typedef Image
 * @type {Object}
 * @property {String} from
 * @property {String} id
 * @property {Date}   date      Message date/time
 * @property {String} notify
 * @property {Number} size
 * @property {String} url
 * @property {String} caption
 * @property {String} file
 * @property {String} encoding
 * @property {String} ip
 * @property {String} mimetype
 * @property {String} filehash
 * @property {Number} width
 * @property {Number} height
 * @property {Buffer} thumbData
 * @property {String} author     If the message comes from a group, the real sender jid
 * @property {Boolean} isGroup   Whether the message comes from a group or not
 */

function Video() {
	this.type = 'video';
}

util.inherits(Video, Media);

/**			
 * Is fired when a video is received
 *  
 * @event receivedVideo
 * @property {Video} video     Video object
 * @example
 * wa.on('receivedVideo', function(video){
 * console.log(
 *     "Received video:\n from: %s \n id: %s\n date: %s\n notify: %s\n url: %s \n caption: %s \n seconds: %s \n file: %s \n encoding: %s \n size: %s bytes\n ip: %s \n mimetype: %s \n filehash: %s \n duration: %s sec\n vcodec: %s \n width: %s px\n height: %s px\n fps: %s \n vbitrate: %s bit/s\n acodec: %s \n asampfreq: %s \n asampfmt: %s \n abitrate %s bit/s",
 *     video.from, video.id, video.date.toString(), video.notify, video.url, video.caption, video.seconds, video.file, video.encoding, video.size, video.ip, video.mimetype, video.filehash, video.duration, video.vcodec, video.width, video.height, video.fps, video.vbitrate, video.acodec, video.asampfreq, video.asampfmt, video.abitrate
 *   );
 *   fs.writeFile('whatsapi/media/video-'+video.from+'-'+video.file+'-thumb.jpg', video.thumbData); 
 *   wa.downloadMediaFile(video.url, function(err, path){
 *     if(err){
 *       console.log('error storing file: ' + err);
 *     }else{
 *       console.log('file downloaded at: '+ path);
 *     }
 *   });
 * });
 */

Video.prototype.process = function(node) {
	var video = node.child('media');

	this.adapter.emit(
		'receivedVideo',{
			from       : node.attribute('from'),
			id         : node.attribute('id'),
			date       : new Date(+node.attribute('t') * 1000),
			notify     : node.attribute('notify'),
			url        : video.attribute('url'),
			caption    : video.attribute('caption') || '',
			seconds    : +video.attribute('seconds'),
			file       : video.attribute('file'),
			encoding   : video.attribute('encoding'),
			size       : +video.attribute('size'),
			ip         : video.attribute('ip'),
			mimetype   : video.attribute('mimetype'),
			filehash   : video.attribute('filehash'),
			duration   : +video.attribute('duration'),
			vcodec     : video.attribute('vcodec'),
			width      : +video.attribute('width'),
			height     : +video.attribute('height'),
			fps        : +video.attribute('fps'),
			vbitrate   : +video.attribute('vbitrate'),
			acodec     : video.attribute('acodec'),
			asampfreq  : +video.attribute('asampfreq'),
			asampfmt   : video.attribute('asampfmt'),
			abitrate   : +video.attribute('abitrate'),
			thumbData  : video.data(),
			author     : node.attribute('participant') || '',
			isGroup    : node.attribute('from').indexOf('g.us') != -1 ? true : false
		}
	);
};

/**
 * @typedef Video
 * @type {Object}
 * @property {String} from
 * @property {String} id
 * @property {Date}   date      Message date/time
 * @property {String} notify
 * @property {String} url
 * @property {String} caption
 * @property {Number} seconds
 * @property {String} file
 * @property {String} encoding
 * @property {Number} size
 * @property {String} ip
 * @property {String} mimetype
 * @property {String} filehash
 * @property {Number} duration
 * @property {String} vcodec
 * @property {Number} width
 * @property {Number} height
 * @property {Number} fps
 * @property {Number} vbitrate
 * @property {String} acodec
 * @property {Number} asampfreq
 * @property {String} asampfmt
 * @property {Number} abitrate
 * @property {Buffer} thumbData
 * @property {String} author     If the message comes from a group, the real sender jid
 * @property {Boolean} isGroup   Whether the message comes from a group or not
 */

function Audio() {
	this.type = 'audio';
}

util.inherits(Audio, Media);

Audio.prototype.process = function(node) {
	var audio = node.child('media');

/**
 *  Is fired when an audio file is received
 *  
 * @event receivedAudio
 * @property {Audio} audio Audio object
 * @example
 * wa.on('receivedAudio', function(audio){
 *   console.log(
 *     "Received audio:\n from: %s\n id: %s\n date: %s\n notify: %s\n seconds: %s\n size: %s\n url: %s\n file: %s\n origin: %s\n ip: %s\n mimetype: %s\n filehash: %s\n duration: %s sec\n acodec: %s\n asampfreq: %s\n abitrate: %s kbit/s",
 *     audio.from, audio.id, audio.date.toString(), audio.notify, audio.seconds, audio.size, audio.url, audio.file, audio.origin, audio.ip, audio.mimetype, audio.filehash, audio.duration, audio.acodec, audio.asampfreq, audio.abitrate
 *   );
 *   wa.downloadMediaFile(audio.url, function(err,path){
 *     if(err){
 *       console.log('error storing file: ' + err);
 *     }else{
 *       console.log('file downloaded at: '+ path);
 *     }
 *   });
 * });
 */
	this.adapter.emit(
		'receivedAudio',{
			from       : node.attribute('from'),
			id         : node.attribute('id'),
			date       : new Date(+node.attribute('t') * 1000),
			notify     : node.attribute('notify'),
			seconds    : +audio.attribute('seconds'),
			size       : +audio.attribute('size'),
			url        : audio.attribute('url'),
			file       : audio.attribute('file'),
			origin     : audio.attribute('origin') || '',
			ip         : audio.attribute('ip'),
			mimetype   : audio.attribute('mimetype'),
			filehash   : audio.attribute('filehash'),
			duration   : +audio.attribute('duration'),
			acodec     : audio.attribute('acodec'),
			asampfreq  : +audio.attribute('asampfreq'),
			abitrate   : +audio.attribute('abitrate'),
			author     : node.attribute('participant') || '',
			isGroup    : node.attribute('from').indexOf('g.us') != -1 ? true : false
		}
	);
};
/**
 * @typedef Audio
 * @type {Object}
 * @property {String} from
 * @property {String} id
 * @property {Date}   date      Message date/time
 * @property {String} notify
 * @property {Number} seconds
 * @property {Number} size
 * @property {String} url
 * @property {String} file
 * @property {String} origin
 * @property {String} ip
 * @property {String} mimetype
 * @property {String} filehash
 * @property {Number} duration
 * @property {String} acodec
 * @property {Number} asampfreq
 * @property {Number} abitrate
 * @property {String} author     If the message comes from a group, the real sender jid
 * @property {Boolean} isGroup   Whether the message comes from a group or not
 */


function Vcard() {
	this.type = 'vcard';
}

util.inherits(Vcard, Media);

Vcard.prototype.process = function(node) {
	var vcard = node.child('media').child('vcard');

	/**			
	* Is fired when a vCard file is received
	*  
	* @event receivedVcard
	* @property {Vcard} vcard vCard object
	* @example
	* wa.on('receivedVcard', function(vcard){
	*   console.log(
	*     "Received vCard:\n From: %s\n id: %s\n date: %s\n notify: %s\n name: %s",
	*     vcard.from, vcard.id, vcard.date.toString(), vcard.notify, vcard.name
	*   );
	*   fs.writeFile('whatsapi/media/vcard-'+vcard.from+'-'+vcard.name+'.vcard', vcard.vcardData);
  * });
	*/		
	this.adapter.emit(
		'receivedVcard',{
			from       : node.attribute('from'),
			id         : node.attribute('id'),
			date       : new Date(+node.attribute('t') * 1000),
			notify     : node.attribute('notify'),
			name       : vcard.attribute('name'),
			vcardData  : vcard.data(),
			author     : node.attribute('participant') || '',
			isGroup    : node.attribute('from').indexOf('g.us') != -1 ? true : false
		}
	);
};
/**
 * @typedef Vcard
 * @type {Object}
 * @property {String} from
 * @property {String} id
 * @property {Date}   date      Message date/time
 * @property {String} notify
 * @property {String} name
 * @property {Buffer} vcardData
 * @property {String} author     If the message comes from a group, the real sender jid
 * @property {Boolean} isGroup   Whether the message comes from a group or not
 */

function createProcessor() {
	return new Aggregate([new Text, new Location, new Image, new Video, new Audio, new Vcard]);
}

exports.createProcessor = createProcessor;
