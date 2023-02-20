function onHomeyReady(Homey) {
    Homey.ready();

    writeAuthenticationState();

    Homey.on('com.ring.status', function (data) {
        if (data.state !== 'authenticated') {
             hideRevoke();
        } else {

        }
    });

    Homey.get('ringAccesstoken', function (err, data) {
        if (!data) {
            // hideRevoke();
        }
    });

    document.getElementById('settings-auth-revoke').addEventListener('click', function(elem) {
        onRevokeAuth(Homey);
    });

    document.getElementById('login-credentials-logo').addEventListener('click', function(elem) {
        getDevices();
    });

}

async function hideRevoke()
{
    document.getElementById('settings-auth-revoke').style.display = 'none';
  
}

async function writeAuthenticationState() {
    await Homey.get('authenticationStatus')
        .then(async (result) => {
            if (result == "Authenticated") {
                //this.htmlString = Homey.__("settings.auth.result") + "<br /><span style='color: green;'><b>"
                this.htmlString = "<span style='color: green;'>"
                //this.htmlString += result 
                this.htmlString += Homey.__("settings.auth.success")
                this.htmlString += "<br /><br />"
                document.getElementById('error').innerHTML = this.htmlString;
                document.getElementById('settings-auth-revoke').style.display = '';
            } else {
                //this.htmlString = Homey.__("settings.auth.result") + "<br /><span style='color: red;'>"
                this.htmlString = "<span style='color: red;'><b>"
                this.htmlString += result
                this.htmlString += "</b></span><br />" + Homey.__("settings.auth.error") + "<br /><span style='color: red;'>"
                await Homey.get('authenticationError')
                    .then((result) => {
                    this.htmlString += result
                })
                this.htmlString += "</span><br /><br />" + Homey.__("settings.auth.action") + "<br /><br />"
                document.getElementById('error').innerHTML = this.htmlString;
                hideRevoke();
            }
        })
}

function onRevokeAuth(Homey) {
    Homey.set('ringAccesstoken', null);
    Homey.set('ringBearer', null);
    Homey.set('ringRefreshToken', null);
    Homey.set('authenticationStatus', 'Authentication Revoked');
    Homey.set('authenticationError', "--");
    writeAuthenticationState();
    hideRevoke();
}

async function getDevices() {
    Homey.api('GET', '/devicesinfo')
    .then((result) => {
        const mystring = JSON.stringify(result);
        console.log(mystring);
    })
    .catch((error) => {    
        console.log(error);
    })
}
