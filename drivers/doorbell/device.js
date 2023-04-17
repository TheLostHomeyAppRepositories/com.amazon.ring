'use strict';

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
        this.motionTimeout = this.getSetting('motionTimeout');

        this.setCapabilityValue('alarm_generic', false).catch(error => {
            this.error(error);
        });

        this.setCapabilityValue('alarm_motion', false).catch(error => {
            this.error(error);
        });

        this.setAvailable();

        this.homey.on('authenticationChanged', this._setAvailability.bind(this));

        this._setupCameraView(this.getData());

        this.homey.on('ringOnNotification', this._ringOnNotification.bind(this));
        this.homey.on('ringOnData',this._ringOnData.bind(this));

    }  
        
    _setAvailability(status) {
        if (status == 'authenticated') {
            this.setAvailable();
        } else {
            try {
                this.setUnavailable(this.homey.__("devices.unauthenticated"));
            }
            catch(e) {
                // fail silently, setting a device unavailable will fail when Homey itself failed it already
            }
        }
    }
    
    async _setupCameraView(device_data) {
        this.log('_setupCamera', device_data);

        this.device.cameraImage = await this.homey.images.createImage();
        this.device.cameraImage.setStream(async (stream) => {
            await this.homey.app.grabImage(device_data, (error, result) => {
                try {
                    if (!error) {
                        let Duplex = require('stream').Duplex;
                        let snapshot = new Duplex();
                        snapshot.push(Buffer.from(result, 'binary'));
                        snapshot.push(null);
                        return snapshot.pipe(stream);
                    } else {
                        let logLine = " doorbell || device.js _setupCameraView || " + this.getName() + " grabImage " + error;
                        this.homey.app.writeLog(logLine);
                        let Duplex = require('stream').Duplex;
                        let snapshot = new Duplex();
                        snapshot.push(null);
                        return snapshot.pipe(stream);
                    }
                }
                catch (error) {
                    this.log('device.js grabImage',error.toString())
                }
            })
        })

        this.setCameraImage(this.getName(),'snapshot',this.device.cameraImage)
            .catch(error =>{this.log("setCameraImage: ",error);})
    }

    _ringOnNotification(notification) {
        if (notification.ding.doorbot_id !== this.getData().id)
            return;

        //this.log('_ringOnNotification', notification);
        //this.log('ding',notification.ding);
        //this.log('subtype',notification.subtype);
        //this.log('action',notification.action);
        
        if (notification.subtype === 'ding') {
            if (!this.getCapabilityValue('alarm_generic')) {
                this.homey.app.logRealtime('doorbell', 'ding');
                let logLine = " doorbell || _syncDevice || " + this.getName() + " reported ding event";
                this.homey.app.writeLog(logLine);
            }
            
            this.setCapabilityValue('alarm_generic', true).catch(error => {
                this.error(error);
            });

            clearTimeout(this.device.timer.ding);

            this.device.timer.ding = setTimeout(() => {
                this.setCapabilityValue('alarm_generic', false).catch(error => {
                    this.error(error);
                });
            }, statusTimeout);

        } else if (notification.action === 'com.ring.push.HANDLE_NEW_motion') {
            if (!this.getCapabilityValue('alarm_motion')) {
                this.homey.app.logRealtime('doorbell', 'motion');
                let logLine = " doorbell || _syncDevice || " + this.getName() + " reported motion event";
                this.homey.app.writeLog(logLine);
            }
            
            //this.log('Motion detection Doorbell notification.subtype ==',notification.ding.detection_type);

            this.setCapabilityValue('alarm_motion', true).catch(error => {
                this.error(error);
            });

            clearTimeout(this.device.timer.motion);

            this.device.timer.motion = setTimeout(() => {
                this.setCapabilityValue('alarm_motion', false).catch(error => {
                    this.error(error);
                });
            }, (this.motionTimeout  * 1000));
        }
    }

    _ringOnData(data) {
        if (data.id !== this.getData().id)
            return;

        //this.log('_ringOnData data',data);

        let battery = 100;

        if (data.battery_life != null) {
            // battery_life is not null, add measure_battery capability if it does not exists
            if ( !this.hasCapability('measure_battery') ) {
                this.addCapability('measure_battery');
            }
            battery = parseInt(data.battery_life);
                
            if (battery > 100) { battery = 100; }
                              
            if ( this.getCapabilityValue('measure_battery') != battery) {
                this.setCapabilityValue('measure_battery', battery).catch(error => {
                    this.error(error);
                });
            }
        } else {
            // battery_life is null, remove measure_battery capability if it exists
            if ( this.hasCapability('measure_battery') ) {
                this.removeCapability('measure_battery');
            }
        }

        this.setSettings({subscribeMotionDetection: data.subscribed_motions})
            .catch((error) => {});

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
                        .catch(error => {_this.log(error)})

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
            }
            else if (changedSetting == 'subscribeMotionDetection') {
                if (settings.newSettings.subscribeMotionDetection) {
                    this.subscribeMotion(this._device)
                } else {
                    this.unsubscribeMotion(this._device)
                }
            }
            else if (changedSetting == 'motionTimeout') {
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

    subscribeMotion(args, state) {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let _this = this;
        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            _this.homey.app.subscribeMotion(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }

    unsubscribeMotion(args, state) {
        if (this._device instanceof Error)
            return Promise.reject(this._device);

        let _this = this;
        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            _this.homey.app.unsubscribeMotion(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });
    }
}

module.exports = DeviceDoorbell;
