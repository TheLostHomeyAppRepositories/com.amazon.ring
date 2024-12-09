
module.exports.loadRingApi = (platformVersion) => {
  return require(platformVersion == 1 ? '../ring-client-api13.1.0' : '../ring-client-api13.1.0');
}
