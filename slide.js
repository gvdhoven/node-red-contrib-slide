module.exports = function(RED) {
	"use strict";

	const LocalApi = require('./lib/LocalApi');

	/**
	 * Temporarily updates the node status
	 *
	 * @param {Node} node The node to update the status for.
	 * @param {boolean} ok The result of the call.
	 * @param {string} msg The message to display.
	 */
	function blinkStatus(node, ok, msg) {
		clearTimeout(node.statusTimer);
		node.status({ 'fill': (ok ? 'green' : 'red'), 'shape': 'ring', 'text': msg });
		node.statusTimer = setTimeout(() => {
				if (!node.slide.localApi.appearsValid()) {
					node.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
				} else {
					node.status({ 'fill': 'blue', 'shape': 'ring', 'text': node.slide.hostname });
				}
			}, 3000);
	}

	/**
	 * Helper function to parse a passed float value
	 *
	 * @param {any} value Float to parse
	 * @param {float} fallback Float to return in case parsing failed.
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	function checkFloat(value, fallback) {
		return (/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/.test(value)) ? Number(value) : fallback;
	}

	/**
	 * Helper function to get the right topic for the slide
	 *
	 * @param {object} node Node object
	 * @param {object} msg Input message object
	 * @returns {string} The topic which we should use
	 */
	function getTopic(node, msg) {
		node.topic = (node.topic ? node.topic : '').trim();
		msg.topic = (msg.topic ? msg.topic : '').trim();

		let topic = 'slide';
		if (node.topic !== '') {
			topic = node.topic
		} else {
			if (msg.topic !== '') {
				topic = msg.topic
			}
		}

		return topic;
	}

	/**
	 * Configuration node which holds only the device code.
	 *
	 * @param {Node} node The node to create.
	 */
	function localConf(n) {
		RED.nodes.createNode(this, n);

		// Properties
		this.name = n.name;
		this.hostname = n.hostname;
		this.devicecode = n.devicecode;
		this.openPosition = n.openPosition;
		this.closePosition = n.closePosition;

		// Create object
		this.localApi = new LocalApi(this.hostname, this.devicecode, this.openPosition, this.closePosition);
	}
	RED.nodes.registerType("slide-conf", localConf);



	/**
	 * Get info node.
	 *
	 * @param {Node} node The node to create.
	 */
	function slideGetInfo(n) {
		RED.nodes.createNode(this, n);
		this.slide = RED.nodes.getNode(n.slide);
		if (!this.slide) {
			return null;
		} else if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}
		this.topic = n.topic;

		let node = this;
		node.on('input', (msg, send, done) => {
			blinkStatus(node, true, 'Sending command ...');
			node.slide.localApi.getInfo().then(result => {
				blinkStatus(node, true, 'Command OK');
				send({ 'topic': getTopic(node, msg), 'succeeded': true, 'payload': result });
				done();
			}).catch(e => {
				blinkStatus(node, false, 'Command failed!');
				send({ 'topic': getTopic(node, msg), 'succeeded': false, 'payload': e });
				done();
			});
		});
	}
	RED.nodes.registerType("slide-get-info", slideGetInfo);



	/**
	 * Set position node
	 *
	 * @param {Node} node The node to create.
	 */
	function slideSetPosition(n) {
		RED.nodes.createNode(this, n);
		this.slide = RED.nodes.getNode(n.slide);
		if (!this.slide) {
			return null;
		} else if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}
		this.topic = n.topic;

		let node = this;
		node.on('input', (msg, send, done) => {
			let position = -1;
			if (msg && msg.payload && msg.payload.hasOwnProperty('percent')) {
				let percent = Number(msg.payload.percent);
				if (!isNaN(percent) && ((percent >= 0) && (percent <= 100))) {
					position = (percent / 100);
				}
			}

			if (position === -1) {
				blinkStatus(node, false, 'Invalid input');
				node.warn('Please pass a message with a payload which looks like this: { "payload": { "percent": 50 } }');
				send(null);
				done();
			} else {
				blinkStatus(node, true, 'Sending command ...');
				node.slide.localApi.setPos(position).then(result => {
					blinkStatus(node, true, 'Command OK');
					send({ 'topic': getTopic(node, msg), 'succeeded': true, 'payload': result });
					done();
				}).catch(e => {
					blinkStatus(node, false, 'Command failed!');
					send({ 'topic': getTopic(node, msg), 'succeeded': false, 'payload': e });
					done();
				});
			}
		});
	}
	RED.nodes.registerType("slide-set-position", slideSetPosition);



	/**
	 * Open node.
	 *
	 * @param {Node} node The node to create.
	 */
	function slideOpen(n) {
		RED.nodes.createNode(this, n);
		this.slide = RED.nodes.getNode(n.slide);
		if (!this.slide) {
			return null;
		} else if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}
		this.topic = n.topic;

		let node = this;
		node.on('input', (msg, send, done) => {
			blinkStatus(node, true, 'Sending command ...');
			node.slide.localApi.open().then(result => {
				blinkStatus(node, true, 'Command OK');
				send({ 'topic': getTopic(node, msg), 'succeeded': true, 'payload': result });
				done();
			}).catch(e => {
				blinkStatus(node, false, 'Command failed!');
				send({ 'topic': getTopic(node, msg), 'succeeded': false, 'payload': e });
				done();
			});
		});
	}
	RED.nodes.registerType("slide-open", slideOpen);



	/**
	 * Close node.
	 *
	 * @param {Node} node The node to create.
	 */
	function slideClose(n) {
		RED.nodes.createNode(this, n);
		this.slide = RED.nodes.getNode(n.slide);
		if (!this.slide) {
			return null;
		} else if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}
		this.topic = n.topic;

		let node = this;
		node.on('input', (msg, send, done) => {
			blinkStatus(node, true, 'Sending command ...');
			node.slide.localApi.close().then(result => {
				blinkStatus(node, true, 'Command OK');
				send({ 'topic': getTopic(node, msg), 'succeeded': true, 'payload': result });
				done();
			}).catch(e => {
				blinkStatus(node, false, 'Command failed!');
				send({ 'topic': getTopic(node, msg), 'succeeded': false, 'payload': e });
				done();
			});
		});
	}
	RED.nodes.registerType("slide-close", slideClose);



	/**
	 * Stop node.
	 *
	 * @param {Node} node The node to create.
	 */
	function slideStop(n) {
		RED.nodes.createNode(this, n);
		this.slide = RED.nodes.getNode(n.slide);
		if (!this.slide) {
			return null;
		} else if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}
		this.topic = n.topic;

		let node = this;
		node.on('input', (msg, send, done) => {
			blinkStatus(node, true, 'Sending command ...');
			node.slide.localApi.stop().then(result => {
				blinkStatus(node, true, 'Command OK');
				send({ 'topic': getTopic(node, msg), 'succeeded': true, 'payload': result });
				done();
			}).catch(e => {
				blinkStatus(node, false, 'Command failed!');
				send({ 'topic': getTopic(node, msg), 'succeeded': false, 'payload': e });
				done();
			});
		});
	}
	RED.nodes.registerType("slide-stop", slideStop);




	/**
	 * Updates the slide WiFi
	 *
	 * @param {Node} node The node to create.
	 */
	function slideUpdateWiFi(n) {
		RED.nodes.createNode(this, n);
		this.slide = RED.nodes.getNode(n.slide);
		if (!this.slide) {
			return null;
		} else if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}
		this.topic = n.topic;

		let node = this;
		node.on('input', (msg, send, done) => {
			let ssid = '';
			let pass = '';
			if (msg && msg.payload && msg.payload.hasOwnProperty('ssid') && msg.payload.hasOwnProperty('pass')) {
				ssid = msg.payload.ssid.trim();
				pass = msg.payload.pass.trim();
			}

			if ((ssid === '') || (pass === '')) {
				blinkStatus(node, false, 'Invalid input');
				node.warn('Please pass a message with a payload which looks like this: { "payload": { "ssid": "your_new_ssid", "pass": "your_new_ssid_password" } }');
				send(null);
				done();
			} else {
				blinkStatus(node, true, 'Sending command ...');
				node.slide.localApi.updateWifi(ssid, pass).then(result => {
					blinkStatus(node, true, 'Command OK');
					send({ 'topic': getTopic(node, msg), 'succeeded': true, 'payload': result });
					done();
				}).catch(e => {
					blinkStatus(node, false, 'Command failed!');
					send({ 'topic': getTopic(node, msg), 'succeeded': false, 'payload': e });
					done();
				});
			}
		});
	}
	RED.nodes.registerType("slide-update-wifi", slideUpdateWiFi);



	// HTTP callbacks for config node
	RED.httpAdmin.post('/slide/info', function(req, res) {
		let localApi = new LocalApi(req.body.hostname, req.body.devicecode);
		localApi.getInfo().then(result => {
			res.status(200).send(result);
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});

	RED.httpAdmin.post('/slide/calibrate', function(req, res) {
		let localApi = new LocalApi(req.body.hostname, req.body.devicecode);
		localApi.calibrate().then(result => {
			res.status(200).send(result);
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});

	RED.httpAdmin.post('/slide/open', function(req, res) {
		let localApi = new LocalApi(req.body.hostname, req.body.devicecode, req.body.openPosition, req.body.closePosition);
		localApi.open().then(result => {
			res.status(200).send(result);
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});

	RED.httpAdmin.post('/slide/close', function(req, res) {
		let localApi = new LocalApi(req.body.hostname, req.body.devicecode, req.body.openPosition, req.body.closePosition);
		localApi.close().then(result => {
			res.status(200).send(result);
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});

	RED.httpAdmin.post('/slide/stop', function(req, res) {
		let localApi = new LocalApi(req.body.hostname, req.body.devicecode);
		localApi.stop().then(() => {
			res.status(200).send();
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});
};
