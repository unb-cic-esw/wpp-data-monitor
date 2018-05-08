// Media submodule
// Includes internal functions for managing media

var MediaType = require('../MediaType.js');
var ImageTools = require('../ImageTools.js');
var protocol = require('../protocol.js');
var path = require('path');
var crypto = require('crypto');
var http = require('http');
var https = require('https');
var tls = require('tls');
var jimp = require('jimp');
var gm = require('gm');
var url = require('url');
var mime = require('mime');
var fs = require('fs');
var tmp = require('tmp');

var WhatsApi = module.exports = function() {};

/* @private */
WhatsApi.prototype.createRequestMediaUploadNode = function(filehash, filetype, filesize, filepath, to, caption, msgid, callback) {
	var attributes = {
		hash  : filehash,
		type  : filetype,
		size  : filesize.toString()
	};

	var mediaNode = new protocol.Node('media', attributes);

	var iqAttributes = {
		id   : msgid || this.nextMessageId('upload'),
		to   : this.config.server,
		type : 'set',
		xmlns : 'w:m'
	};

	this.mediaQueue[iqAttributes.id] = {
		filepath : filepath,
		filesize : filesize,
		to       : to,
		from     : this.config.msisdn,
		callback : callback
	};
	if(caption && caption.length) this.mediaQueue[iqAttributes.id].caption = caption;

	return new protocol.Node('iq', iqAttributes, [mediaNode]);
};

WhatsApi.prototype.createMediaUploadNode = function(node, callback) {
	var id = node.attribute('id');

	if (!this.mediaQueue.hasOwnProperty(id)) {
		return;
	}
	
	var queued = this.mediaQueue[id];
	delete this.mediaQueue[id];
	
	var attributes = {
		xmlns : 'urn:xmpp:whatsapp:mms'
	};
	if (queued.caption) attributes.caption = queued.caption;
	
	var ackCallback = queued.callback;
	
	var onAttributesReady = function(url, type, size, file) {
		attributes.url  = url;
		attributes.type = type;
		attributes.size = size;
		attributes.file = file;

		var onThumbReady = function(err, data) {			
			if (err) {
				callback(err, ackCallback);
				return;
			}

			callback(null, ackCallback, queued.to, new protocol.Node('media', attributes, null, data));
		};

		if (type === MediaType.IMAGE) {
			this.createImageThumbnail(queued.filepath, onThumbReady);
			return;
		}

		if (type === MediaType.VIDEO) {
			this.createVideoThumbnail(queued.filepath, onThumbReady);
			return;
		}

		// No thumbnail needed for other media types
		onThumbReady(null, '');
	}.bind(this);

	var duplicate = node.child('duplicate');

	if (duplicate) {
		onAttributesReady(
			duplicate.attribute('url'),
			duplicate.attribute('type'),
			duplicate.attribute('size'),
			duplicate.attribute('url').replace(/(?:.*\/|^)([^\/]+)$/, '$1')
		);
	} else {
		this.uploadMediaFile(queued, node.child('media').attribute('url'), function(err, response) {
			if (err) {
				callback(err, ackCallback);
				return;
			}

			onAttributesReady(response.url, response.type, response.size, response.name);
		});
	}
};

WhatsApi.prototype.getMediaFile = function(filepath, filetype, callback) {
	if(!this.mediaMimeTypes.hasOwnProperty(filetype)) {
		callback('Invalid file type: ' + filetype);
		return;
	}

	var onFileReady = function(path) {
		var mimeType = mime.lookup(path);

		if(this.mediaMimeTypes[filetype].mime.indexOf(mimeType) === -1) {
			callback('Invalid file mime type: ' + mimeType);
			return;
		}

		var fileSize = fs.statSync(path).size;
		var maxSize  = this.mediaMimeTypes[filetype].size;

		if(maxSize < fileSize) {
			callback('Media file too big (max size is ' + maxSize + '; file size is ' + fileSize + ')');
			return;
		}

		callback(null, path);
	}.bind(this);

	fs.exists(filepath, function(result) {
		if(result) {
			onFileReady(filepath);
			return;
		}

		var parsed = url.parse(filepath);

		if(!parsed.host) {
			callback('Given path is neither an existing file nor a valid URL');
			return;
		}

		this.downloadMediaFile(filepath, function(err, path) {
			if(err) {
				callback(err);
			} else {
				onFileReady(path);
			}
		});
	}.bind(this));
};

WhatsApi.prototype.downloadMediaFile = function(destUrl, callback) {
	var match = destUrl.match(/\.[^\/.]+$/);

	var ext = match ? match[0] : '';

	var schema = url.parse(destUrl).protocol;

	var reqObj = schema === 'https:' ? https : http;

	reqObj.get(destUrl, function(res) {
		if(res.statusCode != 200){
			if( res.statusCode == 302 && res.headers && res.headers.location){
				return this.downloadMediaFile( res.headers.location, callback);
			}
			callback('Error downloading the file. HTTP 200 or 302 reponse expected, but received: ' + res.statusCode);
		}
		
		var buffers = [];
		res.on('data', function(data) {
			buffers.push(data);
		});
		
		res.on('error', function(err){
			callback('Error downloading data: ' + err);
		});
		
		res.on('close', function(had_error){
			if (had_error){
				callback('Error occured while downloading data');
			}
		});

		res.on('end', function() {
			if (ext) {
				ext = '.' + ext;
			}
			tmp.file({ prefix: 'media-', postfix: ext }, function(err, filePath, fd) {
				if (err) {
					return callback('Error creating temporary file: ' + err);
				}

				fs.writeFile(filePath, Buffer.concat(buffers), function(err) {
					if (err) {
						callback('Error saving downloaded file: ' + err);
					} else {
						callback(null, filePath);
					}
				});
			});
		});
	}.bind(this)).on('error', function(e) {
		callback('Error downloading the file. HTTP error: ' + e.message);
	});
};

WhatsApi.prototype.uploadMediaFile = function(queue, destUrl, callback) {
	var type       = mime.lookup(queue.filepath);
	var ext        = mime.extension(type);
	var boundary   = 'zzXXzzYYzzXXzzQQ';
	var filename   = crypto.createHash('md5').update(queue.filepath).digest('hex') + '.' + ext;
	var host       = url.parse(destUrl).hostname;
	var contentLen = 0;

	var post = [
		'--' + boundary,
		'Content-Disposition: form-data; name="to"\r\n',
		this.createJID(queue.to),
		'--' + boundary,
		'Content-Disposition: form-data; name="from"\r\n',
		queue.from,
		'--' + boundary,
		'Content-Disposition: form-data; name="file"; filename="' + filename + '"',
		'Content-Type: ' + type + '\r\n'
	];

	var end = '\r\n--' + boundary + '--\r\n';

	post.forEach(function(str) {
		contentLen += str.length + 2;
	});

	contentLen += queue.filesize + end.length;

	var headers = [
		'POST ' + destUrl,
		'Content-Type: multipart/form-data; boundary=' + boundary,
		'Host: ' + host,
		'User-Agent: ' + this.config.ua,
		'Content-Length: ' + contentLen + '\r\n'
	];

	var options = {
		port : 443,
		host : host,
		rejectUnauthorized : false
	};

	var tlsStream = tls.connect(options, function() {
		headers.forEach(function(str) {
			tlsStream.write(str + '\r\n');
		});

		post.forEach(function(str) {
			tlsStream.write(str + '\r\n');
		});

		var filestream = fs.createReadStream(queue.filepath);

		filestream.pipe(tlsStream, {end : false});

		filestream.on('end', function() {
			tlsStream.write(end);
		});
	});

	tlsStream.on('error', function(err) {
		callback('SSL/TLS error: ' + err);
	}.bind(this));

	var buffers = [];

	tlsStream.on('data', function(data) {
		buffers.push(data);
	});

	tlsStream.on('end', function() {
		var result = Buffer.concat(buffers).toString();

		try {
			callback(null, JSON.parse(result.split('\r\n\r\n').pop()));
		} catch(e) {
			callback('Unexpected upload response: ' + result);
		}
	});
};

WhatsApi.prototype.createImageThumbnail = function(srcPath, callback) {
	var dstPath = srcPath.replace(/^(.*?)(\.[^.]+$|$)/, '$1-thumb$2');

	try {
		if (this.config.imageTool == ImageTools.JIMP) {
			var image = new jimp(srcPath, function() {
				try {
					// Crop
					if (this.bitmap.width > this.bitmap.height) {
						var x1 = (this.bitmap.width - this.bitmap.height) / 2;
						var x2 = this.bitmap.width - x1;
						var y1 = 0;
						var y2 = this.bitmap.height;
						
						this.crop(x1, y1, x2, y2);
					}
					else if (this.bitmap.height > this.bitmap.width) {
						var x1 = 0;
						var x2 = this.bitmap.width;
						var y1 = (this.bitmap.height - this.bitmap.width) / 2;
						var y2 = this.bitmap.height - y1;
						
						this.crop(x1, y1, x2, y2);
					}
					
					this.quality(80);
					this.resize(96, 96);
					this.getBuffer(mime.lookup(srcPath), function(err, buffer) {
						if (err) {
							callback('Error occured while generating thumbnail, using Jimp. ' + err.message);
							return;
						}
						callback(null, buffer.toString('base64'));
					});
					this.write(dstPath); // save, just for log
				}
				catch (e) {
					callback('Error occured while generating thumbnail, using Jimp. ' + e.message);
				}
			});
		}
		else {
			if (this.config.imageTool == ImageTools.IMAGEMAGICK) {
				var options = { imageMagick: true };
			}
			else if (this.config.imageTool == ImageTools.GRAPHICSMAGICK) {
				var options = { imageMagick: false };
			}
			else {
				callback('Invalid image tool chosen for generating thumbnail');
				return;
			}
			
			// Correct configuration from http://stackoverflow.com/a/25083756/1633924
			gm(srcPath)
				.options(options)
				.quality(80)
				.resize(96, 96, '^')
				.gravity('Center')
				.crop(96, 96)
				.toBuffer(function(err, buffer) {
					if (err) callback('Error occured while generating thumbnail, using GM. ' + JSON.stringify(err));
					callback(null, buffer.toString('base64'));
				})
				.write(dstPath, function() {});
		}
	} catch(e) {
		callback('Unexpected error while generating thumbnail: ' + e.message);
	}
};

WhatsApi.prototype.createVideoThumbnail = function(srcPath, callback) {
	callback(null, '/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAABQAAD/4QMpaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjAtYzA2MCA2MS4xMzQ3NzcsIDIwMTAvMDIvMTItMTc6MzI6MDAgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDUzUgV2luZG93cyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDo2MTQyRUVCOEI3MDgxMUUyQjNGQkY1OEU5M0U2MDE1MyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDo2MTQyRUVCOUI3MDgxMUUyQjNGQkY1OEU5M0U2MDE1MyI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjYxNDJFRUI2QjcwODExRTJCM0ZCRjU4RTkzRTYwMTUzIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjYxNDJFRUI3QjcwODExRTJCM0ZCRjU4RTkzRTYwMTUzIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+/+4ADkFkb2JlAGTAAAAAAf/bAIQAAgICAgICAgICAgMCAgIDBAMCAgME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');
};
