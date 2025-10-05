if (!global.fetch) {
    global.fetch = require('node-fetch');
}

if (!global.AbortSignal.timeout) {
    global.AbortSignal.timeout = timeout => {
        const controller = new AbortController();
        const abort = setTimeout(() => {
            controller.abort();
        }, timeout);
        return controller.signal;
    }
}
