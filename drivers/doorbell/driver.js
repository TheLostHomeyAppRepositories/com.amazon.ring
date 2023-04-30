'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverDoorbell extends Driver {

    onInit() {
        this.log('onInit');

        this._triggerAlarmMotionOn = this.homey.flow.getDeviceTriggerCard('alarm_motion_true');

        this.homey.flow.getActionCard('ring_grab_snapshot')
            .registerRunListener((args, state) => args.device.grabImage());

        this.homey.flow.getActionCard('doorbell_enable_motion')
            .registerRunListener((args, state) => args.device.enableMotion());

        this.homey.flow.getActionCard('doorbell_disable_motion')
            .registerRunListener((args, state) => args.device.disableMotion());

        /*
        this.homey.flow.getActionCard('doorbellEnableMotionAlerts')
            .registerRunListener((args, state) => args.device.enableMotionAlerts());
        
        this.homey.flow.getActionCard('doorbellDisableMotionAlerts')
            .registerRunListener((args, state) => args.device.disableMotionAlerts());
        */
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

                result.doorbots.forEach((device_data) => {
                    foundDevices.push({
                        name : device_data.description,
                        data : {
                            id: device_data.id
                        }
                    });
                });

                //result.authorized_doorbots.forEach((device_data) => {
                result.authorizedDoorbots.forEach((device_data) => {
                    foundDevices.push({
                        name : device_data.description,
                        data : {
                            id: device_data.id
                        }
                    });
                });

                resolve(foundDevices);
            });
        });
    }
}

module.exports = DriverDoorbell;
