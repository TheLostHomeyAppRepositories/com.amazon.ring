'use strict';

const Homey = require('homey');

const https = require('https');
const crypto = require('crypto');
const events = require('events');
const stringify = require('querystring').stringify;
const allowedModes = ["home", "away", "disarmed"];

//const { RingApi } = require('../ring-client-api') // 11.7.7 28-05-2023 // 11.7.6 26-05-2023 // 11.7.5 07-04-2023
const { RingApi } = require('../ring-client-api') // 11.8.0-beta.0 03-06-2023

const refreshTimeout = 5000;
const cameraStatusInterval = 5;
const locationModeInterval = 5;
const alarmModeInterval = 5;
const verifyAuthenticationInterval = 300000;

const parse = require('url').parse;

const sleep = time => new Promise(res=>setTimeout(res,time));

class Api extends Homey.SimpleClass {

    log() {
        this.homey.log.bind(this, '[Api]').apply(this, arguments);
    }

    constructor(homey) {
        super();

        this.homey = homey;
        this._refreshToken = null;
        this._uniqueid = null;
        this._authenticated = false;
        this._previousAuthenticated = null;
        this._authenticating = false;
        this._apiversion = 11;

        this.homey.settings.on('set', (name) => this._onSetSettings(name));
    }

    async init () {
        this.log('Api.js                     initialising ==============')

        let refreshToken = await this.homey.settings.get('ringRefreshToken');

        this.homey.api.realtime('com.ring.status', { state: 'api_init'});
        await this.homey.cloud.getHomeyId()
            .then((cloudId) => {
                this._uniqueid = cloudId;

                this._refreshToken = refreshToken;

                this._verifyAuthentication((error, result) => {
                    if (!error)
                    {
                        this.log('Api.js:                    initialising done =========')
                    } else {
                        this.log('_verifyAuthentication:   Failed');
                        this.log('Api.js:                    initialising done =========')
                        this.homey.emit('authenticationChanged', 'unauthenticated');
                        if ( !this.homey.settings.get('ringRefreshToken') ) {
                            //this.log('set interval on _ verifyAuthentication()');
                            //this._verifyInterval = this.homey.setInterval(() => this._verifyAuthentication(), verifyAuthenticationInterval);
                        }
                    }
                });
            })
            .catch((error) => {return this.error(new Error('no_uniqueid'));})

    }

    async _connectRingAPI() {
        this.log('_connectRingAPI:           connecting ----------------');

        if (this.ringApi) {
            this.log('_connectRingAPI:           ring-client-api already connected, exit _connectRingAPI');
            return;
        }

        this.log('_connectRingAPI:           ring-client-api initializing');
        try {
            this.ringApi = new RingApi({
                refreshToken: await this.homey.settings.get('ringRefreshToken'),
                cameraStatusPollingSeconds: cameraStatusInterval,
                locationModePollingSeconds: locationModeInterval,
                controlCenterDisplayName: 'Homey', // This is the displayed name for the Authorized Device within Control Center in the Ring app
                systemId: this._uniqueid
            })

        }
        catch(error) {
            this.log('_connectRingAPI:           Error connecting ring-client-api',error);
            return;
        }

        this.log('_connectRingAPI:           ring-client-api connected');
        this._authenticated = true;

//this.log('ringApi',this.ringApi);

        this.log('_connectRingAPI:           subscribing to Refresh Token updates');
        try {
            // Subscribe to recieve new refresh token and save it
            this.ringApi.onRefreshTokenUpdated.subscribe(
                async ({ newRefreshToken, oldRefreshToken }) => {
                    if (oldRefreshToken) {
                        //this.log('New refresh token recieved and saved to settings');
                        await this.homey.settings.set('ringRefreshToken', newRefreshToken);
                    }
                }
            );
        }
        catch(error) {
            this.log('_connectRingAPI:           Error onRefreshTokenUpdated',error);
            return;
        }

        this.log('_connectRingAPI:           updates subscribed');

        this.log('_connectRingAPI:           subscribing to locations');
        try {
            // get all locations from the Ring api and subscribe to location information (interval on locationModeInterval)
            this.locations = await this.ringApi.getLocations();
            this.locations.forEach(async location => {

                if (location.hasAlarmBaseStation) {
                    // When a location has a Ring Alarm System the Alarm Mode needs to be polled
                    this.log('Ring Alarm present at    ',location.locationDetails.name);
                    this.homey.setInterval(() => this._refreshAlarmMode(location.locationDetails.location_id), (alarmModeInterval*1000));

                } else {
                    // When a location doesn't have a Ring Alarm System subscribe to location.onLocationMode
                    location.onLocationMode.subscribe((locationMode) => {
                        //this.log('onLocationMode',location.locationDetails.name, locationMode);
                        try {
                            if (this._authenticated) {
                                //this.log('onLocationMode',location.locationDetails.name, locationMode);
                                const locationInfo = {
                                    name: location.name,
                                    id: location.locationDetails.location_id,
                                    mode: locationMode
                                }
                                this.emit('ringOnLocation', locationInfo);
                            }
                        }
                        catch(e) {
                            this.log('onLocationMode error:',e);
                        }
                    });
                }

            });
        }
        catch(error) {
            this.log('_connectRingAPI locations',error.toString());
            this.ringApi = null;
            if ( error.toString().search("Error: Refresh token is not valid.") != -1 ) {
                this._authenticated = false;
                const report = JSON.parse('{"error": "refreshtoken not valid", "error_description": "The refreshtoken is invalid, please reauthenticate."}');
                this._setAuthenticationStatus(false, report);
            }
            return;
        }

        this.log('_connectRingAPI:           locations subscribed');

        this.location = this.locations[0]
        this.chimes = this.location.chimes

        this.log('_connectRingAPI:           subscribing to Cameras');
        try {
            // Get all cameras and subscribe to Ring and Motion events, next subscribe on camera information (interval on cameraStatusInterval)
            this.cameras = await this.ringApi.getCameras();
            this.cameras.forEach(async camera => {
                camera.onNewNotification.subscribe((notification) => {
                    //this.log("onNewNotification", notification);
                    try {
                        if (this._authenticated) {
                            this.emit('ringOnNotification', notification);
                        }
                    }
                    catch(e) {
                        this.log('onNewNotification error:', e)
                    }
                })
                camera.onData.subscribe((data) => {
                    //this.log('camera.onData',data);
                    if (this.ringApi && !this.ringApi.restClient.refreshToken) {
                        this.log('onData:                   refreshToken lost');
                        const report = JSON.parse('{"error": "refreshtoken not valid", "error_description": "The refreshtoken is invalid, please reauthenticate."}');
                        this._setAuthenticationStatus(false, report);
                    }
                    try {
                        if (this._authenticated) {
                            this.emit('ringOnData', data);
                        }
                    }
                    catch(e) {
                        this.log('onData', e)
                    }
                })

                // extra logging to determine camera settings
                //this.log('-----------------------------------------------------------------');
                //this.log('Camera settings:         ',camera.initialData.description);
                //this.log(' - subscribed:           ',camera.initialData.subscribed);
                //this.log(' - subscribed motions:   ', camera.initialData.subscribed_motions);
                //this.log(' - adv motion detection: ',camera.initialData.settings.advanced_motion_detection_enabled);
                //this.log(' - adv mot det human onl:',camera.initialData.settings.advanced_motion_detection_human_only_mode);
                //this.log(camera.initialData);

            });
        }
        catch(error) {
            this.log('_connectRingAPI cameras  ',error.toString());
        }
        this.log('_connectRingAPI:           cameras subscribed');

        this.log('_connectRingAPI:           subscribing to Intercoms');
        try {
            this.intercoms = this.location.intercoms;
            this.intercoms.forEach(async (intercom) => {
                intercom.onDing.subscribe(() => {
                    //this.log("onDing");
                    try {
                        if (this._authenticated) {
                            this.emit('ringOnDing', intercom);
                        }
                    } catch (e) {
                        this.log('ringOnDing error:', e);
                    }
                });
                intercom.onData.subscribe((data) => {
                    //this.log('camera.onData',data);
                    if (this.ringApi && !this.ringApi.restClient.refreshToken) {
                        this.log('onData:                   refreshToken lost');
                        const report = JSON.parse(
                            '{"error": "refreshtoken not valid", "error_description": "The refreshtoken is invalid, please reauthenticate."}'
                        );
                        this._setAuthenticationStatus(false, report);
                    }
                    try {
                        if (this._authenticated) {
                            this.emit('ringOnData', data);
                        }
                    } catch (e) {
                        this.log('onData', e);
                    }
                });
            });
        } catch (error) {
            this.log('_connectRingAPI intercoms  ', error.toString());
        }
        this.log('_connectRingAPI:           intercoms subscribed');
        this.log('_connectRingAPI:           succesfully connected -----');
    }

    _disconnectRingAPI ( ) {
        //this.log('_disconnectRingAPI');
        try {
            this.ringApi.disconnect();
            this.ringApi = null;
        }
        catch(e) {
            this.log('_disconnectRingAPI:',e)
        }
    }

    // Polling the Alarm Mode when the location has a Ring Alarm System
    _refreshAlarmMode (locationId) {
        //this.log('_refreshAlarmMode',locationId);
        if (!this._authenticated) {
            return;
        }

        this.locations.forEach(async (location) => {
            if (location.locationDetails.location_id == locationId) {

                const mode = await location.getAlarmMode();
                const locationModes = { none: 'disarmed', some: 'home', all: 'away' };

                const locationInfo = {
                    name: location.locationDetails.name,
                    id: locationId,
                    mode: locationModes[mode]
                }
                this.emit('ringOnLocation', locationInfo);
            }
        });

    }

    _getGrantData (auth) {
        if (!auth ) {
            /*
            return {
                grant_type: "refresh_token",
                refresh_token: this.homey.settings.get('ringRefreshToken')
            }
            */
        } else {
            return {
                grant_type: "password",
                username: auth.user,
                password: auth.pass
            }
        }
    }

    //Use this method to trigger the MFA message to use
    //Pass the auth object containing the user and pass
    _https_auth_cred (auth, callback) {
        this.log('_https_auth_cred');
        if (auth === null || auth === undefined) {
            return callback(new Error('invalid_credentials'));
        }

        const grantData = this._getGrantData(auth)

        let postdata = JSON.stringify({
            client_id: "ring_official_android",
            scope: "client",
            ...grantData
            //grant_type: "password",
            //username: auth.user,
            //password: auth.pass
        });

        let timeout = setTimeout(() => {
            request.destroy();
        }, refreshTimeout);

        const url = parse('https://oauth.ring.com/oauth/token');
        url.method = 'POST';
        url.headers = {
            'User-Agent': 'android:com.ringapp',
            //hardware_id: this._uniqueid,
            '2fa-support': 'true',
            'content-type': 'application/json',
            'content-length': postdata.length
        };

        let request = https.request(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                let error = null;
                let result = {};
                let report = {};

                if (response.statusCode >= 400) {
                    if(response.statusCode==412)
                    {
                        this._authenticated = false;
                        data = data.replace(/(\r\n|\n|\r)/gm, "");
                        this.log('_https_auth_cred : require mfa code : ', response.statusCode);
                        try {
                            report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                        } catch (e) {
                            report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + response.statusCode + '"}');
                        }
                        this._setAuthenticationStatus(false, report);

                    } else {
                        this._authenticated = false;
                        data = data.replace(/(\r\n|\n|\r)/gm, "");
                        this.log('_https_auth_cred : authentication error : ', response.statusCode);
                        error = new Error('invalid_authentication ' + response.statusCode + ' ' + data);
                        try {
                            report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                        } catch (e) {
                            report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + response.statusCode + '"}');
                        }
                        this._setAuthenticationStatus(false, report);

                    }
                } else {
                    try {
                        result = JSON.parse(data);
                        this._setAuthenticationStatus(true, null);

                    } catch (e) {
                        error = e;
                    }
                }

                clearTimeout(timeout);
                callback(error, result);
            });

            response.on('error', (error) => {
                clearTimeout(timeout);
                callback(error);
            });
        });

        request.on('error', (error) => {
            clearTimeout(timeout);
            callback(error);
        });

        request.write(postdata);

        request.end();

    }

    //Use this methode to pass the MFA code along with the request
    _https_auth_code (auth, code, callback) {
        this.log('_https_auth_code');
        if (auth === null || auth === undefined) {
            return callback(new Error('invalid_credentials'));
        }

        const grantData = this._getGrantData(auth)

        let postdata = JSON.stringify({
            client_id: "ring_official_android",
            scope: "client",
            ...grantData
            //grant_type: "password",
            //username: auth.user,
            //password: auth.pass
        });

        let timeout = setTimeout(() => {
            request.destroy();
        }, refreshTimeout);

        const url = parse('https://oauth.ring.com/oauth/token');
        url.method = 'POST';
        url.headers = {
            'User-Agent': 'android:com.ringapp',
            //hardware_id: this._uniqueid,
            '2fa-support': 'true',
            '2fa-code': code || '',
            'content-type': 'application/json',
            'content-length': postdata.length
        };

        let request = https.request(url, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                let error = null;
                let result = {};
                let report = {};

                if (response.statusCode >= 400) {
                    this._authenticated = false;
                    data = data.replace(/(\r\n|\n|\r)/gm, "");
                    this.log('_https_auth_code : invalid_authentication : ', response.statusCode);
                    error = new Error('invalid_authentication ' + response.statusCode + ' ' + data);
                    try {
                        report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                    } catch (e) {
                        report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + response.statusCode + '"}');
                    }
                    this._setAuthenticationStatus(false, report);

                } else {
                    try {
                        result = JSON.parse(data);
                        this.log('_https_auth_code: retrieved the refresh and access token')
                        this.homey.settings.set('ringRefreshToken', result.refresh_token);
                            //this._bearer = result.access_token;
                            //this.homey.settings.set('ringBearer', result.access_token);
                        this._authenticated = true;
                        this._setAuthenticationStatus(true, null);
                    } catch (e) {
                        error = e;
                    }
                }

                clearTimeout(timeout);
                callback(error, result);
            });

            response.on('error', (error) => {
                clearTimeout(timeout);
                callback(error);
            });
        });

        request.on('error', (error) => {
            clearTimeout(timeout);
            callback(error);
        });

        request.write(postdata);

        request.end();
    }

    _onSetSettings (name) {
        //this.log('_onSetSettings', name, this.homey.settings.get(name));

        if (name === 'isRevoked') {
            if (this.homey.settings.get(name)) {
                this.homey.settings.set('ringAccesstoken', null);
                //this.homey.settings.set('ringBearer', null);
                this.homey.settings.set('ringRefreshToken', null);
                this.homey.settings.set('authenticationStatus', 'Authentication Revoked');
                this.homey.settings.set('authenticationError', "The authentication has been revoked.");

                this._authenticated = false;
                this.log('_onSetSettings: Authentication revoked from settings');
                let logLine = " Api.js || " + "_onSetSettings || " + " Authentication revoked from settings ";
                this.homey.app.writeLog(logLine);
                let report = JSON.parse('{"error": "Authentication Revoked", "error_description": "The authentication has been revoked."}');

                this._setAuthenticationStatus(false, report);
            }
        }

    }

    async _verifyAuthentication (callback) {
        //this.log('_verifyAuthentication'); // (step 1 in verification sequence)

        if ( this._refreshToken ) {
            //this.log('this._refreshToken is true')
            // if there is a refeshtoken stored try to connect to the Ring API
            await this._connectRingAPI();
        }

        if (this._authenticated) {
            this._setAuthenticationStatus(true, null);

            return callback(null, true);
        } else {
            const report = JSON.parse('{"error": "Unauthenticated", "error_description": "The app is not authenticated at Ring."}');
            this._setAuthenticationStatus(false, report);

            return callback(new Error('authenticated_failed'), true);

        }
    }

    // This function sets the authentication when it changes from one state to another
    // It will log the change and sent out events.
    // When unauthenticated by an api error it starts a recurring attempt to authenticate
    _setAuthenticationStatus (status, report) {
        //this.log('_setAuthenticationStatus: ', status);
        //this.log('this._authenticated:      ',this._authenticated)

        if (this._previousAuthenticated != this._authenticated) {
            if (this._authenticated) {
                if (!this.NoAuthStatLogTimeout) {
                    this.log('_setAuthenticationStatus:  Successfully Authenticated');
                    let logLine = " Api.js || " + "_setAuthenticationStatus || " + " Successfully Authenticated ";
                    this.homey.app.writeLog(logLine);
                } else {
                    //this.log('_setAuthenticationStatus: Successfully Authenticated, this.NoAuthStatLogTimeout != false');
                }
                clearTimeout(this.NoAuthStatLogTimeout);
                this.NoAuthStatLogTimeout = null;
                clearInterval(this._verifyInterval);

                // connect ring-client-api
                this._connectRingAPI();

                // This event is emitted Homey wide, other apps can act on this
                // The settingspage uses this event to show changes in the authentication state
                this.homey.api.realtime('com.ring.status', { state: 'authenticated'});
                // This event is emitted inside the app
                // The devices use this event to set them available and unavailable
                this.homey.emit('authenticationChanged', 'authenticated');
                // When authenticated again stop the recurring attempt to authenticate
                this.homey.settings.set('isRevoked', false);
            } else {
                this.NoAuthStatLogTimeout = setTimeout(async () => {
                    await sleep(50);
                    this.homey.api.realtime('com.ring.status', { state: 'unauthenticated'});
                    this.homey.emit('authenticationChanged', 'unauthenticated');

                    // disconnect ring-client-api
                    this._disconnectRingAPI();

                    // If the authentication is not manually revoked by the user enable the recurring attempt to authenticate
                    if (!this.homey.settings.get('isRevoked')) {
                        //this.log('Interval ingeschakeld');
                        //this._verifyInterval = this.homey.setInterval(() => this._verifyAuthentication(), verifyAuthenticationInterval);
                    }
                }, 1000);
            }
            this._previousAuthenticated = this._authenticated;
        }

        if (status) {
            if ( this.homey.settings.get('authenticationStatus') != 'Authenticated' ) {
                this.homey.settings.set('authenticationStatus', 'Authenticated');
                this.homey.settings.set('authenticationError', '');
            }
        } else {
            if (this.homey.settings.get('authenticationStatus') != report.error) {
                this.homey.settings.set('authenticationStatus', report.error);
                this.homey.settings.set('authenticationError', report.error_description);
            }
        }
    }

    async getDevices (callback) {
        try {
            const result = await this.ringApi.fetchRingDevices()
            callback(null, result);
        }
        catch (error) {
            callback(error, null);
        }
    }

    ringChime (device_data, sound, callback) {
        //this.log('ringChime', device_data);
        this.chimes.forEach(async (chime) => {
            if (chime.id == device_data.id) {
                if (sound == 'ring') {
                    await this.chimes[this.chimes.indexOf(chime)].playSound('ding');
                } else {
                    await this.chimes[this.chimes.indexOf(chime)].playSound('motion');
                }
                callback(null,true);
            }
        });
    }

    snoozeChime(device_data, duration, callback) {
        //this.log('snoozeChime', device_data, duration);
        this.chimes.forEach(async (chime) => {
            if (chime.id == device_data.id) {
                chime.snooze(duration*60)  // duration is in minutes, max 24 * 60 (1440)
            }
            callback(null,true);
        });
    }

    unsnoozeChime(device_data, callback) {
        //this.log('unsnoozeChime', device_data);
        this.chimes.forEach(async (chime) => {
            if (chime.id == device_data.id) {
                chime.clearSnooze();
                callback(null,true);
            }
        });
    }

    // todo: Test new function
    lightOn (device_data, callback) {
        //this.log('lightOn', device_data);

        this.cameras.forEach(async (camera) => {
            if (camera.initialData.id == device_data.id) {
                const result = camera.setLight(true);
                callback(null, result);
            }
        });
    }

    // todo: Test new function
    lightOff (device_data, callback) {
        this.log('lightOff', device_data);

        this.cameras.forEach(async (camera) => {
            if (camera.initialData.id == device_data.id) {
                const result = camera.setLight(false);
                callback(null, result);
            }
        });
    }

    sirenOn (device_data, callback) {
        //this.log('sirenOn', device_data);

        this.cameras.forEach(async (camera) => {
            if (camera.initialData.id == device_data.id) {
                const result = camera.setSiren(true);
                callback(null, result);
            }
        });
    }

    sirenOff (device_data, callback) {
        //this.log('sirenOff', device_data);

        this.cameras.forEach(async (camera) => {
            if (camera.initialData.id == device_data.id) {
                const result = camera.setSiren(false);
                callback(null, result);
            }
        });
    }

    unlock (device_data, callback) {
        this.intercoms.forEach(async (intercom) => {
            if (intercom.initialData.id = device_data.id) {
                const result = await intercom.unlock();
                callback(null, result.result.code === 0);
            }
        })
    }

    // This function will grab an image
    // This is called from the handler inside the image.setStream() in a device(.js)
    async grabImage (device_data, callback) {
        //this.log('grabImage', device_data);

        let result = ' ';
        try {
            this.cameras.forEach(async (camera) => {
                if (camera.initialData.id == device_data.id) {
                    try {
                        result =  await camera.getSnapshot();
                    } catch (error) {
                        callback(error,null);
                    }
                    callback(null, result);
                }
            });
        }
        catch (error) {
            this.log('Api.js grabImage',error.toString())
        }
    }

    enableMotion (device_data, callback) {
        //this.log('enableMotion', device_data);
        this.cameras.forEach(async (camera) => {
            if (camera.initialData.id == device_data.id) {
                let newSetting = this.getMotionSettings(true);
                this.log("MotionEnable:",newSetting)
                const result =  await this.cameras[this.cameras.indexOf(camera)].setDeviceSettings(newSetting);
                const mAlerts =  await this.cameras[this.cameras.indexOf(camera)].subscribeToMotionEvents();
                callback(null, result);
            }
        });
    }

    disableMotion (device_data, callback) {
        //this.log('disableMotion', device_data);
        this.cameras.forEach(async (camera) => {
            if (camera.initialData.id == device_data.id) {
                let newSetting = this.getMotionSettings(false);
                this.log("MotionDisable:",newSetting)
                const result =  await this.cameras[this.cameras.indexOf(camera)].setDeviceSettings(newSetting);
                const mAlerts =  await this.cameras[this.cameras.indexOf(camera)].unsubscribeFromMotionEvents();
                //this.log('disableMotion',result,'-');
                callback(null, result);
            }
        });
    }

    // called by the enableMotion() and disableMotion()
    getMotionSettings (enabled) {
        return {
            motion_settings: {
                motion_detection_enabled: enabled
            }
        };
    }

    // todo: functionality needs devicesetting
    enableMotionAlerts (device_data, callback) {
        //this.log('enableMotionAlerts', device_data);
        this.cameras.forEach(async (camera) => {
            if (camera.initialData.id == device_data.id) {
                const result =  await this.cameras[this.cameras.indexOf(camera)].subscribeToMotionEvents();
                callback(null, result);
            }
        });
    }

    // todo: functionality needs devicesetting
    disableMotionAlerts (device_data, callback) {
        //this.log('disableMotionAlerts', device_data);
        this.cameras.forEach(async (camera) => {
            if (camera.initialData.id == device_data.id) {
                const result =  await this.cameras[this.cameras.indexOf(camera)].unsubscribeFromMotionEvents();
                callback(null, result);
            }
        });
    }

    // this function is called from the autocomplete in flowcards
    userLocations() {
        this.log(`userLocations: Send request to retrieve all user locations in Ring`);
        return new Promise((resolve, reject) => {
            // Check if this.locations is defined and is an array
            if (Array.isArray(this.locations)) {
                const locations = this.locations.map(location => {
                    console.log(location.locationDetails.name)
                    return {
                        name: location.locationDetails.name,
                        id: location.locationDetails.location_id,
                        mode: 'unset'
                    };
                });
                resolve(locations);
            } else {
                // Handle the case where this.locations is undefined or not an array
                reject(new Error('Locations data is not available'));
            }
        });

    }

    setLocationMode(locationId,  mode) {
        //this.log(`setLocationMode: Send request to switch the location to a new mode`, mode);
        return new Promise((resolve, reject) => {
          this._setLocationMode(locationId,  mode, (error, result) => {
            if (error) {
              this.log(`setLocationMode error:`, error);
              return reject(error);
            }
            return resolve(result);
          })
        });
    }

    mapLocationMode (mode) {
        return {
           mode: mode
        };
    }

    _setLocationMode (locationId,  mode, callback) {
        //this.log('_setLocationMode')
        this.locations.forEach(async (location) => {
            if (location.locationDetails.location_id == locationId) {
                let result;
                const locationIndex = this.locations.indexOf(location);
                if ( this.location.hasAlarmBaseStation ) {
                    //this.log('_setLocationMode:         location has a Ring Alarm system')
                    try {
                        const alarmModes = { disarmed: 'none', home: 'some', away: 'all' };
                        result = await this.locations[locationIndex].setAlarmMode(alarmModes[mode]);
                        callback(null, result);
                    }
                    catch (error) {
                        this.log('_setLocationMode (Ring Alarm) error', error)
                        callback(error,null)
                    }
                } else {
                    //this.log('_setLocationMode:         location has no Ring Alarm system')
                    try {
                        result = await this.locations[locationIndex].setLocationMode(mode);
                        callback(null, result);
                    }
                    catch(error) {
                        this.log('_setLocationMode error', error)
                        callback(error,null)
                    }
                }
            }
        });
    }
}

module.exports = Api;
