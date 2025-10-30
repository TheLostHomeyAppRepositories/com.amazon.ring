const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverDoorbell extends Driver {

    onInit() {
        this.log('onInit');

        this._triggerAlarmMotionOn = this.homey.flow.getDeviceTriggerCard('alarm_motion_true');
        this._triggerSendSnapshot = this.homey.flow.getDeviceTriggerCard('ring_snapshot_received_device');

        if (!this.homey.__alarmMotionListenerRegistered) {
            this.homey.__alarmMotionListenerRegistered = true;
    
            this.homey.flow.getConditionCard('alarm_motion')
                .registerRunListener(async ( args, state ) => {
                    return args.device.getCapabilityValue('alarm_motion');
                })
        }

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

    async onPairListDevices() {
        this.log('onPairListDevices');

        try {
            const result = await this.homey.app.getRingDevices();
            const devices = [...result.doorbots, ...result.authorizedDoorbots];
            return devices.map(device => ({
                name: device.description,
                data: { id: device.id }
            }));
        } catch (error) {
            this.error(error);
            throw error;
        }
    }

}

module.exports = DriverDoorbell;
