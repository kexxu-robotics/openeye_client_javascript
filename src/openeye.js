var openeye;

function OpenEye(deviceIpAddress, deviceId){
    this.debug = false; // set to true to get all the MQTT output of the device in the console
    this.ipAddress = deviceIpAddress;
    this.deviceId = deviceId;
    this.client = {}; // mqtt socket client
    this.status = "not connected";
    this.statusCallback = function(){}; // overwrite this to get status updates
    this.positionCallback = function(x,y){console.log("position", x, y);}; // overwrite this to get position updates
    this.markersCallback = function(left, right){console.log("markers", left, right);}; // overwrite this to get position updates

    this.calibration = {
        bx: 0, // add
        by: 0,
        r: 0.0, // rotate
        ax: 0.0, // mulitiply
        ay: 0.0
    }
}

OpenEye.prototype.rotate = function(cx, cy, x, y, radians) {
    //var radians = (Math.PI / 180) * angle,
    cos = Math.cos(radians),
    sin = Math.sin(radians),
    nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
    ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
    return [nx, ny];
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
    console.log("onConnect ", self.deviceId);
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
    if(msg.topic.endsWith("/eyetracking")){
        var x = 0.0;
        var y = 0.0;
        var js = JSON.parse(msg.payloadString);
        for(var i = 0; i < js.length; i++){
            if(js[i]["Feature"] === "pupil_rel_pos_x"){ x = js[i]["Value"]; }
            if(js[i]["Feature"] === "pupil_rel_pos_y"){ y = js[i]["Value"]; }
        }
        self.positionCallback(x,y);
    }
    if(msg.topic.endsWith("/markers")){
        var js = JSON.parse(msg.payloadString);
        var left = {found: js["left_found"], x: js["left_x"], y: js["left_y"]};
        var right = {found: js["right_found"], x: js["right_x"], y: js["right_y"]};
        self.markersCallback(left, right);
    }
}



