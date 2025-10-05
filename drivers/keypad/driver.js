const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverKeypad extends Driver {

    onInit() {
        this.log('onInit');

    }

    onPairListDevices(data, callback) {
        this.log('onPairListDevicesKeypad');

        return new Promise((resolve, reject) => {
            let foundDevices = [];

            this.homey.app.getRingAlarmDevices((error, result) => {
                if (error) {
                    return this.error(error);
                }

                result.forEach(async (device) => {
                    if (device.data.deviceType === 'security-keypad') {
                        foundDevices.push({
                            name : device.data.name,
                            data : {
                                id: device.data.serialNumber,
                                catalogId: device.data.catalogId
                            }
                        });    

                    }
                })

                resolve(foundDevices);
            });
        });
    }
}

module.exports = DriverKeypad;
