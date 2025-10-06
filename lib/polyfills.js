if (!global.fetch) {
    global.fetch = require('node-fetch');
}

if (!global.AbortSignal.timeout) {
    global.AbortSignal.timeout = (timeout) => {
        const controller = new AbortController();
        const abort = setTimeout(() => {
            controller.abort();
        }, timeout);
        return controller.signal;
    };
}

/** Polyfills for Homey 2018 and lower (Node.js 8.x) */

/** web streams  */
if (typeof global.ReadableStream === 'undefined') {
    require('web-streams-polyfill/polyfill');
    console.log('✓ ReadableStream loaded from web-streams-polyfill package');
}

/** DOMException polyfill  */
if (typeof global.DOMException === 'undefined') {
    try {
        global.DOMException = require('domexception');
        console.log('✓ DOMException loaded from domexception package');
    } catch (err) {
        console.log(
            '⚠ Could not load domexception package, creating fallback...'
        );
        // Fallback DOMException implementation
        global.DOMException = class DOMException extends Error {
            constructor(message = '', name = 'Error') {
                super(message);
                this.name = name;
                this.code = this._getCodeByName(name);
            }

            _getCodeByName(name) {
                const codes = {
                    AbortError: 20,
                    TimeoutError: 23,
                    NotSupportedError: 9,
                    NetworkError: 19,
                    InvalidStateError: 11,
                    SyntaxError: 12,
                };
                return codes[name] || 0;
            }
        };
        console.log('✓ Fallback DOMException created');
    }
}

/** BLOB polyfill  */
if (typeof global.Blob === 'undefined') {
    global.Blob = require('blob-polyfill').Blob;
    console.log('✓ Blob loaded from blob-polyfill package');
}
