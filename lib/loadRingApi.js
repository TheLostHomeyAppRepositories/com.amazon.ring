module.exports = function loadRingClientApi() {
  const supportsModern = typeof ReadableStream !== 'undefined' && typeof Blob !== 'undefined';
  const ringClient = supportsModern
    ? require('../ring-client-api')
    : require('../ring-client-api13.1.0');

  console.log(`Loaded ring-client-api ${supportsModern ? 'latest' : '13.1.0'}`);
  
  return { ringClient, supportsModern };
};
