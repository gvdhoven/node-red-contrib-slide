
# node-red-contrib-slide

API control for the Slide curtains from Innovation In Motion. Only the **LOCAL API** is implemented, the assumption is that you are already running Node-red locally, hence you would want to control your curtains directly without a cloud.
_In case remote API functionality is needed, feel free to submit a pull request for similar remote API functionality._

[![NPM](https://nodei.co/npm/node-red-contrib-slide.png)](https://nodei.co/npm/node-red-contrib-slide/)

## Installation

Run the following command in your Node-RED user directory - typically `~/.node-red`

```bash
$ npm install node-red-contrib-slide.store
```

## Getting started

_The Slide Local API is, in it's current form, intended as a first version, and expected to undergo significant expansions in later updates. The focus of the current API is to allow you to directly control the curtains._

By default, this HTTP API is disabled since it is not yet officially published by Innovation In Motion. I am a beta tester and have therefore access, but I will not expose how to enable to local API until i get the green light from IIM.


The following nodes are implemented which expose a part of the Local API:

- slide-conf
	- Contains the `hostaneme` and the `device code` of a single slide.
- slide-get-info
	- Read Slide Device ID (MAC)
	- Request current Position
	- Request whether Touch&Go is on or off (currently not yet adjustable)

## Using the (local) API

Currently the local API does not yet support discovery (such as dns-sd, zeroconf etc.) so you will have to identify which local IP address your Slide is using. Due to a known bug all Slides currently have the hostname `espressif` on the local network, which might make this exercise slightly annoying if you have many Slides online.

### slide.conf

You need to add one configuration node per Slide motor you have installed. A filled in sample looks like this.

![Sample config](https://github.com/gvdhoven/node-red-contrib-slide/blob/main/assets/readme/img/slide.conf.png?raw=true)

As you can see, it contains a 'calibrate' button. Once you have entered the hostname and the devicecode, you can optionally click this button. This starts a custom calibration procedure:
	* Closes the curtain
	* Polls for a maximum of 30 seconds until the curtain stops moving
	* Saves the 'closed' offset (this should be near the 1.0 range)
	* Opens the curtain
	* Polls for a maximum of 30 seconds until the curtain stops moving
	* Saves the 'open' offset (this should be near the 0.0 range)

This offset is then used on subsequent calls on the `slide.setposition` node, to more precisely determine the curtain position and to see if an actual call to the motor is even needed.

For example;
	- If the open offset is actually 0.09 and the closed offset 0.87 (just as an example) setting the curtain to 50% would mean that the curtain should move to position: 0.09 + (0.5 * (0.87 - 0.09)) = 0.48 (which is exactly halfway between 0.09 and 0.87.
	- If the open offset is actually 0.09 and the curtain is already at 0.09; no `setPosition` command will be issued if you want to open the curtain; meaning you won't hear the motor wirring.
	- If the close offset is actually 0.87 and the curtain is already at 0.87; no `setPosition` command will be issued if you want to close the curtain; meaning you won't hear the motor wirring.
