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
				node.status({ 'fill': 'blue', 'shape': 'ring', 'text': node.slide.hostname });
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
	function getInfo(n) {
		RED.nodes.createNode(this, n);
		this.slide = RED.nodes.getNode(n.slide);
		if (!this.slide) {
			return null;
		}

		// Set hostname under slide
		this.status({ 'fill': 'blue', 'shape': 'ring', 'text': this.slide.hostname });

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
	RED.nodes.registerType("slide-get-info", getInfo);


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

	RED.httpAdmin.post('/slide/position', function(req, res) {
		var localApi = new LocalApi(req.body.hostname, req.body.devicecode, req.body.openPosition, req.body.closePosition);
		localApi.setPos(req.body.pos).then(result => {
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
		localApi.stop().then(result => {
			res.status(200).send();
		}).catch(e => {
			res.status(e.code).send(e);
		});
	});
};
