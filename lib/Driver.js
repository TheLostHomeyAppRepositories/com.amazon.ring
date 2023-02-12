'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {

    //onPair (socket) {
    onPair (session) {
        this.log('onPair');

        session.setHandler('showView', async (viewId)=>{

            if(viewId=='start')
            {
                this.log('start view loading, check validation');
                if(this.homey.app._api._authenticated)
                {
                    this.log('API is already authenticated, skip authentication');
                    session.showView('list_devices');
                } else {
                    this.log('API is not yet authenticated, perform authentication');
                }
            }
            if(viewId=='list_devices')
            {
                this.log('list devices view loading')
            }
        });

        //Trigger the MFA code message to the user and tell the interface to allow code entry
        session.setHandler('triggerMFA', async (auth) => {
            await this.homey.app._api._https_auth_cred(auth, (error, result) => {
                if (error) {
                    this.log('login error, what happens now?');
                    // Onderstaand is niet goed, moet iets komen om in de catch terecht tekomen
                    // throw Error(error);
                    return 'error';
                } else {
                    return result;
                }
            });
        });

       //Trigger the MFA code message to the user and tell the interface to allow code entry
       session.setHandler('validateMFA', async (auth) =>{
            await this.homey.app._api._https_auth_code(auth, auth.token, (error, result) => {
                if (error) {
                    return error;
                } else {
                    return result;
                }
            });
        });

        session.setHandler('list_devices', async (data) => {
            this.log('list_devices: ',data)
            if (this.onPairListDevices) {
                return await this.onPairListDevices();
            } else {
                console.log('missing _onPairListDevices');
                return new Error('missing _onPairListDevices');
            }
        });

    }

    onRepair (session, device) {
        this.log('onRepair');

        session.setHandler('showView', async (viewId)=>{

            if(viewId=='start')
            {
                this.log('start view loading, check validation');
                if(this.homey.app._api._authenticated)
                {
                    this.log('API is already authenticated, skip authentication');
                    session.showView('list_devices');
                } else {
                    this.log('API is not yet authenticated, perform authentication');
                }
            }
            if(viewId=='list_devices')
            {
                this.log('list devices view loading')
            }
        });

        //Trigger the MFA code message to the user and tell the interface to allow code entry
        session.setHandler('triggerMFA', async (auth) => {
            await this.homey.app._api._https_auth_cred(auth, (error, result) => {
                if (error) {
                    this.log('login error, what happens now?');
                    // Onderstaand is niet goed, moet iets komen om in de catch terecht tekomen
                    // throw Error(error);
                    return 'error';
                } else {
                    return result;
                }
            });
        });

       //Trigger the MFA code message to the user and tell the interface to allow code entry
       session.setHandler('validateMFA', async (auth) =>{
            await this.homey.app._api._https_auth_code(auth, auth.token, (error, result) => {
                if (error) {
                    return error;
                } else {
                    return result;
                }
            });
        });

        session.setHandler('list_devices', async (data) => {
            this.log('list_devices: ',data)
            if (this.onPairListDevices) {
                return await this.onPairListDevices();
            } else {
                console.log('missing _onPairListDevices');
                return new Error('missing _onPairListDevices');
            }
        });
    }
}

module.exports = Driver;
