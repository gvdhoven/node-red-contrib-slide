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
	constructor(hostname, devicecode, openPosition=0.0, closePosition=1.0) {
		this.hostname = ((hostname !== '') ? hostname : '').trim();
		this.devicecode = ((devicecode !== '') ? devicecode : '').trim();

		openPosition = this.parseFloat(openPosition, 0.0);
		if (openPosition < 0) {
			openPosition = 0.0;
		} else if (openPosition > 1) {
			openPosition = 1.0;
		}

		closePosition = this.parseFloat(closePosition, 1.0);
		if (closePosition < 0) {
			closePosition = 0.0;
		} else if (closePosition > 1) {
			closePosition = 1.0;
		}

		// Sanity check
		if ((closePosition - openPosition) < 0 || (closePosition <= openPosition) || (openPosition >= closePosition)) {
			openPosition = 0.0;
			closePosition = 1.0;
		}

		this.openPosition = openPosition;
		this.closePosition = closePosition;
	}

	/**
	 * Helper function to determine if the configuration appears valid or not.
	 */
	appearsValid() {
		return ((this.hostname !== '') && (this.devicecode !== '') && (this.devicecode.length === 8));
	}

	/**
	 * Helper function to parse a passed float value
	 *
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
		let result = await this.getInfo();
		let currPos = result.currentPosition;
		await this.sleep(2000);

		// The loop to rule them all
		let lastPos = -1;
		while (true) {
			await this.sleep(1000);
			let result = await this.getInfo();
			currPos = result.currentPosition;
			if (lastPos != -1) {
				if (currPos == lastPos) {
					// We wait for a while to let the Slide stop and take a break etc.
					await this.sleep(2000);
					break;
				}
			}
			lastPos = currPos;
			await this.sleep(1000);
		}
		return { 'response': 'success', 'currentPosition': currPos };
	}

	/**
	 * Gets information from the Slide.
	 *
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	getInfo() {
		return new Promise((resolve, reject) => {
			this.request('/rpc/Slide.GetInfo')
				.then((json) => {
					json = {
						'response': 'success',
						'currentPosition': json.pos,
						'openPosition': this.openPosition,
						'closePosition': this.closePosition,
						'suggestCalibration': ((json.pos < this.openPosition) || (json.pos > this.closePosition))
					};

					// Calculate current percentage
					let perc = -1;

					let pos = this.parseFloat(json.currentPosition - this.openPosition, NaN);
					pos = Math.round((pos + Number.EPSILON) * 100) / 100;

					let range = this.parseFloat(this.closePosition - this.openPosition, NaN);
					range = Math.round((range + Number.EPSILON) * 100) / 100;

					if (!isNaN(pos) && !isNaN(range)) {
						perc =  Math.round((pos / range) * 100);
					}

					// Prevent values < 0 or values > 100
					perc = Math.max(perc, 0);
					perc = Math.min(perc, 100);
					json.openPercent = ((perc - 100) * -1);

					// Done
					resolve(json);
				})
				.catch(e => reject(e));
		});
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
					this.sleep(5000).then(() => {
						resolve(this.waitUntilPosition());
					});
				})
				.catch(e => reject(e));
		});
	}

	/**
	 * Updates the curtain position of the slide.
	 *
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	async setPos(requestedPosition, force=false) {
		if (!force) {
			// Ensure requested position is not below open position
			requestedPosition = Math.max(requestedPosition, this.openPosition);
			//requestedPosition = Math.min(requestedPosition, this.closePosition);
		}

		// Ensure requested position is not below 0 or above 1
		requestedPosition = Math.max(requestedPosition, 0);
		requestedPosition = Math.min(requestedPosition, 1);

		// Now work it :)
		let payload = await this.getInfo();
		return new Promise((resolve, reject) => {
			requestedPosition = this.parseFloat(requestedPosition, -1);
			if (requestedPosition === -1) {
				reject({ 'code': 422, 'title': 'Invalid position passed', 'message': 'Please pass a float between 0.0 and 1.0 as the new position.' })
			} else if (payload.currentPosition === requestedPosition) {
				resolve(payload);
			} else {
				this.request('/rpc/Slide.SetPos', { 'pos': requestedPosition })
					.then(() => { return this.waitUntilPosition(); })
					.then(() => { return this.getInfo(); })
					.then((json) => { resolve(json); })
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
		return this.setPos(0, true);
	}

	/**
	 * Sends an close command to the Slide.
	 *
	 * @returns {Promise} Promise object representing the result of the API call.
	 */
	async close() {
		return this.setPos(1, true);
	}

}

module.exports = LocalApi;
