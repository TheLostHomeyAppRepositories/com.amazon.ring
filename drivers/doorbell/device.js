const Homey = require('homey');
const Device = require('../../lib/Device.js');

const statusTimeout = 10000;

class DeviceDoorbell extends Device {

    _initDevice() {
        this.log('_initDevice');
        //this.log('name:', this.getName());
        //this.log('class:', this.getClass());
        //this.log('data:', this.getData());

        this.device = {}
        this.device.timer = {};
        
        try {
            this.motionTimeout = this.getSetting('motionTimeout');
        } catch (e) {
            this.motionTimeout = 30;
        }

        this.setCapabilityValue('alarm_generic', false)
            .catch(error => {this.error(error)});

        this.setCapabilityValue('alarm_motion', false)
            .catch(error => {this.error(error)});

        this.setAvailable();

        // fix?
        this._onAuthenticationChanged = this._setAvailability.bind(this);
        this.homey.on('authenticationChanged', this._onAuthenticationChanged);

        // this.homey.on('authenticationChanged', this._setAvailability.bind(this));

        this._setupCameraImage(this.getData());

        if ( this.homey.app.supportsModern ) {
            this.log('device.js _initDevice supportsModern',this.homey.app.supportsModern)
            this._setupCameraVideo(this.getData())
        }

        this.homey.on('ringOnNotification', this._ringOnNotification.bind(this));
        this.homey.on('ringOnData', this._ringOnData.bind(this));

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
    
    async _setupCameraImage(device_data) {
        this.log('_setupCamera', device_data);

        this.device.cameraImage = await this.homey.images.createImage();
        this.device.cameraImage.setStream(async (stream) => {
            try {
                const result = await this.homey.app.grabImage(device_data);

                const { Duplex } = require('stream');
                const snapshot = new Duplex();
                snapshot.push(Buffer.from(result, 'binary'));
                snapshot.push(null);
                return snapshot.pipe(stream);
            } catch (error) {
                this.log('device.js grabImage', error.toString());

                const { Duplex } = require('stream');
                const snapshot = new Duplex();
                snapshot.push(null);
                return snapshot.pipe(stream);
            }
        });

        this.setCameraImage(this.getName(),'Snapshot',this.device.cameraImage)
            .catch(error =>{this.log("setCameraImage: ",error);})
    }

    async _setupCameraVideo(device_data) {
        this.log('_setupCameraVideo', device_data);

        try {
            this.device.cameraVideo = await this.homey.videos.createVideoWebRTC();
            // This gets called when a client (mobile app) wants to start viewing
            this.device.cameraVideo.registerOfferListener(async (offerSdp) => {
              
                let answerSdp = await this.homey.app.grabVideo(device_data,offerSdp);                

                return {
                    answerSdp
                };

            });

            await this.setCameraVideo(this.getName(), 'Live view', this.device.cameraVideo);
        }
        catch (error) {
            this.error('_setupCameraVideo: Error creating camera:', error);
        }

    }

    async _ringOnNotification(notification) {
        //if (notification.ding.doorbot_id !== this.getData().id)
        if (notification.data.device.id !== this.getData().id)
            return;

        //this.log('_ringOnNotification', notification);

        /*
        this.log('------------------------------------------------------------------');
        this.log('notification.data.event.ding.subtype:',notification.data.event.ding.subtype)
        this.log('notification.android_config.category',notification.android_config.category)
        this.log('notification.data.event.ding.detection_type:',notification.data.event.ding.detection_type)
        */

        // need new evaluation for next line
        //if (notification.subtype === 'ding') {
        if ( notification.data.event.ding.subtype === 'button_press') {

            if (!this.getCapabilityValue('alarm_generic')) {
                this.homey.app.logRealtime('doorbell', 'ding');
                //let logLine = " doorbell || _ringOnNotification || " + this.getName() + " reported ding event";
                //this.homey.app.writeLog(logLine);
                
            }
            
            this.setCapabilityValue('alarm_generic', true)
                .catch(error => {this.error(error)});

            clearTimeout(this.device.timer.ding);

            this.device.timer.ding = setTimeout(() => {
                this.setCapabilityValue('alarm_generic', false)
                    .catch(error => {this.error(error)});
            }, statusTimeout);

        //} else if (notification.action === 'com.ring.push.HANDLE_NEW_motion') {
        } else if (notification.android_config.category === 'com.ring.pn.live-event.motion') {
            if (!this.getCapabilityValue('alarm_motion')) {
                this.homey.app.logRealtime('doorbell', 'motion');
                //let logLine = " doorbell || _ringOnNotification || " + this.getName() + " reported motion event";
                //this.homey.app.writeLog(logLine);
            }
            
            await this.setCapabilityValue('alarm_motion', true)
                .catch(error => {this.error(error)});

            //const type = notification.ding.detection_type; // null, human, package_delivery, other_motion
            //const type = notification.ding.detection_type ? notification.ding.detection_type : null;
            const type = notification.data.event.ding.detection_type ? notification.data.event.ding.detection_type : null;
            //if (!this.motionTypes[type]) { this.log('unknown motionType:', type)}
            const tokens = { 'motionType' : this.motionTypes[type] || this.motionTypes.unknown }
            this.driver.alarmMotionOn(this, tokens);

            //this.log('Motion detection Doorbell notification.subtype ==',notification.ding.detection_type);

            clearTimeout(this.device.timer.motion);

            this.device.timer.motion = setTimeout(() => {
                this.setCapabilityValue('alarm_motion', false)
                    .catch(error => {this.error(error)});

            }, (this.motionTimeout  * 1000));
        }
    }

    async _ringOnData(data) {
        if (data.id !== this.getData().id)
            return;

        //this.log('_ringOnData data',data);

        let battery = 100;

        if (data.battery_life != null) {
            // battery_life is not null, add measure_battery capability if it does not exists
            if ( !this.hasCapability('measure_battery') ) {
                await this.addCapability('measure_battery');
            }
            battery = parseInt(data.battery_life);
                
            if (battery > 100) { battery = 100; }
                              
            if ( this.getCapabilityValue('measure_battery') != battery) {
                this.setCapabilityValue('measure_battery', battery)
                    .catch(error => {this.error(error)});
            }
        } else {
            // battery_life is null, remove measure_battery capability if it exists
            if ( this.hasCapability('measure_battery') ) {
                this.removeCapability('measure_battery')
                    .catch(error => {this.error(error)});
            }
        }

        this.setSettings({useMotionDetection: data.settings.motion_detection_enabled})
            .catch((error) => {});
    }

    grabImage(args, state) {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let _this = this;
        return new Promise(async function(resolve, reject) {
            _this.device.cameraImage.update()
                .then(() => {
                    var tokens = {ring_image: _this.device.cameraImage};
                    _this.homey.flow.getTriggerCard('ring_snapshot_received')
                        .trigger(tokens)
                        .catch(error => {_this.log('grabImage trigger app',error)})

                    _this.driver.sendSnapshot(_this, tokens);

                return resolve(true);
                })
                .catch((error) =>{_this.log("grabImage error:",error)})
        });
    }

    async onSettings( settings ) {
        settings.changedKeys.forEach((changedSetting) => {
            if (changedSetting == 'useMotionDetection') {
                if (settings.newSettings.useMotionDetection) {
                    this.enableMotion(this._device)
                } else {
                    this.disableMotion(this._device)
                }
            } else if (changedSetting == 'motionTimeout') {
                this.motionTimeout = settings.newSettings.motionTimeout * 1000;
            }
        })
    }

    enableMotion(args, state) {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let _this = this;
        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            _this.homey.app.enableMotion(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }

    disableMotion(args, state) {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let _this = this;
        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            _this.homey.app.disableMotion(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }
}

module.exports = DeviceDoorbell;
