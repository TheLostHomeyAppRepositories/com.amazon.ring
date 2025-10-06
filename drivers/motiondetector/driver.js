const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverMotionDetector extends Driver {

    onInit() {
        this.log('onInit');
        
        // This needs to be done because the alarm_motion is overridded for doorbells and camera's
        this._triggerAlarmMotionOn = this.homey.flow.getDeviceTriggerCard('alarm_motion_true_default');
        
        // This needs to be done because the alarm_motion is overridded for doorbells and camera's
        this.homey.flow.getConditionCard('alarm_motion')
            .registerRunListener(async ( args, state ) => {
                return args.device.getCapabilityValue('alarm_motion');
            })
    }

    // this function is called from device.js
    alarmMotionOn(device) {
        this._triggerAlarmMotionOn.trigger(device)
            .then()
            .catch(this.error);
    }

    onPairListDevices(data, callback) {
        this.log('onPairListDevicesContactSensor');

        return new Promise((resolve, reject) => {
            let foundDevices = [];

            this.homey.app.getRingAlarmDevices((error, result) => {
                if (error) {
                    return this.error(error);
                }

                result.forEach(async (device) => {
                    if (device.data.deviceType === 'sensor.motion') {
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

module.exports = DriverMotionDetector;
