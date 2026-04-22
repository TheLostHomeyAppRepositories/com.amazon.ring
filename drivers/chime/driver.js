const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverChime extends Driver {

    onInit() {
        this.log('onInit');

        this.homey.flow.getActionCard('ring_chime')
            .registerRunListener(args => args.device.ringChime(args));

        this.homey.flow.getActionCard('snoozeChime')
            .registerRunListener(args => args.device.snoozeChime(args));

        this.homey.flow.getActionCard('unsnoozeChime')
            .registerRunListener(args => args.device.unsnoozeChime());

    }

    async onPairListDevices() {
        this.log('onPairListDevices');

        try {
            const result = await this.homey.app.getRingDevices();
            return result.chimes.map(device => ({
                name: device.description,
                data: { id: device.id }
                // data: { id: device.id, info: device }
            }));
        } catch (error) {
            this.error(error);
            throw error; // Homey pairing will handle the rejection
        }
    }
      
}

module.exports = DriverChime;
