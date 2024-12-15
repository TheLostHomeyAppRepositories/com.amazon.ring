'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverStickUpCam extends Driver {

    onInit() {
        this.log('onInit');

        this._triggerAlarmMotionOn = this.homey.flow.getDeviceTriggerCard('alarm_motion_true');
        this._triggerSendSnapshot = this.homey.flow.getDeviceTriggerCard('ring_snapshot_received_device');

        this.homey.flow.getConditionCard('alarm_motion')
            .registerRunListener(async ( args, state ) => {
                return args.device.getCapabilityValue('alarm_motion');
            })

        this.homey.flow.getConditionCard('stickupcam_floodLight_on')
            .registerRunListener(async ( args, state ) => {
                return args.device.isLightOn(); // Promise<boolean>
            })
            
        this.homey.flow.getActionCard('stickupcam_grab_snapshot')
            .registerRunListener((args, state) => args.device.grabImage());

        this.homey.flow.getActionCard('stickupcam_light_on')
            .registerRunListener((args, state) => args.device.lightOn());

        this.homey.flow.getActionCard('stickupcam_light_off')
            .registerRunListener((args, state) => args.device.lightOff());

        this.homey.flow.getActionCard('stickupcam_siren_on')
            .registerRunListener((args, state) => args.device.sirenOn());

        this.homey.flow.getActionCard('stickupcam_siren_off')
            .registerRunListener((args, state) => args.device.sirenOff());

        this.homey.flow.getActionCard('stickupcam_enable_motion')
            .registerRunListener((args, state) => args.device.enableMotion());

        this.homey.flow.getActionCard('stickupcam_disable_motion')
            .registerRunListener((args, state) => args.device.disableMotion());
        
    }

    // this function is called from driver.js
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

        let foundDevices = [];

        return new Promise((resolve, reject) => {        
            this.homey.app.getRingDevices((error, result) => {
                if (error) {
                    return this.error(error);
                }

                //result.stickup_cams.forEach((device_data) => {
                result.stickupCams.forEach((device_data) => {
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

module.exports = DriverStickUpCam;
