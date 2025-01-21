'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');

const statusTimeout = 10000;

class DeviceStickUpCam extends Device {

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
        
        this.setCapabilityValue('alarm_motion', false)
            .catch(error => {this.error(error)});

        this.setAvailable();

        // fix?
        this._onAuthenticationChanged = this._setAvailability.bind(this);
        this.homey.on('authenticationChanged', this._onAuthenticationChanged);

        // this.homey.on('authenticationChanged', this._setAvailability.bind(this));

        this._setupCameraView(this.getData());

        this.homey.on('ringOnNotification', this._ringOnNotification.bind(this));
        this.homey.on('ringOnData', this._ringOnData.bind(this));

        //Hook up the capabilities that are already known.
        if ( this.hasCapability("flood_light") ) {
            this.registerCapabilityListener('flood_light', this.onCapabilityFloodLight.bind(this));
        }
        if ( this.hasCapability("siren") ) {
            this.registerCapabilityListener('siren', this.onCapabilitySiren.bind(this));
        }
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

    _enableLightCapability(device_data)
    {
        if(device_data.hasOwnProperty('led_status')) // camera.hasLight?
        {
            //Adding new capabilities
            if(!this.hasCapability("flood_light"))
            {
                //this.log('_enableLightCapability, this stickup camera has light, enable the capability');
                this.addCapability("flood_light").then(function() {
                    this.registerCapabilityListener('flood_light', this.onCapabilityFloodLight.bind(this));
                }.bind(this));
            } 
        }
    }

    _enableSirenCapability(device_data)
    {
        if(device_data.hasOwnProperty('siren_status')) // camera.hasSiren
        {
            //this.log ("_enableSirenCapability, device has a siren, enable siren related features");
            //Adding new capabilities
            if(!this.hasCapability("siren"))
            {
                //this.log ('_enableSirenCapability, this stickup camera has a siren, enable the capability');
                if ( this.getAvailable() ) {
                    this.addCapability("siren").then(function() {
                        this.registerCapabilityListener('siren', this.onCapabilitySiren.bind(this));
                    }.bind(this));
                }
            }
            /*
            if(!this.hasCapability("alarm_generic"))
            {
                //this.log ('_enableSirenCapability, this stickup camera has a siren, so use it to detect a Alarm');
                this.addCapability("alarm_generic");
            }
            */
            if(this.hasCapability("alarm_generic"))
                {
                    this.removeCapability("alarm_generic");
                }
        } else {
            //this.log ('_enableSirenCapability, device has no siren, ignore siren related features');
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
                        let logLine = " stickupcam || _setupCameraView || " + this.getName() + " grabImage " + error;
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

    async _ringOnNotification(notification) {
        //if (notification.ding.doorbot_id !== this.getData().id)
        if (notification.data.device.id !== this.getData().id)
            return;

this.log('------------------------------------------------------------------');
this.log('notification.android_config.category',notification.android_config.category)
this.log('notification.data.event.ding.detection_type:',notification.data.event.ding.detection_type)

        //if (notification.action === 'com.ring.push.HANDLE_NEW_motion') {
        if (notification.android_config.category === 'com.ring.pn.live-event.motion') {
            await this.setCapabilityValue('alarm_motion', true)
                .catch(error => {this.error(error)});

            this.homey.app.logRealtime('stickupcam', 'motion');

            //const type = notification.ding.detection_type; // null, human, package_delivery, other_motion
            //const type = notification.ding.detection_type ? notification.ding.detection_type : null;
            const type = notification.data.event.ding.detection_type ? notification.data.event.ding.detection_type : null;
            const tokens = { 'motionType' : this.motionTypes[type] || this.motionTypes.unknown }
            this.driver.alarmMotionOn(this, tokens);

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

        this._enableLightCapability(data);
        this._enableSirenCapability(data);

        // todo: Floodlight code needs testing
        if(this.hasCapability("flood_light"))
        {
            //this.log('_ringOnData, light status:'+data.led_status);
            let floodLight=false;
            if(data.led_status=='on')
                floodLight=true;
            this.setCapabilityValue('flood_light', floodLight)
                .catch(error => {this.error(error)});
        }

        if(this.hasCapability("siren"))
        {
            if (data.siren_status.started_at) {
                //this.log('_ringOnData, Siren status: '+JSON.stringify(data.siren_status));
            }
            let siren=false;
            if(data.siren_status.seconds_remaining>0)
                siren=true;
            this.setCapabilityValue('siren', siren)
                .catch(error => {this.error(error)});

            /*
            this.setCapabilityValue('alarm_generic', siren)
                .catch(error => {this.error(error)});
            */
        }

        let battery = parseInt(data.battery_life);

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
                        .catch(error => {_this.log(error)})

                    _this.driver.sendSnapshot(_this, tokens);

                return resolve(true);
                })
                .catch((error) =>{_this.log("grabImage error:",error)})
        });
    }

    isLightOn()
    {
        let _this = this;
        if(this.hasCapability('flood_light'))
        {
            return new Promise(function(resolve, reject) {
                return resolve(_this.getCapabilityValue('flood_light'));
            });
        }
        else
            return false;
    }

    onCapabilityFloodLight(value, opts)
	{
        console.log('flood light requested ['+value+']');
        this.setCapabilityValue('flood_light', value)
            .catch(error => {this.error(error)});

        if(value)
            return this.lightOn();
        else
            return this.lightOff();
	}

    lightOn(args, state) {

        let _this = this;
        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            _this.homey.app.lightOn(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });       
    }

    lightOff(args, state) {

        let _this = this;
        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            _this.homey.app.lightOff(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });       
    }

    onCapabilitySiren(value, opts)
	{
        console.log('Siren requested ['+value+']');
        this.setCapabilityValue('siren', value)
            .catch(error => {this.error(error)});
            
        if(value)
            return this.sirenOn();
        else
            return this.sirenOff();
    }
    
    sirenOn(args, state) {

        let _this = this;
        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            _this.homey.app.sirenOn(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
        });       
    }

    sirenOff(args, state) {

        let _this = this;
        let device_data = this.getData();

        return new Promise(function(resolve, reject) {
            _this.homey.app.sirenOff(device_data, (error, result) => {
                if (error)
                    return reject(error);

                return resolve(true);
            });
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
                this.motionTimeout = settings.newSettings.motionTimeout;
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

module.exports = DeviceStickUpCam;