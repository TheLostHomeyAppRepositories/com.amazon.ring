'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');

class DeviceChime extends Device {

    _initDevice() {
        this.log('_initDevice');
        //this.log('name:', this.getName());
        //this.log('class:', this.getClass());
        //this.log('data:', this.getData());

        // fix?
        this._onAuthenticationChanged = this._setAvailability.bind(this);
        this.homey.on('authenticationChanged', this._onAuthenticationChanged);

        // this.homey.on('authenticationChanged', this._setAvailability.bind(this));

    }

    _setAvailability(status) {
        if (status == 'authenticated') {
            try {
                this.setAvailable();
            }
            catch(e) {
            }
        } else {
            try {
                if ( this.getAvailable() ) {
                    // this.getAvailable() always returns true, need other condition
                    this.setUnavailable(this.homey.__("devices.unauthenticated"));
                }
            }
            catch(e) {
                // fail silently, setting a device unavailable will fail when Homey itself failed it already
            }
        }
    }

    ringChime(args) {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let device_data = this.getData();

        let _this = this;
        return new Promise(function(resolve, reject) {
            _this.homey.app.ringChime(device_data, args.sound, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }

    snoozeChime(args) {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let device_data = this.getData();
        let _this = this;
        return new Promise(function(resolve, reject) {
            _this.homey.app.snoozeChime(device_data, args.duration, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }

    unsnoozeChime() {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let device_data = this.getData();

        let _this = this;
        return new Promise(function(resolve, reject) {
            _this.homey.app.unsnoozeChime(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });   
    }

    /*
    https://github.com/tsightler/ring-mqtt/blob/b4fcec47a962f1249c9b659f298fef8a3f4bf712/devices/chime.js#L261C1-L265C19
    await this.setDeviceSettings({
        "night_light_settings": {
            "light_sensor_enabled": Boolean(command === 'on')
        }
    })

        async setDeviceSettings(settings) {
        const response = await this.device.restClient.request({
            method: 'PATCH',
            url: `https://api.ring.com/devices/v1/devices/${this.device.id}/settings`,
            json: settings
        })
        return response
    }
    */
}

module.exports = DeviceChime;
