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

        this._setupCameraImage(this.getData());

        this._setupCameraVideo(this.getData());

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

    async _setupCameraImage(device_data) {
        this.log('_setupCameraImage', device_data);

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
                        let logLine = " stickupcam || _setupCameraImage || " + this.getName() + " grabImage " + error;
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
        this.setCameraImage(this.getName(),'Snapshot',this.device.cameraImage)
            .catch(error =>{this.log("setCameraImage: ",error);})
    }

    async _setupCameraVideo(device_data) {
        this.log('_setupCameraVideo', device_data);

        try {
            this.device.cameraVideo = await this.homey.videos.createVideoWebRTC();
            // This gets called when a client (mobile app) wants to start viewing
            this.device.cameraVideo.registerOfferListener(async (offerSdp) => {
                let camera = '';
                this.log('Received SDP offer from Homey front-end');
                await this.homey.app.grabVideo(device_data, (error, result) => {
                    try {
                        if (!error) {
                            camera = result;
                        } else {
                        }
                    }
                    catch (error) {
                        this.log('device.js grabVideo',error.toString())
                    }
                })

                const session = camera.createSimpleWebRtcSession();
                let answerSdp = await session.start(offerSdp);

                // run the fixer
                answerSdp = this._reorderAndFixSdp(offerSdp, answerSdp);

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

    _reorderAndFixSdp(offerSdp, answerSdp) {
        // normalize line endings
        offerSdp = offerSdp.replace(/\r\n/g, '\n');
        answerSdp = answerSdp.replace(/\r\n/g, '\n');

        // split into header and media blocks
        const splitMedia = s => {
            const parts = s.split(/\n(?=m=)/); // keep "m=" at start of blocks
            return {
            header: parts[0].trim(),
            blocks: parts.slice(1).map(b => b.trim())
            };
        };

        const offer = splitMedia(offerSdp);
        const answer = splitMedia(answerSdp);

        // map answer blocks by mid
        const mapByMid = (blocks) => {
            const map = {};
            for (const b of blocks) {
            const m = b.match(/\na=mid:([^\s\r\n]+)/) || b.match(/^a=mid:([^\s\r\n]+)/m);
            const mid = m ? m[1] : null;
            if (mid) map[mid] = b;
            else {
                // try to extract mid from m= line index if no a=mid present
                const midFromMline = b.match(/^m=\w+\s+\d+\s+[^\s]+\s.*$/m);
                // skip if unknown
            }
            }
            return map;
        };

        const answerMap = mapByMid(answer.blocks);
        const offerMap = mapByMid(offer.blocks);

        // get offer order of mids
        const offerMids = [];
        for (const b of offer.blocks) {
            const m = b.match(/\na=mid:([^\s\r\n]+)/) || b.match(/^a=mid:([^\s\r\n]+)/m);
            if (m) offerMids.push(m[1]);
        }

        // helper to detect offer direction for a given mid
        const getOfferDirection = (mid) => {
            const block = offerMap[mid];
            if (!block) return null;
            if (/\brecvonly\b/.test(block)) return 'recvonly';
            if (/\bsendonly\b/.test(block)) return 'sendonly';
            if (/\bsendrecv\b/.test(block)) return 'sendrecv';
            return null;
        };

        // synthesize a minimal application block from offer if answer lacks it
        const synthesizeApplicationBlock = (offerBlock, mid) => {
            // try to extract sctp-port from offer block
            const sctpMatch = (offerBlock && offerBlock.match(/a=sctp-port:(\d+)/));
            const sctpPort = sctpMatch ? sctpMatch[1] : '5000';
            return [
            `m=application 0 UDP/DTLS/SCTP webrtc-datachannel`,
            `c=IN IP4 0.0.0.0`,
            `a=mid:${mid}`,
            `a=inactive`,
            `a=sctp-port:${sctpPort}`,
            `a=max-message-size:262144`
            ].join('\n');
        };

        // build reordered blocks in offer order
        const reordered = [];
        for (const mid of offerMids) {
            let block = answerMap[mid];

            if (block) {
            // fix audio direction: if offer had recvonly -> answer must be sendonly
            const offerDir = getOfferDirection(mid);
            if (offerDir === 'recvonly') {
                // only change if answer does not have sendonly already
                if (!/^\s*a=sendonly\b/m.test(block) && !/^\s*a=sendrecv\b/m.test(block)) {
                // nothing
                }
                // replace sendrecv with sendonly, or ensure sendonly present
                block = block.replace(/\b(sendrecv|recvonly|sendonly)\b/, 'sendonly');
            }
            // ensure end-of-candidates present after candidates in each block (if candidates exist)
            if (/^a=candidate:/m.test(block) && !/a=end-of-candidates/m.test(block)) {
                // add end-of-candidates before first rtpmap or end of block
                block = block.replace(/(\n(?=(a=rtpmap|a=rtcp-fb|a=fmtp|a=ssrc|$)))/m, '\na=end-of-candidates$1');
            }
            } else {
            // missing in answer: synthesize minimal (mostly for application m-line)
            const offerBlock = offerMap[mid];
            if (offerBlock && /^m=application\b/m.test(offerBlock)) {
                block = synthesizeApplicationBlock(offerBlock, mid);
            } else if (offerBlock) {
                // synthesize a minimal media m-line with inactive
                const mline = offerBlock.split('\n')[0]; // m=... line from offer
                const mediaType = mline.split(' ')[0].replace(/^m=/, '');
                block = [
                `${mline.split(' ')[0]} 0 ${mline.split(' ')[2]} ${mline.split(' ').slice(3).join(' ')}`, // keep payload types
                `c=IN IP4 0.0.0.0`,
                `a=mid:${mid}`,
                `a=inactive`
                ].join('\n');
            } else {
                // fallback: blank inactive mid
                block = `m=application 0 UDP/DTLS/SCTP webrtc-datachannel\nc=IN IP4 0.0.0.0\na=mid:${mid}\na=inactive`;
            }
            }

            // ensure block lines are trimmed and appended
            reordered.push(block.trim());
        }

        // make bundle group match offer
        const offerBundle = (offer.header.match(/^a=group:BUNDLE (.+)$/m) || [])[1] || offerMids.join(' ');
        const headerLines = offer.header.split('\n').filter(Boolean).map(l => l.trim());
        // replace or add a=group:BUNDLE line in answer header
        let answerHeader = answer.header;
        if (/^a=group:BUNDLE /m.test(answerHeader)) {
            answerHeader = answerHeader.replace(/^a=group:BUNDLE .*/m, `a=group:BUNDLE ${offerBundle}`);
        } else {
            answerHeader = `${answerHeader}\n a=group:BUNDLE ${offerBundle}`;
        }

        // join everything with CRLF as SDP expects
        const final = [answerHeader, ...reordered].join('\r\n') + '\r\n';
        return final;
    }


    async _ringOnNotification(notification) {
        //if (notification.ding.doorbot_id !== this.getData().id)
        if (notification.data.device.id !== this.getData().id)
            return;
        
        /*
        this.log('------------------------------------------------------------------');
        this.log('notification.android_config.category',notification.android_config.category)
        this.log('notification.data.event.ding.detection_type:',notification.data.event.ding.detection_type)
        */

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