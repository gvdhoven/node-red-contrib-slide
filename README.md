
# node-red-contrib-slide

API control for the Slide curtains from Innovation In Motion. Only the **LOCAL API** is implemented, the assumption is that you are already running Node-red locally, hence you would want to control your curtains directly without a cloud.
_In case remote API functionality is needed, feel free to submit a pull request for similar remote API functionality._

[![NPM](https://nodei.co/npm/node-red-contrib-slide.png)](https://nodei.co/npm/node-red-contrib-slide/)

## Installation

Run the following command in your Node-RED user directory - typically `~/.node-red`

```bash
$ npm install node-red-contrib-slide
```

## Getting started

_The Slide Local API is, in it's current form, intended as a first version, and expected to undergo significant expansions in later updates. The focus of the current API is to allow you to directly control the curtains._

By default, the local HTTP API is disabled since it is not yet officially published by Innovation In Motion. **I am a beta tester and have therefore access, but I will not expose how to enable to local API until i get the green light from the Slide team at Innovation In Motion.**

## Available nodes

The following nodes are implemented which expose a part of the Local API:

![Available nodes](https://github.com/gvdhoven/node-red-contrib-slide/blob/main/assets/readme/img/available-nodes.png?raw=true)

### slide-conf

You need to add one configuration node per Slide motor you have installed. Currently the local API does not yet support discovery (such as dns-sd, zeroconf etc.) so you will have to identify which local IP address your Slide is using. Due to a known bug all Slides currently have the hostname `espressif` on the local network, which might make this exercise slightly annoying if you have many Slides online.

![slide-conf](https://github.com/gvdhoven/node-red-contrib-slide/blob/main/assets/readme/img/slide-conf.png?raw=true)

Please enter at least the hostname and a device-code.

As you can see, it contains a 'calibrate' button. Once you have entered the hostname and the devicecode, you can optionally click this button. This starts a custom calibration procedure:
	* Starts the calibration procedure and waits until the curtain stops moving
	* Saves the 'closed' offset (this should be near the 1.0 range)
	* Opens the curtain
	* Saves the 'open' offset (this should be near the 0.0 range)
	* Restores the curtain to the approximate position it was while calibration was initiated.

This offset is then used on subsequent calls on the `slide-set-calibrated-position` node, to more precisely determine the curtain position and to see if an actual call to the motor is even needed.

For example;
	- If the open offset is actually 0.09 and the closed offset 0.87 (just as an example) setting the curtain to 50% would mean that the curtain should move to position: 0.09 + (0.5 * (0.87 - 0.09)) = 0.48 (which is exactly halfway between 0.09 and 0.87.
	- If the open offset is actually 0.09 and the curtain is already at 0.09; no `setPosition` command will be issued if you want to open the curtain; meaning you won't hear the motor wirring.
	- If the close offset is actually 0.87 and the curtain is already at 0.87; no `setPosition` command will be issued if you want to close the curtain; meaning you won't hear the motor wirring.

A full run of the calibration procedure can be seen on my Twitter timeline:

[![Calibration procedure](https://github.com/gvdhoven/node-red-contrib-slide/blob/main/assets/readme/img/calibration-procedure.png?raw=true)](https://twitter.com/GillesvdHoven/status/1326129124583333888)

### slide-get-info

Use this node in order to get information about the state of a certain Slide. This functionality is used heavily under the hood in order to determine calibration positions and to see when a certain Slide has stopped moving.

![slide-get-info](https://github.com/gvdhoven/node-red-contrib-slide/blob/main/assets/readme/img/slide-get-info.png?raw=true)

### slide-set-absolute-position

This node is able to set an absolute position on the slide, from 0 to 100%. This will most probably not mean that your curtain is half-way closed if you pass in the following payload `{ "payload": { "percent": 50 } }`, due to the fact that the Slide at `open` position can actually be at e.g. 4% and that same curtain can report a closed state of 98%. Halfway in this case would then be 51%. This math is done for you if you take the next Node; `slide-set-calibrated-position`.
	
![Inject node sample](https://github.com/gvdhoven/node-red-contrib-slide/blob/main/assets/readme/img/inject-node.png?raw=true)

### slide-set-calibrated-position

This node takes the calibration settings found by clicking the 'Calibrate' button in the config node and applies that to a percentage offset. In the example shown at the `slide-set-absolute-position` node, the same payload `{ "payload": { "percent": 50 } }` would result in the Slide moving to 51%.

### slide-open

Opens a Slide. The behaviour can be tested using the 'stop' button while editing the `slide-conf` node.

### slide-close

Closes a Slide. The behaviour can be tested using the 'stop' button while editing the `slide-conf` node.

### slide-stop

Stops any motor movement of a Slide. The behaviour can be tested using the 'stop' button while editing the `slide-conf` node.

### slide-update-wifi

Allows you to update the WiFi SSID and password for a given Slide. Use this one with caution as it will result in loss of controlling the Slide if you pass in the wrong values.