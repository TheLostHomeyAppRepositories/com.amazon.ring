const Homey = require('homey');

class Device extends Homey.Device {

    onInit () {
        this.log('_onInit');
        this._initDevice();
        this.motionTypes = { 
            null: this.homey.__("motiontype.null"), 
            human: this.homey.__("motiontype.human"), 
            package_delivery: this.homey.__("motiontype.package"), 
            other_motion: this.homey.__("motiontype.other"),
            motion: this.homey.__("motiontype.motion"),
            vehicle: this.homey.__("motiontype.vehicle"),
            unknown: this.homey.__("motiontype.unknown")
        };
    }

    onAdded () {
        this.log('onAdded');
    }

    onDeleted () {
        this.log('onDeleted');
        
        // Remove the listener
        if (this._onAuthenticationChanged) {
            this.homey.off('authenticationChanged', this._onAuthenticationChanged);
            this._onAuthenticationChanged = null;
        }
    }

    onRenamed () {
        this.log('onRenamed');
    }

}

module.exports = Device;
