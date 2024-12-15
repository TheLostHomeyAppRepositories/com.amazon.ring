'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverDoorbell extends Driver {

    onInit() {
        this.log('onInit');

        this._triggerAlarmMotionOn = this.homey.flow.getDeviceTriggerCard('alarm_motion_true');
        this._triggerSendSnapshot = this.homey.flow.getDeviceTriggerCard('ring_snapshot_received_device');

        this.homey.flow.getConditionCard('alarm_motion')
            .registerRunListener(async ( args, state ) => {
                return args.device.getCapabilityValue('alarm_motion');
            })

        this.homey.flow.getActionCard('ring_grab_snapshot')
            .registerRunListener((args, state) => args.device.grabImage());

        this.homey.flow.getActionCard('doorbell_enable_motion')
            .registerRunListener((args, state) => args.device.enableMotion());

        this.homey.flow.getActionCard('doorbell_disable_motion')
            .registerRunListener((args, state) => args.device.disableMotion());

    }

    // this function is called from device.js
    alarmMotionOn(device, tokens) {
        this._triggerAlarmMotionOn.trigger(device, tokens)
            .then()
            .catch(this.error);
    }

    sendSnapshot(device, tokens) {
        this._triggerSendSnapshot.trigger(device, tokens)
            .then(this.log('sendSnapshot triggered'))
            .catch(error => {_this.log('grabImage trigger device:',error)})
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
