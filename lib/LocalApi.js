/*jslint node: true */
/*jslint esversion: 6 */
"use strict";

/**
 * Module dependencies.
 */
const DigestFetch = require('digest-fetch');


/**
 * Slide Local API class
 */
class LocalApi {
	/**
	 * Constructor of the local API.
	 *
	 * @param {string} hostname IP address of the slide on the local network
	 * @param {string} devicecode Devicecode which can be found on top of the slide.
	 * @param {double} openPosition Position in which the Slide is when opened.
	 * @param {double} closePosition Position in which the Slide is when closed.
	 */
	constructor(hostname, devicecode, openPosition=0.0, closedPosition=1.0) {
		this.hostname = ((hostname !== '') ? hostname : '').trim();
		this.devicecode = ((devicecode !== '') ? devicecode : '').trim();

		openPosition = this.parseFloat(openPosition, 0.0);
		if (openPosition < 0) {
			openPosition = 0.0;
		} else if (openPosition > 1) {
			openPosition = 1.0;
		}
		this.openPosition = openPosition;

		closedPosition = this.parseFloat(closedPosition, 1.0);
		if (closedPosition < 0) {
			closedPosition = 0.0;
		} else if (closedPosition > 1) {
			closedPosition = 1.0;
		}
		this.closedPosition = closedPosition;
	}

	/**
	 * Helper function to parse a passed float value
	 * @param {any} value Float to parse
	 * @param {float} fallback Float to return in case parsing failed.
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	parseFloat(value, fallback) {
  		return (/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/.test(value)) ? Number(value) : fallback;
	}

	/**
	 * Makes an async request using Digest authentication towards the specified hostname.
	 *
	 * @param {string} path Path of URL to call.
	 * @param {string} body (optional) JSON body.
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	request(path, body='') {
		return new Promise((resolve, reject) => {
			if ((this.hostname === '') || (this.devicecode === '')) {
				reject({ 'code': 400, 'title': 'Incomplete configuration', 'message': 'Please enter both a hostname and a devicecode in order to control the Slide.' });
			} else {
				const url = ((this.hostname.indexOf('://') === -1) ? 'http://' + this.hostname : this.hostname) + path;
				const options = {
					'method': 'POST',
					'headers': {
						'Content-Type': 'application/json'
					},
					'body': ((body !== '') ? JSON.stringify(body) : '')
				};
				const client = new DigestFetch('user', this.devicecode, { algorithm: 'MD5' });
				client.fetch(url, options)
					.then(res => {
						if (res.ok) {
							return res.json();
						} else {
							if (res.statusText === 'Unauthorized') {
								reject({ 'code': 401, 'title': 'Invalid device code', 'message': 'The Slide at hostname "' + this.hostname +'" rejected device code "' + this.devicecode + '".' });
							} else {
								reject({ 'code': 400, 'title': res.statusText, 'message': 'The Slide at hostname "' + this.hostname +'" with device code "' + this.devicecode + '" gave an unclear response.' });
							}
						}
					})
					.then(json => {
						resolve(json);
					})
					.catch((e) => {
						if (e.errno && e.errno === 'ECONNREFUSED') {
							reject({ 'code': 404, 'title': 'Unable to connect', 'message': 'The Slide at hostname "' + this.hostname +'" with device code "' + this.devicecode + '" is unresponsive.' });
						} else {
							reject({ 'code': 500, 'title': 'Unkown error occured', 'message': e });
						}
					});
			}
		});
	}

	/**
	 * Sleep function
	 *
	 * @param {int} ms Milliseconds to sleep
	 * @returns {Promise} Promise object representing the timer
	 */
	sleep(ms) {
	  return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Determines the current position of the curtain and then issues a setPos command. When the position does not change anymore, assumes success.
	 *
	 * @returns {double} Last reported position
	 */
	async waitUntilPosition() {
		// The loop to rule them all
		var lastPos = -1;
		var currPos;
		while (true) {
			await this.sleep(1000);
			var result = await this.getInfo();
			var currPos = result.pos;
			console.log(currPos);

			if (lastPos != -1) {
				if (currPos == lastPos) {
					// We wait for a while to let the Slide stop and take a break etc.
					await this.sleep(3000);
					break;
				}
			}
			lastPos = currPos;
		}

		return { 'response': 'success', 'pos': currPos };
	}

	/**
	 * Gets information from the Slide.
	 *
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	getInfo() {
		return this.request('/rpc/Slide.GetInfo');
	}

	/**
	 * Recalibrates the Slide.
	 *
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	calibrate() {
		return new Promise((resolve, reject) => {
			this.request('/rpc/Slide.Calibrate')
				.then(() => {
					resolve(this.waitUntilPosition());
				})
				.catch(e => reject(e));
		});
	}

	/**
	 * Updates the curtain position of the slide.
	 *
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	async setPos(pos) {
		var result = await this.getInfo();
		var currPos = result.pos;
		return new Promise((resolve, reject) => {
			pos = this.parseFloat(pos, -1);
			if (pos === -1) {
				reject({ 'code': 422, 'title': 'Invalid position passed', 'message': 'Please pass a float between 0.0 and 1.0 as the new position.' })
			} else if (currPos === pos) {
				resolve({ 'response': 'success', 'pos': currPos });
			} else {
				this.request('/rpc/Slide.SetPos', { 'pos': pos })
					.then(() => { resolve(this.waitUntilPosition()); })
					.catch(e => reject(e));
			}
		});
	}

	/**
	 * Stops the motor of the Slide.
	 *
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	stop() {
		return this.request('/rpc/Slide.Stop');
	}

	/**
	 * Updates the WiFi configuration of the slide.
	 *
	 * @param {string} ssid The new SSID to connect to.
	 * @param {string} pass THe new SSID password to use.
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	updateWifi(ssid, pass) {
		return this.request('/rpc/Slide.Config.WiFi', { 'ssid': ssid, 'pass': pass });
	}

	/**
	 * Sends an open command to the Slide.
	 *
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	async open() {
		return this.setPos(this.openPosition);
	}

	/**
	 * Sends an close command to the Slide.
	 *
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	async close() {
		return this.setPos(this.closedPosition);
	}

}

module.exports = LocalApi;
