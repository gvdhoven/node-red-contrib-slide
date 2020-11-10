/*jslint node: true */
/*jslint esversion: 6 */
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
		this.closedPosition = n.closedPosition;

		// Create object
		this.localApi = new LocalApi(this.hostname, this.devicecode);
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
		}

		// Set hostname under slide
		if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}

		var node = this;
		node.on('input', (msg, send, done) => {
			node.slide.localApi.getInfo().then(result => {
				blinkStatus(node, true, 'Command OK');
				send({ 'topic': ((node.topic !== '') ? node.topic : 'slide'), 'payload': result });
				done();
			}).catch(e => {
				blinkStatus(node, false, e.title);
				node.warn(e.message);
				send(null);
				done();
			});
		});
	}
	RED.nodes.registerType("slide-get-info", slideGetInfo);



	/**
	 *Set absolute position node
	 *
	 * @param {Node} node The node to create.
	 */
	function slideSetAbsolutePosition(n) {
		RED.nodes.createNode(this, n);
		this.slide = RED.nodes.getNode(n.slide);
		if (!this.slide) {
			return null;
		}

		// Set hostname under slide
		if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}

		var node = this;
		node.on('input', (msg, send, done) => {
			var position = -1;
			if (msg && msg.payload && msg.payload.hasOwnProperty('percent')) {
				position = parseInt(msg.payload.percent);
				if ((position === NaN) || (position < 0) || (position > 100)) {
					position = -1;
				} else  {
					// If still a valid percentage, convert it to a double
					position = (position / 100);
				}
			}

			if (position === -1) {
				blinkStatus(node, false, 'Invalid input');
				node.warn('Please pass a message with a payload which looks like this: { "payload": { "percent": 50 } }');
				send(null);
				done();
			} else {
				node.slide.localApi.setPos(position).then(result => {
					blinkStatus(node, true, 'Command OK');
					send({ 'topic': ((node.topic !== '') ? node.topic : 'slide'), 'payload': result });
					done();
				}).catch(e => {
					blinkStatus(node, false, e.title);
					node.warn(e.message);
					send(null);
					done();
				});
			}
		});
	}
	RED.nodes.registerType("slide-set-absolute-position", slideSetAbsolutePosition);



	/**
	 * Set calibrated position node
	 *
	 * @param {Node} node The node to create.
	 */
	function slideSetCalibratedPosition(n) {
		RED.nodes.createNode(this, n);
		this.slide = RED.nodes.getNode(n.slide);
		if (!this.slide) {
			return null;
		}

		// Set hostname under slide
		if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}

		var node = this;
		node.on('input', (msg, send, done) => {
			var position = -1;
			if (msg && msg.payload && msg.payload.hasOwnProperty('percent')) {
				position = parseInt(msg.payload.percent);
				if ((position === NaN) || (position < 0) || (position > 100)) {
					position = -1;
				} else  {
					// If still a valid percentage, convert it to double, taking into account the a calibrated position
					position = ((node.slide.localApi.closedPosition - node.slide.localApi.openPosition) * (position / 100)) + node.slide.localApi.openPosition;
				}
			}

			if (position === -1) {
				blinkStatus(node, false, 'Invalid input');
				node.warn('Please pass a message with a payload which looks like this: { "payload": { "percent": 50 } }');
				send(null);
				done();
			} else if ((node.slide.localApi.closedPosition - node.slide.localApi.openPosition) < 0 ||
					   (node.slide.localApi.closedPosition <= node.slide.localApi.openPosition)) {
				blinkStatus(node, false, 'Invalid calibration detected.');
				node.warn('Please re-run the calibration procedure.');
				send(null);
				done();
			} else {
				node.slide.localApi.setPos(position).then(result => {
					blinkStatus(node, true, 'Command OK');
					send({ 'topic': ((node.topic !== '') ? node.topic : 'slide'), 'payload': result });
					done();
				}).catch(e => {
					blinkStatus(node, false, e.title);
					node.warn(e.message);
					send(null);
					done();
				});
			}
		});
	}
	RED.nodes.registerType("slide-set-calibrated-position", slideSetCalibratedPosition);



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
		}

		// Set hostname under slide
		if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}

		var node = this;
		node.on('input', (msg, send, done) => {
			node.slide.localApi.open().then(result => {
				blinkStatus(node, true, 'Command OK');
				send({ 'topic': ((node.topic !== '') ? node.topic : 'slide'), 'payload': result });
				done();
			}).catch(e => {
				blinkStatus(node, false, e.title);
				node.warn(e.message);
				send(null);
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
		}

		// Set hostname under slide
		if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}

		var node = this;
		node.on('input', (msg, send, done) => {
			node.slide.localApi.close().then(result => {
				blinkStatus(node, true, 'Command OK');
				send({ 'topic': ((node.topic !== '') ? node.topic : 'slide'), 'payload': result });
				done();
			}).catch(e => {
				blinkStatus(node, false, e.title);
				node.warn(e.message);
				send(null);
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
		}

		// Set hostname under slide
		if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}

		var node = this;
		node.on('input', (msg, send, done) => {
			node.slide.localApi.stop().then(result => {
				blinkStatus(node, true, 'Command OK');
				send({ 'topic': ((node.topic !== '') ? node.topic : 'slide'), 'payload': result });
				done();
			}).catch(e => {
				blinkStatus(node, false, e.title);
				node.warn(e.message);
				send(null);
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
		}

		// Set hostname under slide
		if (!this.slide.localApi.appearsValid()) {
			this.status({ 'fill': 'red', 'shape': 'ring', 'text': 'Invalid config' });
		} else {
			this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });
		}

		var node = this;
		node.on('input', (msg, send, done) => {
			var ssid = '';
			var pass = '';
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
				node.slide.localApi.updateWifi(ssid, pass).then(result => {
					blinkStatus(node, true, 'Command OK');
					send({ 'topic': ((node.topic !== '') ? node.topic : 'slide'), 'payload': result });
					done();
				}).catch(e => {
					blinkStatus(node, false, e.title);
					node.warn(e.message);
					send(null);
					done();
				});
			}
		});
	}
	RED.nodes.registerType("slide-update-wifi", slideUpdateWiFi);



	// HTTP callbacks for config node
	RED.httpAdmin.post('/slide/info', function(req, res) {
		var localApi = new LocalApi(req.body.hostname, req.body.devicecode);
		localApi.getInfo().then(result => {
			res.status(200).send(result);
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});

	RED.httpAdmin.post('/slide/calibrate', function(req, res) {
		var localApi = new LocalApi(req.body.hostname, req.body.devicecode);
		localApi.calibrate().then(result => {
			res.status(200).send(result);
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});

	RED.httpAdmin.post('/slide/open', function(req, res) {
		var localApi = new LocalApi(req.body.hostname, req.body.devicecode, req.body.openPosition, req.body.closePosition);
		localApi.open().then(result => {
			res.status(200).send(result);
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});

	RED.httpAdmin.post('/slide/close', function(req, res) {
		var localApi = new LocalApi(req.body.hostname, req.body.devicecode, req.body.openPosition, req.body.closePosition);
		localApi.close().then(result => {
			res.status(200).send(result);
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});

	RED.httpAdmin.post('/slide/stop', function(req, res) {
		var localApi = new LocalApi(req.body.hostname, req.body.devicecode);
		localApi.stop().then(() => {
			res.status(200).send();
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});
};
