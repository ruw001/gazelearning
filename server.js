var PORT = process.env.PORT || 5000;
var express = require('express');
var app = express();

var http = require('http');
var server = http.Server(app);

app.use(express.static('./'));

server.listen(PORT, function () {
    console.log('gaze server running');
});

var sdk_key = "Mp3WNg7cR5Se5eseb20xX2sRBk4eARKfrsCP";
var sdk_secret = "Ovbr5wsX7kmgN23dTEn19vSY7fg0Juenl86S";
var session_ID = "2530883354";
var session_pwd = "";

function generateInstantToken(sdkKey, sdkSecret, topic, password = "") {
    let signature = "";
    // try {
    const iat = Math.round(new Date().getTime() / 1000);
    const exp = iat + 60 * 60 * 2;

    // Header
    const oHeader = { alg: "HS256", typ: "JWT" };
    // Payload
    const oPayload = {
        app_key: sdkKey,
        iat,
        exp,
        tpc: topic,
        pwd: password,
    };
    // Sign JWT
    const sHeader = JSON.stringify(oHeader);
    const sPayload = JSON.stringify(oPayload);
    signature = KJUR.jws.JWS.sign("HS256", sHeader, sPayload, sdkSecret);
    return signature;
}

// generateInstantToken(
//     sdk_key,
//     sdk_secret,
//     session_ID,
//     session_pwd
// ); // call the generateInstantToken function

// var io = require('socket.io')(server);

// io.on('connection', function (socket) {
//     socket.on('message', function (msg) {
//         io.emit('message', msg);
//     });
// });