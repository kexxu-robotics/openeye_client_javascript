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

    // calibration from the glasses to the screen
    this.calibration = {
        bx: 0, // add
        by: 0,
        r: 0.0, // rotate
        ax: 0.0, // mulitiply
        ay: 0.0
    }

    this.lastX = 0.0;
    this.lastY = 0.0;
    this.lastXcal = 0.0;
    this.lastYcal = 0.0;
    this.calPoints = [];

    // least squares fit calibration using calibration points
    this.calibration2 = {
        ax: 1,
        ay: 1,
        bx: 0,
        by: 0,
    }
}

OpenEye.prototype.fitCalPoints = function(){
    var values_x1 = [];
    var values_x2 = [];
    var values_y1 = [];
    var values_y2 = [];
    for(var i = 0; i < this.calPoints.length; i++){
        var p = this.calPoints[i];
        values_x1.push(p.x2);
        values_x2.push(p.x1);
        values_y1.push(p.y2);
        values_y2.push(p.y1);
    }
    // fit x
    var calx = this.leastSquares(values_x1, values_x2);
    console.log("Least squares calibration x:", calx);
    this.calibration2.ax = calx.m;
    this.calibration2.bx = calx.b;
    // fit y
    var caly = this.leastSquares(values_y1, values_y2);
    console.log("Least squares calibration y:", caly);
    this.calibration2.ay = caly.m;
    this.calibration2.by = caly.b;
    // clean
    this.calPoints = [];
}

OpenEye.prototype.leastSquares = function(values_x, values_y){
    var x_sum = 0;
    var y_sum = 0;
    var xy_sum = 0;
    var xx_sum = 0;
    var count = 0;

    /*
     * The above is just for quick access, makes the program faster
     */
    var x = 0;
    var y = 0;
    var values_length = values_x.length;

    if (values_length != values_y.length) {
        throw new Error('Least squares: The parameters values_x and values_y need to have same size!');
    }

    /*
     * Above and below cover edge cases
     */
    if (values_length === 0) {
        throw new Error('Least squares: No values provided!');
    }

    /*
     * Calculate the sum for each of the parts necessary.
     */
    for (let i = 0; i< values_length; i++) {
        x = values_x[i];
        y = values_y[i];
        x_sum+= x;
        y_sum+= y;
        xx_sum += x*x;
        xy_sum += x*y;
        count++;
    }

    /*
     * Calculate m and b for the line equation:
     * y = x * m + b
     */
    var m = (count*xy_sum - x_sum*y_sum) / (count*xx_sum - x_sum*x_sum);
    var b = (y_sum/count) - (m*x_sum)/count;
    
    return {m: m, b: b}
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
        var js = JSON.parse(msg.payloadString);
        var x = js["pupil_rel_pos_x"];
        var y = js["pupil_rel_pos_y"];
        self.positionCallback(x,y);
    }
    if(msg.topic.endsWith("/markers")){
        var js = JSON.parse(msg.payloadString);
        var left = {found: js["left_found"], x: js["left_x"], y: js["left_y"]};
        var right = {found: js["right_found"], x: js["right_x"], y: js["right_y"]};
        self.markersCallback(left, right);
    }
}



