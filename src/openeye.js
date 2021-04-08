var openeye;

function OpenEye(deviceIpAddress, deviceId){
    this.debug = false; // set to true to get all the MQTT output of the device in the console
    this.ipAddress = deviceIpAddress;
    this.deviceId = deviceId;
    this.client = {}; // mqtt socket client
    this.status = "not connected";
    this.statusCallback = function(){}; // overwrite this to get status updates
    this.positionCallback = function(x,y){console.log(x,y);}; // overwrite this to get position updates
}

OpenEye.prototype.setStatus = function(status){
    this.status = status;
    console.log(status);
    this.statusCallback(this.status);
}

OpenEye.prototype.connect = function(){
    var self = this;
    self.setStatus("connecting to device: "+self.deviceId+" on ip address: "+self.ipAddress);

    // Create a client instance
    self.client = new Paho.Client(self.ipAddress, Number(3000), "/mqtt", "OpenEye-javascript-client");

    // set callback handlers
    self.client.onConnectionLost = self.onConnectionLost.bind(self);
    self.client.onMessageArrived = self.onMessageArrived.bind(self);

    // connect the client
    self.client.connect({onSuccess: self.onConnect.bind(self), useSSL: false, timeout: 1});
}


// called when the client connects
OpenEye.prototype.onConnect = function() {
    var self = this;
    // Once a connection has been made, make a subscription and send a message.
    console.log("onConnect");
    self.setStatus("connected")
    self.client.subscribe("devices/"+self.deviceId+"/#");

}

OpenEye.prototype.sendMessage = function(topic, msg){
    var self = this;
    var message = new Paho.Message(msg);
    message.destinationName = topic;
    self.client.send(message);
}

// called when the client loses its connection
OpenEye.prototype.onConnectionLost = function(responseObject) {
    var self = this;
    if (responseObject.errorCode !== 0) {
        self.setStatus("connection lost");
        console.log("onConnectionLost:"+responseObject.errorMessage);
    }
}

// called when a message arrives
OpenEye.prototype.onMessageArrived = function(msg) {
    var self = this;
    if(self.debug){
        console.log(msg.topic, msg.payloadString);
    }
    var x = 0.0;
    var y = 0.0;
    if(msg.topic.endsWith("/eyetracking")){
        var js = JSON.parse(msg.payloadString);
        for(var i = 0; i < js.length; i++){
            if(js[i]["Feature"] === "pupil_rel_pos_x"){ x = js[i]["Value"]; }
            if(js[i]["Feature"] === "pupil_rel_pos_y"){ y = js[i]["Value"]; }
        }
        self.positionCallback(x,y);
    }
}



