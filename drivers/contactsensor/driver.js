const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverContactSensor extends Driver {

    onInit() {
        this.log('onInit');
    }

    async onPairListDevices() {
        this.log('onPairListDevicesContactSensor');

        const foundDevices = [];
        const result = await this.homey.app.getRingAlarmDevices();

        for (const device of result) {
            if (device.data.deviceType === 'sensor.contact') {
                foundDevices.push({
                    name: device.data.name,
                    data: {
                        id: device.data.serialNumber,
                        catalogId: device.data.catalogId,
                        zid: device.data.zid,
                    },
                });
            }
        }

        return foundDevices;
    }

}

module.exports = DriverContactSensor;
