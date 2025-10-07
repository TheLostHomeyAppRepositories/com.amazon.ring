const Homey = require('homey');
const Device = require('../../lib/Device.js');

const statusMapping = {
    "ok": false,
    "tamper": true
  };

class DeviceMotionDetector extends Device {

    _initDevice() {
        this.log('_initDevice for', this.getName());
        // this.log('class:', this.getClass());
        // this.log('data:', this.getData());

        //this.device = {}
        
        this.setCapabilityValue('alarm_motion', false)
            .catch(error => {this.error(error)});

        this.setCapabilityValue('alarm_tamper', false)
            .catch(error => {this.error(error)});

        // Add this device to the app registry
        this.homey.app._devices.push(this);

        // Set initial availability based on app authentication
        const initialStatus = this.homey.app?.isAuthenticated ? 'authenticated' : 'unauthenticated';
        this._setAvailability(initialStatus);

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

        // Set Alarm Contact capability
        try {
            this.setCapabilityValue('alarm_motion', data.faulted);
            if ( data.faulted ) {
                this.driver.alarmMotionOn(this);
            } else {

            }
        }
        catch(e) {
            this.error(error)
        }

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

}

module.exports = DeviceMotionDetector;
