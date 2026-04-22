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

    async onPairListDevices() {
        this.log('onPairListDevices');

        try {
            const result = await this.homey.app.getRingDevices();
            return result.intercoms.map(device => ({
                name: device.description,
                data: { id: device.id }
            }));
        } catch (error) {
            this.error(error);
            throw error;
        }
    }

}

module.exports = DriverIntercom;
