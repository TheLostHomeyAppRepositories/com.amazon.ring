// Set up polyfills BEFORE any imports that might need them
if (typeof global.DOMException === 'undefined') {
    console.log('Setting up DOMException global...');
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
