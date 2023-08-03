'use strict';

const Homey = require('homey');

class Device extends Homey.Device {

    onInit () {
        this.log('_onInit');
        this._initDevice();
        this.motionTypes = { 
            null:this.homey.__("motiontype.null"), 
            human: this.homey.__("motiontype.human"), 
            package_delivery: this.homey.__("motiontype.package"), 
            other_motion: this.homey.__("motiontype.other"),
            unknown: this.homey.__("motiontype.unknown")
        };
    }

    onAdded () {
        this.log('onAdded');
    }

    onDeleted () {
        this.log('onDeleted');
    }

    onRenamed () {
        this.log('onAdded');
    }

}

module.exports = Device;
