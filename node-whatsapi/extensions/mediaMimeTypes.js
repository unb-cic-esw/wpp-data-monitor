// Media MIME types submodule
// Includes media types definitions

var MediaType = require('../MediaType.js');
var common = require('../common.js');
var WhatsApi = module.exports = function() {};

WhatsApi.prototype.mediaMimeTypes = {};

WhatsApi.prototype.mediaMimeTypes[MediaType.IMAGE] = {
	size : common.convertMBToBytes(5),
	mime : ['image/png', 'image/jpeg', 'image/jpg']
};

WhatsApi.prototype.mediaMimeTypes[MediaType.VIDEO] = {
	size : common.convertMBToBytes(20),
	mime : ['video/mp4', 'video/quicktime', 'video/x-msvideo']
};

WhatsApi.prototype.mediaMimeTypes[MediaType.AUDIO] = {
	size : common.convertMBToBytes(10),
	mime : [
		'video/3gpp',
		'audio/x-caf',
		'audio/x-wav',
		'audio/mpeg',
		'audio/x-ms-wma',
		'video/ogg',
		'audio/x-aiff',
		'audio/x-aac'
	]
};

WhatsApi.prototype.mediaMimeTypes[MediaType.VCARD] = {
	size : common.convertMBToBytes(10),
	mime : [
	'text/x-vcard',
	'text/directory;profile=vCard',
	'text/directory'
	]
};
