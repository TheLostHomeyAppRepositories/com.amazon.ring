function onHomeyReady(Homey) {
    Homey.ready();

    this.doubleClicked = false;
    this.keysEntered = "";

    writeAuthenticationState();

    Homey.on('com.ring.status', function (data) {
        writeAuthenticationState();
    });

    Homey.get('ringAccesstoken', function (err, data) {
        if (!data) {
            // hideRevoke();
        }
    });

    document.getElementById('settings-auth-revoke').addEventListener('click', function(elem) {
        onRevokeAuth(Homey);
    });

    // The stuff below is just for troubleshooting in the Developer Tools and will only work in a browser on a computer
    // Will not work on:
    let regexp = /android|iphone|ipad/i;
    let isMobileDevice = regexp.test(navigator.userAgent);
    let _this = this;
    if (!isMobileDevice) {
        console.clear();
        console.log('Single Click the Ring logo to see all devices info');
        console.log('Double Click the Ring logo to see the log');
        console.log('Type "Clearlog" to clear the log');
        console.log('Press the Enter key to clear the type buffer');
        // Single Click, get all devices info
        document.getElementById('login-credentials-logo').addEventListener('click', function(elem) {
            // Set a timeout so the code isn't run before we know if there's a double click
            var timeout = setTimeout(() => {
                getDevices();
            }, 500);

        });
        // Double Click show the log
        document.getElementById('login-credentials-logo').addEventListener('dblclick', function(elem) {
            // before this event 2 single click event have fired!
            _this.doubleClicked = true;
            var timeout = setTimeout(() => {
                _this.doubleClicked = false;
            }, 500);

            Homey.get('myLog', function(err, logging){
                if( err ) {
                    console.error('showHistory: Could not get history', err);
                    return
                }
                console.clear();
                console.log(logging);
            });
        });
        // Check type text, if its Clearlog, clear it.
        document.addEventListener('keypress', function(event) {
            _this.keysEntered += event.key;
            if (_this.keysEntered == "Clearlog" ) {
                Homey.set('myLog','');
                console.clear();
                console.log("log was cleared");
                _this.keysEntered = "";
            }
            if (event.key == "Enter") {
                console.log("Try again...");
                _this.keysEntered = "";
            }
        });
    }
}

async function writeAuthenticationState() {
    await Homey.get('authenticationStatus')
        .then(async (result) => {
            if (result == "Authenticated") {
                this.htmlString = "<span style='color: green;'>"
                this.htmlString += Homey.__("settings.auth.success")
                this.htmlString += "<br /><br />"
                document.getElementById('error').innerHTML = this.htmlString;
                document.getElementById('settings-auth-revoke').style.display = '';
            } else {
                this.htmlString = "<span style='color: red;'><b>"
                this.htmlString += result
                this.htmlString += "</b></span><br />" + Homey.__("settings.auth.error") + "<br /><span style='color: red;'>"
                await Homey.get('authenticationError')
                    .then((result) => {
                        this.htmlString += result
                    })
                this.htmlString += "</span><br /><br />" + Homey.__("settings.auth.action") + "<br /><br />"
                document.getElementById('error').innerHTML = this.htmlString;
                document.getElementById('settings-auth-revoke').style.display = 'none';
            }
        })
}

function onRevokeAuth(Homey) {
    Homey.set('ringAccesstoken', null);
    Homey.set('ringBearer', null);
    Homey.set('ringRefreshToken', null);
    Homey.set('authenticationStatus', 'Authentication Revoked');
    Homey.set('authenticationError', "The authentication has been revoked.");
}

async function getDevices() {
    if (!this.doubleClicked) {
        Homey.api('GET', '/devicesinfo')
        .then((result) => {
            const mystring = JSON.stringify(result);
            console.log(mystring);
        })
        .catch((error) => {    
            console.log(error);
        })
        this.doubleClicked = false;
    }
}
