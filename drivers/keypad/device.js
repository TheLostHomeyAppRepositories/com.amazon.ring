'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');

const statusMapping = {
    "ok": false,
    "tamper": true
  };

class DeviceKeypad extends Device {

    _initDevice() {
        this.log('_initDevice');
        // this.log('name:', this.getName());
        // this.log('class:', this.getClass());
        // this.log('data:', this.getData());      

        this.setCapabilityValue('alarm_tamper', false)
            .catch(error => {this.error(error)});

        this.setAvailable();

        this.homey.on('authenticationChanged', this._setAvailability.bind(this));

        this.homey.on('ringOnAlarmData',this._ringOnAlarmData.bind(this));

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
                    // this.setUnavailable(this.homey.__("devices.unauthenticated"));
                }
            }
            catch(e) {
                // fail silently, setting a device unavailable will fail when Homey itself failed it already
            }
        }
    }

    async _ringOnAlarmData(data) {
        // this.log('_ringOnAlarmData data',data);
        if (data.serialNumber !== this.getData().id)
            return;

        // Set Alarm Tamper capability
        try {
            this.setCapabilityValue('alarm_tamper', statusMapping[data.tamperStatus]);
        }
        catch(e) {
            this.error(error)
        }

        // Set Battery Capability
        let battery = 100;

        if (data.batteryLevel != null) {
            battery = parseInt(data.batteryLevel);
            if (battery > 100) { battery = 100; }            
            if ( this.getCapabilityValue('measure_battery') != battery) {
                this.setCapabilityValue('measure_battery', battery)
                    .catch(error => {this.error(error)});
            }
        }

    }

    /*
    https://github.com/tsightler/ring-mqtt/blob/b4fcec47a962f1249c9b659f298fef8a3f4bf712/devices/keypad.js#L38C1-L48C11
        this.device.location.onDataUpdate.subscribe((message) => {
            if (this.isOnline() &&
                message.datatype === 'DeviceInfoDocType' &&
                message.body?.[0]?.general?.v2?.zid === this.deviceId &&
                message.body[0].impulse?.v1?.[0]?.impulseType === 'keypad.motion'
            ) {
                this.processMotion()
            }
        })
    */

}

module.exports = DeviceKeypad;
