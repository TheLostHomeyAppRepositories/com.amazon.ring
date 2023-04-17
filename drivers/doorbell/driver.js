'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverDoorbell extends Driver {

    onInit() {
        this.log('onInit');

        this.homey.flow.getActionCard('ring_grab_snapshot')
            .registerRunListener((args, state) => args.device.grabImage());

        this.homey.flow.getActionCard('doorbell_enable_motion')
            .registerRunListener((args, state) => args.device.enableMotion());

        this.homey.flow.getActionCard('doorbell_disable_motion')
            .registerRunListener((args, state) => args.device.disableMotion());

        /*
        this.homey.flow.getActionCard('doorbellSubscribeMotion')
            .registerRunListener((args, state) => args.device.subscribeMotion());
        */
        /*
        this.homey.flow.getActionCard('doorbellUnsubscribeMotion')
            .registerRunListener((args, state) => args.device.unsubscribeMotion());
        */
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
