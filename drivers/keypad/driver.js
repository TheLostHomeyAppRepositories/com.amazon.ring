const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverKeypad extends Driver {

    onInit() {
        this.log('onInit');

    }

    async onPairListDevices() {
        this.log('onPairListDevicesKeypad');

        const foundDevices = [];
        const result = await this.homey.app.getRingAlarmDevices();

        for (const device of result) {
            if (device.data.deviceType === 'security-keypad') {
                foundDevices.push({
                    name: device.data.name,
                    data: {
                        id: device.data.serialNumber,
                        catalogId: device.data.catalogId,
                    },
                });
            }
        }

        return foundDevices;
    }

}

module.exports = DriverKeypad;
