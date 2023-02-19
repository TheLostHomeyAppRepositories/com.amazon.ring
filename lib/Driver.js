'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {

    //onPair (socket) {
    async onPair (session) {
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
                    this.log('login error, try again');
                    session.emit("authentication", "Failed");
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
                    session.emit("authentication", "Failed");
                    return error;
                } else {
                    session.emit("authentication", "Success");
                    return result;
                }
            });
        });

        session.setHandler('status', async (data) => {
            this.log('status: ')

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

    async onRepair (session) {
        this.log('onRepair');

        session.setHandler('showView', async (viewId)=>{

            if(viewId=='start')
            {
                this.log('start view loading, check validation');
                if(this.homey.app._api._authenticated)
                {
                    this.log('API is already authenticated, repair is done.');
                    session.showView('status');
                    session.emit("authentication", "Success");
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
                    this.log('login error, try again');
                    session.emit("authentication", "Failed");
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
                    session.emit("authentication", "Failed");
                    return error;
                } else {
                    session.emit("authentication", "Success");
                    return result;
                }
            });
        });

        session.setHandler('status', async (data) => {
            this.log('status: ')
            session.done();
        });
    }
}

module.exports = Driver;