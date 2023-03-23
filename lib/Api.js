'use strict';

const Homey = require('homey');

const https = require('https');
const crypto = require('crypto');
const events = require('events');
const stringify = require('querystring').stringify;

const client_api_host = 'api.ring.com';
const app_api_host = 'app.ring.com';

const refreshTimeout = 5000;
const refreshDeviceInterval = 5000;
const refreshDevicesInterval = 5000;
const refreshLocationModeInterval = 5000;
const verifyAuthenticationInterval = 60000;
const informAuthenticationStartDelay = 300000;
const informAuthenticationInterval = 14400000;

const parse = require('url').parse;

const sleep = time => new Promise(res=>setTimeout(res,time));

class Api extends Homey.SimpleClass {

    //https://httpstat.us/404

    log() {
        this.homey.log.bind(this, '[Api]').apply(this, arguments);
    }

    constructor(homey) {
        super();

        this.homey = homey;
        this._token = null;
        this._bearer = null;
        this._uniqueid = null;
        this._authenticated = false;
        this._previousAuthenticated = false;
        this._authenticating = false;
        this._apiversion = 11;

        this.homey.settings.on('set', (name) => this._onSetSettings(name));

        this.homey.setInterval(() => this._refreshDevice(), refreshDeviceInterval);
        this.homey.setInterval(() => this._refreshDevices(), refreshDevicesInterval);
        this.homey.setInterval(() => this._refreshLocationModes(), refreshLocationModeInterval);
        // this._verifyInterval = this.homey.setInterval(() => this._verifyAuthentication(), verifyAuthenticationInterval);

        // Delay the start for _informAuthentication so it's offset from the time the app starts
        // The offset is needed because reauthentication is mandatory each hour, starting from the time the app starts
        this.homey.setTimeout(() => {
            this.homey.setInterval(() => this._informAuthentication(), informAuthenticationInterval);
        }, informAuthenticationStartDelay);

    }

    async init () {
        this.log('Api.js                   initialising ==============')

        let token = this.homey.settings.get('ringAccesstoken');
        let bearer = this.homey.settings.get('ringBearer');

        this.homey.api.realtime('com.ring.status', { state: 'api_init'});
        await this.homey.cloud.getHomeyId()
            .then((cloudId) => {
                this._uniqueid = cloudId;

                if (token && bearer) {
                    this._token = token;
                    this._bearer = bearer;
                }

                this._verifyAuthentication((error, result) => {
                    if (!error)
                    {
                        //this.log('_verifyAuthentication:  ', result);
                        this.log('Api.js:                  initialising done =========')
                        this._refreshDevices();
                        this._refreshLocationModes();
                    } else {
                        this.log('_verifyAuthentication:   Failed');
                        this.log('Api.js:                  initialising done =========')
                        this.homey.emit('authenticationChanged', 'unauthenticated');
                        if ( this.homey.settings.get('ringRefreshToken') != null || this.homey.settings.get('ringRefreshToken') != undefined ) {
                            this._verifyInterval = this.homey.setInterval(() => this._verifyAuthentication(), verifyAuthenticationInterval);
                        }
                    }
                });   
            })
            .catch((error) => {return this.error(new Error('no_uniqueid'));})

    }

    _https_token (token, callback) {
        //this.log('_https_token'); // (step 6 in verification sequence)

        this.homey.settings.set('ringBearer', token);
        this._bearer = token;

        let postdata = JSON.stringify({
            device: {
                hardware_id: this._uniqueid,
                metadata: {
                    api_version: '11',
                },
                os: 'android'
            }
        });

        var timeout = setTimeout(() => {
            request.destroy();
        }, refreshTimeout);

        const url = parse('https://api.ring.com/clients_api/session?api_version=11', true);
        url.method = 'POST';
        url.headers = {
            Authorization: 'Bearer ' + token,
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

                if (response.statusCode >= 400 ) {
                    this._authenticated = false;
                    data = data.replace(/(\r\n|\n|\r)/gm, "");
                    this.log('_https_token : invalid_refresh : ', response.statusCode);
                    error = new Error('invalid_authentication ' + response.statusCode + ' ' + data);
                    let logLine = " Api.js || " + "_https_token || " + " invalid_refresh: " + response.statusCode;
                    this.homey.app.writeLog(logLine);
                    try {
                        report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                    } catch (e) {
                        report = JSON.parse(data);
                    }
                    this._setAuthenticationStatus(false, report);
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

    _https_auth_postdata_refresh () {
        //this.log('_https_auth_postdata_refresh'); // (step 4 in verification sequence)

        let refreshToken = this.homey.settings.get('ringRefreshToken');

        let postdata = JSON.stringify({
            client_id: "ring_official_android",
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            scope: "client"
        });

        return postdata;
    }
    
    _https_auth_postdata_auth (auth) {
        this.log('_https_auth_postdata_auth');

        let postdata = JSON.stringify({
            client_id: "ring_official_android",
            grant_type: "password",
            username: auth.user,
            password: auth.pass,
            scope: "client"
        });

        return postdata;
    }

    _https_auth_mfa_refresh (callback) {
        //this.log('_https_auth_mfa_refresh'); // (step 3 in verification sequence)

        let postdata = this._https_auth_postdata_refresh();

        var timeout = setTimeout(() => {
            request.destroy();
        }, refreshTimeout);

        const url = parse('https://oauth.ring.com/oauth/token');
        url.method = 'POST';
        url.headers = {
            'hardware_id': this._uniqueid,
            'content-type': 'application/json',
            '2fa-support': 'true',
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
                    error = new Error('invalid_refresh ' + response.statusCode + ' ' + data);
                    this.log('_https_auth_mfa_refresh : invalid_refresh : ', response.statusCode);
                    let logLine = " Api.js || " + "_https_auth_mfa_refresh || " + " invalid_refresh: " + response.statusCode;
                    this.homey.app.writeLog(logLine);
                    try {
                        report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                    } catch (e) {
                        report = JSON.parse(data);
                    }
                    this._setAuthenticationStatus(false, report);

                } else {
                    try {
                        result = JSON.parse(data);
                        this._setAuthenticationStatus(true, null);

                    } catch (e) {
                        error = e;
                    }
                }

                clearTimeout(timeout);
                //this.log('_https_auth_mfa_refresh: update cached refresh token for later use');  // (step 5 in verification sequence)
                this.homey.settings.set('ringRefreshToken', result.refresh_token);
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

    //Use this method to trigger the MFA message to use
    //Pass the auth object containing the user and pass
    _https_auth_cred (auth, callback) {
        this.log('_https_auth_cred');
        if (auth === null || auth === undefined) {
            return callback(new Error('invalid_credentials'));
        }
        let postdata = this._https_auth_postdata_auth(auth);

        var timeout = setTimeout(() => {
            request.destroy();
        }, refreshTimeout);

        const url = parse('https://oauth.ring.com/oauth/token');
        url.method = 'POST';
        url.headers = {
            'hardware_id': this._uniqueid,
            'content-type': 'application/json',
            '2fa-support': 'true',
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
                            report = JSON.parse(data);
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
                            report = JSON.parse(data);
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

        //let auth = this.homey.settings.get('ringCredentials');

        if (auth === null || auth === undefined) {
            return callback(new Error('invalid_credentials'));
        }

        let postdata = this._https_auth_postdata_auth(auth);

        var timeout = setTimeout(() => {
            request.destroy();
        }, refreshTimeout);

        const url = parse('https://oauth.ring.com/oauth/token');
        url.method = 'POST';
        url.headers = {
            'hardware_id': this._uniqueid,
            'content-type': 'application/json',
            '2fa-support': 'true',
            '2fa-code': code || '',
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
                        report = JSON.parse(data);
                    }
                    this._setAuthenticationStatus(false, report);

                } else {
                    try {
                        result = JSON.parse(data);
                        this.log('_https_auth_code: retrieved the refresh and access token')
                        this.homey.settings.set('ringRefreshToken', result.refresh_token);
                        this._bearer = result.access_token;
                        this.homey.settings.set('ringBearer', result.access_token);
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

    _https (method, host, path, postdata, raw, callback) {
        //this.log('_https', method, host, path);

        let headers = {};

        if (postdata == null)
            postdata = [];

        if (host == client_api_host && (method === 'POST' || method === 'PATCH')) {

            postdata['device[os]'] = 'ios',
            postdata['device[hardware_id]'] = this._uniqueid;
            postdata['api_version'] = this._apiversion;

            postdata = JSON.stringify(postdata);

            headers['hardware_id'] = this._uniqueid;
            headers['authorization'] = 'Bearer ' + this._bearer;
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            headers['Content-Length'] = postdata.length;
            headers['User-Agent'] = 'Homey';
            // this.log('Sending headers for client api');
        } else if (host == app_api_host) {
            headers['hardware_id'] = this._uniqueid;
            headers['authorization'] = 'Bearer ' + this._bearer;
            headers['User-Agent'] = 'android:com.ringapp';
            // this.log('sending headers for app api');
        } else {
            headers['Authorization'] = 'Bearer ' + this._bearer;
            headers['User-Agent'] = 'Homey';
            // this.log('sending base authentication only');
            if (!this._authenticated) {
                this.log('_https : not_authenticated');
                if (!this._authenticating) {
                    this._authenticating = true;
                    this._verifyAuthentication((error, result) => {
                        if (!error)
                        {
                            this._authenticating = false;
                            //this.log('_verifyAuthentication:  ', result);
                        } else {
                            this._authenticating = false;
                            this.log('_verifyAuthentication:   Failed');
                        }
                    });
                }
                return callback(new Error('not_authenticated'));
            }
        }

        if (path.includes('image')) {
            headers['hardware_id'] = this._uniqueid;            
            headers['authorization'] = 'Bearer ' + this._bearer;
        }

        var timeout = setTimeout(() => {
            request.destroy();
        }, refreshTimeout);

        let request = https.request({
            host: host,
            port: 443,
            path: path + '?auth_token=' + this._token + '&api_version=' + this._apiversion ,
            method: method,
            headers: headers,
            agent: false
        }, (response) => {
            let data = '';

            if (raw)
                response.setEncoding('binary');

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                let error = null;
                let result = {};
                let report = {};

                if (response.statusCode == 404) { 
                    //Not found. This happens when a snapshot is requested from an offline Doorbell, other reasons too?
                    data = data.replace(/(\r\n|\n|\r)/gm, "");
                    this.log('_https : resource not found : ', response.statusCode, data);
                    error = new Error('resource not found ' + response.statusCode + ' ' + data);
                    try {
                        report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                    } catch (e) {
                        report = JSON.parse(data);
                    }
                    this._setAuthenticationStatus(false, report);
                } else if (response.statusCode == 401) {
                    this._authenticated = false;
                    data = data.replace(/(\r\n|\n|\r)/gm, "");
                    // this.log('_https : Unauthorized:', response.statusCode, data);
                    error = new Error('resource not found ' + response.statusCode + ' ' + data);
                    if (!this._authenticating) {
                        this._authenticating = true;
                        this._verifyAuthentication((error, result) => {
                            if (!error)
                            {
                                this._authenticating = false;
                                //this.log('_verifyAuthentication:  ', result);
                            } else {
                                this._authenticating = false;
                                this.log('_verifyAuthentication:   Failed');
                            }
                        });
                    }
                } else if (response.statusCode >= 400) {
                    this._authenticated = false;
                    data = data.replace(/(\r\n|\n|\r)/gm, "");
                    this.log('_https : >= 400 ', response.statusCode, data);
                    this.log('_https', method, host, path);
                    error = new Error('invalid_authentication ' + response.statusCode + ' ' + data);
                    try {
                        report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                    } catch (e) {
                        report = JSON.parse(data);
                    }
                    this._setAuthenticationStatus(false, report);

                } else {
                    try {
                        if (!raw) {
                            result = JSON.parse(data);
                        } else {
                            result = data;
                        }

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

        if (method === 'POST' || method === 'PATCH') {
            request.write(postdata);
        }

        request.end();
    }

    _onSetSettings (name) {
        //this.log('_onSetSettings', name, this.homey.settings.get(name));

        if (name === 'isRevoked') {
            if (this.homey.settings.get(name)) {
                this.homey.settings.set('ringAccesstoken', null);
                this.homey.settings.set('ringBearer', null);
                this.homey.settings.set('ringRefreshToken', null);
                this.homey.settings.set('authenticationStatus', 'Authentication Revoked');
                this.homey.settings.set('authenticationError', "The authentication has been revoked.");

                this._authenticated = false;
                this.log('_onSetSettings: Authentication revoked from settings');
                let logLine = " Api.js || " + "_onSetSettings || " + " Authentication revoked from settings ";
                this.homey.app.writeLog(logLine);
                let report = JSON.parse('{"error": "Authentication Revoked", "error_description": "The authentication has been revoked."}');
                this._setAuthenticationStatus(false, report);
                //this.homey.api.realtime('com.ring.status', { state: 'unauthenticated'});
                //this.homey.emit('authenticationChanged', 'unauthenticated');
            }
        }

        if (name === 'ringAccesstoken') {
            // it could be this code is totally redundant that's why it's logging
            let token = this.homey.settings.get(name);

            if (token == null) {
                this.log("_onSetSettings - ringAccesstoken is null");    
                return;
            }
            //this.log("_onSetSettings - ringAccesstoken is set", this._token);
            this._token = token;
        }
    }

    _verifyAuthentication (callback) {
        //this.log('_verifyAuthentication'); // (step 1 in verification sequence)

        if (!this._authenticated) {
            this._authenticate((error, result) => {
                if (error) {
                    this.log(error);
                }

                if (callback)
                    return callback(error, true);
            });
        }
    }

    // This function will write a logline and write a timeline message when Homey is not Authenticated at Ring
    // This runs on an interval started in the constructor
    _informAuthentication () {
        //this.log('_informAuthentication');

        if (!this._authenticated) {
            this.log('_informAuthentication: Not authenticated. Message sent to timeline ');
            let logLine = " Api.js || " + "_informAuthentication || " + " Not authenticated ";
            this.homey.app.writeLog(logLine);
            this.homey.app.writeToTimeline('Homey is not authenticated at Ring. Please reauthenticate. '); 
        }
    }

    // This function sets the authentication when it changes from one state to another
    // It will log the change and sent out events.
    // When unauthenticated by an api error it starts a recurring attempt to authenticate
    _setAuthenticationStatus (status, report) {
        // this.log('_setAuthenticationStatus', status, result);

        if (this._previousAuthenticated != this._authenticated) {
            if (this._authenticated) {
                if (!this.NoAuthStatLogTimeout) {
                    this.log('_setAuthenticationStatus: Successfully Authenticated');
                    let logLine = " Api.js || " + "_setAuthenticationStatus || " + " Successfully Authenticated ";
                    this.homey.app.writeLog(logLine);
                } else {
                    // this.log('_setAuthenticationStatus: Successfully Authenticated, this.NoAuthStatLogTimeout != false');
                }
                clearTimeout(this.NoAuthStatLogTimeout);
                this.NoAuthStatLogTimeout = null;
                clearInterval(this._verifyInterval);

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
                    // this.log('_setAuthenticationStatus: No longer Authenticated')                    
                    // let logLine = " Api.js || " + "_setAuthenticationStatus || " + " Not Authenticated ";
                    // this.homey.app.writeLog(logLine);
                    await sleep(50);
                    this.homey.api.realtime('com.ring.status', { state: 'unauthenticated'});
                    this.homey.emit('authenticationChanged', 'unauthenticated');
                    // If the authentication is not manually revoked by the user enable the recurring attempt to authenticate
                    if (!this.homey.settings.get('isRevoked')) {
                        this._verifyInterval = this.homey.setInterval(() => this._verifyAuthentication(), verifyAuthenticationInterval);
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

    // This function tries to authenticate 
    // This function requires that the refresh token is already present
    // Called from _verifyAuthentication(), this is step 2
    // When successfull the _bearer/rinBearer and _token/rinAccesstoken will be set
    _authenticate (callback) {
        //this.log('_authenticate'); // (step 2 in verification sequence)

        this._https_auth_mfa_refresh((error, result) => {
            if (error) {
                this._authenticated = false;
                //report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                //this._setAuthenticationStatus(false, report);
                return callback(error);
            }

            this._bearer = result.access_token;
            this.homey.settings.set('ringBearer', result.access_token);

            this._https_token(result.access_token, (error, result) => {
                if (error) {
                    this._authenticated = false;
                    //report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                    //this._setAuthenticationStatus(false, report);
                    return callback(error);
                }

                if (typeof(result) == 'object' && result.hasOwnProperty('profile') &&
                    typeof(result.profile) == 'object' && result.profile.hasOwnProperty('authentication_token')) {
                    this._token = result.profile.authentication_token;
                    this._authenticated = true;
                    this._setAuthenticationStatus(true, null);

                    this.homey.settings.set('ringAccesstoken', result.profile.authentication_token);
                    return callback(null, true);
                } else {
                    this._authenticated = false;
                    //report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                    //this._setAuthenticationStatus(false, report);                    
                    return callback(new Error('authenticated_failed'));
                }
            });
        });
    }

    _refreshDevice () {
        //this.log('_refreshDevice');
        if (!this._authenticated) {
            // this.log('_refreshDevice: this._authenticated is false ');
            return;
        }

        this._https('GET', client_api_host, '/clients_api/dings/active', null, false, (error, result) => {
            if (error) {
                return this.error(error);
            }
            
            this.emit('refresh_device', result);
        });
    }

    _refreshDevices () {
        //this.log('_refreshDevices');
        if (!this._authenticated) {
            // this.log('_refreshDevices: this._authenticated is false ');
            return;
        }

        this.getDevices((error, result) => {
            if (error) {
                return this.error(error);
            }

            this.emit('refresh_devices', result);
        });
    }

    _refreshLocationModes () {
        //this.log('_refreshLocationModes');
        if (!this._authenticated) {
            // this.log('_refreshLocationModes: this._authenticated is false ');
            return;
        }

        this.userLocations().then(locations => {
            return locations;
        }).then(locations => {
            locations.forEach(location => {
                this.getLocationMode(location.id, (error,result) => {
                    if(error)
                        return error;
                    location.mode = result.mode;
                    this.emit('refresh_locationMode', location);
                });
            });
        }).catch(err => this.error('Failed to refresh location modes', err));

    }

    getDevices (callback) {
        this._https('GET', client_api_host, '/clients_api/ring_devices', null, false, (error, result) => {
            callback(error, result);
        });
    }

    ringChime (device_data, callback) {
        this.log('ringChime', device_data);
        this._https('POST', client_api_host, '/clients_api/chimes/' + device_data.id + '/play_sound', null, true, (error, result) => {
            callback(error, result);
        });
    }

    lightOn (device_data, callback) {
        this.log('lightOn', device_data);
        this._https('PUT', client_api_host, '/clients_api/doorbots/' + device_data.id + '/floodlight_light_on', null, true, (error, result) => {
            callback(error, result);
        });
    }

    lightOff (device_data, callback) {
        this.log('lightOff', device_data);
        this._https('PUT', client_api_host, '/clients_api/doorbots/' + device_data.id + '/floodlight_light_off', null, true, (error, result) => {
            callback(error, result);
        });
    }

    sirenOn (device_data, callback) {
        this.log('sirenOn', device_data);
        this._https('PUT', client_api_host, '/clients_api/doorbots/' + device_data.id + '/siren_on', null, true, (error, result) => {
            callback(error, result);
        });
    }

    sirenOff (device_data, callback) {
        this.log('sirenOff', device_data);
        this._https('PUT', client_api_host, '/clients_api/doorbots/' + device_data.id + '/siren_off', null, true, (error, result) => {
            callback(error, result);
        });
    }

    // This function will grab an image
    // This is called from the handler inside the image.setStream() in a device(.js)
    async grabImage (device_data, callback) {
        //this.log('grabImage', device_data);
        this.log('Api.js grabImage called from app.js grabImage (3)', device_data);

        let retries = 3;
        let postdata = {};
        let grab_time = Math.floor(Date.now() / 1000);
        let new_image = false;

        postdata['doorbot_ids'] = [device_data.id];

        for (let i = 0; i < retries; i++) {
            this._https('POST', client_api_host, '/clients_api/snapshots/timestamps', postdata, false, (error, result) => {
                if (error) {
                    let logLine = " Api.js || " + "grabImage || " + "_https POST returned error: " + error;
                    this.homey.app.writeLog(logLine);
                    this.log("grabImage _https POST returned error:",error);
                    this._https_auth_mfa_refresh((error, result) => {
                        if (error) {
                            this.log("grabImage _https_auth_mfa_refresh returned error:",error);
                            this._authenticated = false;
                            //report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                            //this._setAuthenticationStatus(false, report);
                            logLine = " Api.js || " + "grabImage || " + "_https_auth_mfa_refresh returned error: " + error;
                            this.homey.app.writeLog(logLine);
                            return callback(error, result);
                        } else {
                            this.homey.settings.set('ringBearer', result.access_token);
                            this._bearer = result.access_token;
                        }
                    });
                }

                if (!error && result && result.timestamps && result.timestamps[0] && result.timestamps[0].timestamp && ((result.timestamps[0].timestamp / 1000) >= grab_time))
                    new_image = true;
            });

            await sleep(1000);

            if (new_image)
                break;
        }

        let logLine = " Api.js || " + "grabImage || " + "after request for image, new_image: " + new_image;
        this.homey.app.writeLog(logLine);

        /* new_image indicates a fresh image, but we always return a image anyway */
        this._https('GET', client_api_host, '/clients_api/snapshots/image/' + device_data.id, null, true, (error, result) => {
            if (error) {
                let logLine = " Api.js || " + "grabImage || " + "_https GET returned error: " + error;
                this.homey.app.writeLog(logLine);
                this.log(error);
                this._https_auth_mfa_refresh((error, result) => {
                    if (error) {
                        this._authenticated = false;
                        //report = JSON.parse('{"error": "invalid_response ' + response.statusCode + '", "error_description": "' + data + '"}');
                        //this._setAuthenticationStatus(false, report);                        
                        logLine = " Api.js || " + "grabImage || " + "_https_auth_mfa_refresh returned error: " + error;
                        this.homey.app.writeLog(logLine);
                        return callback(error, result);
                    } else {
                        this.homey.settings.set('ringBearer', result.access_token);
                        this._bearer = result.access_token;
                        this._https('GET', client_api_host, '/clients_api/snapshots/image/' + device_data.id, null, true, (error, result) => {
                            logLine = " Api.js || " + "grabImage || " + "_https GET returned image ";
                            this.homey.app.writeLog(logLine);
                            return callback(error, result);
                        });
                    }
                });
            } else {
                let logLine = " Api.js || " + "grabImage || " + "_https GET returned image ";
                this.homey.app.writeLog(logLine);
                return callback(error, result);
            }
        });
    }

    enableMotion (device_data, callback) {
        this.log('enableMotion', device_data);

        let postdata = this.getMotionSettings(true);

        this._https('PATCH', client_api_host, '/devices/v1/devices/' + device_data.id + '/settings', postdata, false, (error, result) => {
            if (error){
                this.log(error);
            }
            // console.log("error:",error);
            // console.log("result:",result);
            callback(error, result);
        });
    }

    disableMotion (device_data, callback) {
        this.log('disableMotion', device_data);
    
        let postdata = this.getMotionSettings(false);

        this._https('PATCH', client_api_host, '/devices/v1/devices/' + device_data.id + '/settings', postdata, false, (error, result) => {
            callback(error, result);
        });
    }

    getMotionSettings (enabled) {
        return {
            motion_settings: {
                motion_detection_enabled: enabled
            }
        };
    }

    userLocations() {
        // this.log(`userLocations: Send request to retrieve all user locations in Ring`);

        return new Promise((resolve, reject) => {
          this._getLocations((error, result) => {
            if (error) {
              this.error(`getLocations: error with result:`, result);
              return reject(error);
            }
            const locations = result.user_locations.map(location => {
                return {
                    name: location.name,
                    id: location.location_id,
                    mode: 'unset'
                }
            });
            return resolve(locations);
          })
        });
    }

    _getLocations (callback) {
        // this.log('_getLocations');

        this._https('GET', client_api_host, '/devices/v1/locations', null, false, (error, result) => {
            if (error) {
                callback(error,null);
            }
            callback(error,result);
        });
    }

    getLocationMode (locationId, callback) {
        this._https('GET', app_api_host, '/api/v1/mode/location/'+locationId, null, false, (error, result) => {
            callback(error, result);
        });
    }

    setLocationMode(locationId,  mode) {
        this.log(`setLocationMode: Send request to switch the location to a new mode`);
        return new Promise((resolve, reject) => {
          this._setLocationMode(locationId,  mode, (error, result) => {
            if (error) {
              this.error(`setLocationMode: error with result:`, result);
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
        let postdata = this.mapLocationMode(mode);
        this._https('POST', app_api_host, '/api/v1/mode/location/'+locationId, JSON.stringify(postdata), true, (error, result) => {
            callback(error, result);
        });
    }
}

module.exports = Api;

// A successfull authentication sequence follows this order:

// 2023-03-03T19:12:14.914Z [log] [Api] _verifyAuthentication
// 2023-03-03T19:12:14.917Z [log] [Api] _authenticate
// 2023-03-03T19:12:14.919Z [log] [Api] _https_auth_mfa_refresh
// 2023-03-03T19:12:14.920Z [log] [Api] _https_auth_postdata_refresh
// 2023-03-03T19:12:15.182Z [log] [Api] _https_auth_mfa_refresh: update cached refresh token for later use
// 2023-03-03T19:12:15.194Z [log] [Api] _https_token
// 2023-03-03T19:12:15.643Z [log] [Api] _verifyAuthentication:   true
