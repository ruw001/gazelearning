var svmpkg = require('machinelearn/svm')
var PORT = process.env.PORT || 5000;
var express = require('express');
var app = express();

var http = require('http');
var server = http.Server(app);

// To process login form page
const multipart = require("connect-multiparty");
const multipartyModdleware = multipart();

app.use(express.static('./'));

app.post('/users', multipartyModdleware, function (req, res, next) {
    let content = req.body;
    console.log(content);

    res.cookie(
        'userInfo',
        JSON.stringify({'identity': content.identity,
        'number': content['student-number'] ? content['student-number'] : null,})
    );

    res.format({'application/json': function(){
        res.send({ message: 'hey' });
      }
    });

    res.send();
});
  
// Some codes about write gaze data into file, not tested yet

app.post('/gazeData', 
    saveGazePoints
);

app.get('/gazeData', 
    sendGazePoints
);

server.listen(PORT, function () {
    console.log('gaze server running');
});

// var io = require('socket.io')(server);

// io.on('connection', function (socket) {
//     socket.on('message', function (msg) {
//         io.emit('message', msg);
//     });
// });


// var sdk_key = "Mp3WNg7cR5Se5eseb20xX2sRBk4eARKfrsCP";
// var sdk_secret = "Ovbr5wsX7kmgN23dTEn19vSY7fg0Juenl86S";
// var session_ID = "2530883354";
// var session_pwd = "";

// function generateInstantToken(sdkKey, sdkSecret, topic, password = "") {
//     let signature = "";
//     // try {
//     const iat = Math.round(new Date().getTime() / 1000);
//     const exp = iat + 60 * 60 * 2;

//     // Header
//     const oHeader = { alg: "HS256", typ: "JWT" };
//     // Payload
//     const oPayload = {
//         app_key: sdkKey,
//         iat,
//         exp,
//         tpc: topic,
//         pwd: password,
//     };
//     // Sign JWT
//     const sHeader = JSON.stringify(oHeader);
//     const sPayload = JSON.stringify(oPayload);
//     signature = KJUR.jws.JWS.sign("HS256", sHeader, sPayload, sdkSecret);
//     return signature;
// }

// generateInstantToken(
//     sdk_key,
//     sdk_secret,
//     session_ID,
//     session_pwd
// ); // call the generateInstantToken function


// signaling stuff
var all_points = {};
var last_seen = {}
// const { OneClassSVM } = svmpkg;
// const svm = new OneClassSVM();
var dataset = []

app.post('/gazeData/sync', express.json({ type: '*/*' }), async (req, res) => {
    // let { , role, pts } = req.body;
    let stuNum = req.body['stuNum'];
    let role = +req.body['role'];
    let pts = req.body['pts'];
    try {
        if (role == 2) {
            // console.log(`Sending ${all_points[3][0]['x']}`);
            res.send({
                all_points
            });
        } else {
            all_points[stuNum] = pts;
            res.send({
                result: 'OK'
            });
            last_seen[stuNum] = Date.now();
        }
        
    } catch (e) {
        console.error(e.message);
        res.send({ error: e.message });
    }
});

app.post('/gazeData/svm', express.json({ type: '*/*' }), async (req, res) => {
    let {grid} = req.body;
    dataset.push(grid);
    res.send(Math.floor(Math.random() * 10));
    
    // svm.loadASM().then((loadedSVM) => {
    //     var clf_res = loadedSVM.predict([grid]);
    //     res.send({ result: clf_res });
    //     if (dataset.length < 50)
    //         loadedSVM.fit(dataset, new Array(dataset.length).fill(0));
    // });

});

setInterval(() => {
    let now = Date.now();
    Object.entries(last_seen).forEach(([name, ts]) => {
        if ((now - ts) > 5000) {
            // console.log(`${name} lost connection. remove!`);
            all_points[name] = [];
        }
    });
}, 5000);

// Some codes about write gaze data into file, not tested yet

const fs = require('fs');

function saveGazePoints(req, res, next) {
    // Save gaze data from student
    const writableStream = fs.createWriteStream(__dirname + '/gazeData/gaze.json');
    req.pipe(writableStream);

    req.on('end', ()=>{
        writableStream.end();
        // Return
        res.statusCode = 200;
        res.end();
    });
}

function sendGazePoints(req, res, next) {
    // Send gaze data to teacher
    const readableStream  = fs.createReadStream(__dirname + '/gazeData/gaze.json');
    readableStream.pipe(res);

    readableStream.on('end', ()=>{
        readableStream.end();
        // Return
        res.statusCode = 200;
        res.end();
    });
}