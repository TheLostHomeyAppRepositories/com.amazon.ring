const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverMotionDetector extends Driver {

    onInit() {
        this.log('onInit');
        
        // This needs to be done because the alarm_motion is overriden for doorbells and camera's
        this._triggerAlarmMotionOn = this.homey.flow.getDeviceTriggerCard('alarm_motion_true_default');
        
        if (!this.homey.__alarmMotionListenerRegistered) {
            this.homey.__alarmMotionListenerRegistered = true;

            // This needs to be done because the alarm_motion is overriden for doorbells and camera's
            this.homey.flow.getConditionCard('alarm_motion')
                .registerRunListener(async ( args, state ) => {
                    return args.device.getCapabilityValue('alarm_motion');
                })
        }
    }

    // this function is called from device.js
    alarmMotionOn(device) {
        this._triggerAlarmMotionOn.trigger(device)
            .then()
            .catch(this.error);
    }

    async onPairListDevices() {
        this.log('onPairListDevicesMotionSensor');

        const foundDevices = [];
        const result = await this.homey.app.getRingAlarmDevices();

        for (const device of result) {
            if (device.data.deviceType === 'sensor.motion') {
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
console.log(foundDevices)
        return foundDevices;
    }

}

module.exports = DriverMotionDetector;
