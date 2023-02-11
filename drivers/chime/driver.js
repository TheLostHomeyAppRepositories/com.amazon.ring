'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverChime extends Driver {

    onInit() {
        this.log('onInit');

        this.homey.flow.getActionCard('ring_chime')
            .registerRunListener(args => args.device.ringChime());
    }

    onPairListDevices() {
        this.log('onPairListDevices');
      
        return new Promise((resolve, reject) => {
            let foundDevices = [];
        
            this.homey.app.getRingDevices((error, result) => {
                if (error) {
                return reject(error);
                }
        
                result.chimes.forEach((device_data) => {
                    foundDevices.push({
                        name: device_data.description,
                        data: {
                        id: device_data.id,
                        info: device_data
                        }
                    });
                });

                resolve(foundDevices);
            });
        });
    }
      
}

module.exports = DriverChime;
