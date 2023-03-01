'use strict';

const Homey = require('homey');

const api = require('./lib/Api.js');
const events = require('events');      

// !!!! remove next lines before publishing !!!!
// const LogToFile = require('homey-log-to-file');

class App extends Homey.App {

    async onInit() {    
        this.log(`${Homey.manifest.id} ${Homey.manifest.version}    initialising --------------`);
        this.lastLocationModes = [];
        
        // !!!! remove next lines before publishing !!!!
        if (process.env.DEBUG === '1') {
            //await LogToFile();
        }

        this._api = new api(this.homey);

        this._api.on('refresh_device', this._syncDevice.bind(this));
        this._api.on('refresh_devices', this._syncDevices.bind(this));
        this._api.on('refresh_locationMode', this._syncLocationMode.bind(this));

        await this._api.init();

        this._triggerLocationModeChangedTo = this.homey.flow.getTriggerCard('ring_location_mode_changed_generic');
        this.registerLocationModeChanged();

        this._conditionLocationMode = this.homey.flow.getConditionCard('ring_location_mode_active');
        this.conditionLocationMode();

        this._setLocationMode = this.homey.flow.getActionCard('change_location_mode');
        this.setLocationMode();

        this.log(`${Homey.manifest.id} ${Homey.manifest.version}    initialising done ---------`);

        let logLine = " app.js || onInit || --------- " + `${Homey.manifest.id} ${Homey.manifest.version} started ---------`;
        this.homey.app.writeLog(logLine);
    }

    // async LogToFile(logfile = '/userdata/std.log', port = 8008, flags = 'w')

    _syncDevice(data) {
        this.homey.emit('refresh_device', data);
    }

    _syncDevices(data) {
        this.homey.emit('refresh_devices', data);
    }

    getRingDevices(callback) {
        this._api.getDevices(callback);
    }

    lightOn(data, callback) {
        this._api.lightOn(data, callback);
    }

    lightOff(data, callback) {
        this._api.lightOff(data, callback);
    }

    sirenOn(data, callback) {
        this._api.sirenOn(data, callback);
    }

    sirenOff(data, callback) {
        this._api.sirenOff(data, callback);
    }

    ringChime(data, callback) {
        this._api.ringChime(data, callback);
    }

    grabImage(data, callback) {
        this.log("app.js grabImage has been called from setStream (2)");
        this._api.grabImage(data, callback);
    }

    enableMotion(data, callback) {
        this._api.enableMotion(data, callback);
    }

    disableMotion(data, callback) {
        this._api.disableMotion(data, callback);
    }

    logRealtime(event, details)
    {
        this.homey.api.realtime(event, details)
        console.log('Realtime event emitted for', event, details);
    }

    writeToTimeline(message) {
        this.homey.notifications.createNotification({ excerpt: message })
    }

    _syncLocationMode(newLocationMode)
    {
        if(this.lastLocationModes.length>0)
        {
            let matchedLastLocationMode = this.lastLocationModes.find(lastLocationMode =>{
                 return lastLocationMode.id==newLocationMode.id;
            });
            if(matchedLastLocationMode!=undefined)
            {
                //console.log('Check location mode for remembered location '+matchedLastLocationMode.name+' was in mode '+matchedLastLocationMode.mode+' and now is in mode '+newLocationMode.mode);
                if(matchedLastLocationMode.mode!=newLocationMode.mode)
                {
                    //console.log('location mode changed, raise the flow trigger!');
                    this.triggerLocationModeChanged({oldmode: matchedLastLocationMode.mode, mode: newLocationMode.mode},{location: newLocationMode});
                }
                matchedLastLocationMode.mode = newLocationMode.mode;
            }
            else {
                //console.log('recevied new location mode for location '+newLocationMode.name+', there is no old state known for this location');
                this.lastLocationModes.push(newLocationMode);
            }
        } else{
            //console.log('recevied new location mode for location '+newLocationMode.name+', there is no old state known for this location');
            this.lastLocationModes.push(newLocationMode);
        }
    }

    triggerLocationModeChanged(tokens, state) {
        this._triggerLocationModeChangedTo.trigger(tokens, state);
    }

    registerLocationModeChanged() {
        this._triggerLocationModeChangedTo
            .registerRunListener((args, state) => {
                return Promise.resolve( args.location.name === state.location.name );
            })
            .getArgument('location')
            .registerAutocompleteListener((query, args) => {
                return new Promise(async (resolve) => {
                const locations = await this._api.userLocations();
                console.log(locations);
                resolve(locations);
                });
            });
    }

    setLocationMode() {
        this._setLocationMode
            .registerRunListener(async (args, state) => {
                console.log('attempt to switch location ('+args.location.name+') to new state: '+args.mode);
                return new Promise((resolve, reject) => {
                this._api.setLocationMode(args.location.id,args.mode).then(() => {
                    resolve(true);
                }, (_error) => {
                    resolve(false);
                });
                });
            })
            .getArgument('location')
            .registerAutocompleteListener((query, args) => {
                return new Promise(async (resolve) => {
                const locations = await this._api.userLocations();
                console.log(locations);
                resolve(locations);
                });
            });
    }
    
    conditionLocationMode() {
        this._conditionLocationMode
            .registerRunListener((args, state) => {

                return new Promise((resolve, reject) => {
                    var matchedLocationMode = this.lastLocationModes.find(lastLocationMode =>{
                        return lastLocationMode.id==args.location.id;
                    });
                    if(matchedLocationMode!=undefined) {
                        console.log('stored location mode found for location '+matchedLocationMode.name);
                        resolve(matchedLocationMode.mode === args.mode);
                    } else {
                        reject('unknown location');
                    }
                });
            })
            .getArgument('location')
            .registerAutocompleteListener((query, args) => {
                return new Promise(async (resolve) => {
                const locations = await this._api.userLocations();
                console.log(locations);
                resolve(locations);
                });
            });
    }

    async getDevicesInfo() {
        return new Promise((resolve, reject) => {
        
            this.homey.app.getRingDevices((error, result) => {
                if (error) {
                return reject(error);
                }

                resolve(result);
            });

        });
    }

    // Write information to the Ring log and cleanup 20% when history above 2000 lines
    // - Called from multiple functions
    async writeLog(logLine) {
        let savedHistory = this.homey.settings.get('myLog');
        if ( savedHistory != undefined ) { 
            // cleanup history
            let lineCount = savedHistory.split(/\r\n|\r|\n/).length;
            if ( lineCount > 2000 ) {
                let deleteItems = parseInt( lineCount * 0.2 );
                let savedHistoryArray = savedHistory.split(/\r\n|\r|\n/);
                let cleanUp = savedHistoryArray.splice(-1*deleteItems, deleteItems, "" );
                savedHistory = savedHistoryArray.join('\n'); 
            }
            // end cleanup
            logLine = this.getDateTime() + logLine + "\n" + savedHistory;
        } else {
            console.log("savedHistory is undefined!")
        }
        this.homey.settings.set('myLog', logLine );

        logLine = "";
    }

    // Returns a date timestring including milliseconds to be used in loglines
    // - Called from multiple functions
    getDateTime() {
        let timezone = this.homey.clock.getTimezone()
        let date = new Date(new Date().toLocaleString("en-US", {timeZone: timezone}));
        let dateMsecs = new Date();

        let hour = date.getHours();
        hour = (hour < 10 ? "0" : "") + hour;
        let min  = date.getMinutes();
        min = (min < 10 ? "0" : "") + min;
        let sec  = date.getSeconds();
        sec = (sec < 10 ? "0" : "") + sec;
        let msec = ("00" + dateMsecs.getMilliseconds()).slice(-3)
        let year = date.getFullYear();
        let month = date.getMonth() + 1;
        month = (month < 10 ? "0" : "") + month;
        let day  = date.getDate();
        day = (day < 10 ? "0" : "") + day;
        return day + "-" + month + "-" + year + "  ||  " + hour + ":" + min + ":" + sec + "." + msec + "  ||  ";
    }

}

module.exports = App;
