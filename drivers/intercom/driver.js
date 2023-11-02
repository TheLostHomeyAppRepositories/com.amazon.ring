'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverIntercom extends Driver {

    onInit() {
        this.log('onInit');
    }

    // this function is called from driver.js
    alarmMotionOn(device, tokens) {
        this._triggerAlarmMotionOn.trigger(device, tokens)
            .then()
            .catch(this.error);
    }

    onPairListDevices(data, callback) {
        this.log('onPairListDevices');

        return new Promise((resolve, reject) => {
            let foundDevices = [];

            this.homey.app.getRingDevices((error, result) => {
                if (error) {
                    return this.error(error);
                }

                result.intercoms.forEach((device_data) => {
                    foundDevices.push({
                        name: device_data.description,
                        data: {
                            id: device_data.id,
                        },
                    });
                });

                resolve(foundDevices);
            });
        });
    }
}

module.exports = DriverIntercom;
