module.exports =  {    
    async getDevicesInfo({ homey }){
        return homey.app.getDevicesInfo();
    }
    
}