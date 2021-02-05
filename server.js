var svmpkg = require('machinelearn/svm')
var express = require('express');
const path = require('path');
var fs = require('fs');
const stream = require('stream');
var http = require('http');
const https = require('https');
const multipart = require("connect-multiparty");
const { Resolver } = require('dns').promises;
// var cors = require('cors')

var PORT = process.env.PORT || 5000;
var app = express();

let httpsServer;
let sslCrt = 'cert.pem';
let sslKey = 'privkey.pem';

// To process login form
const multipartyModdleware = multipart();

// const FILEPATH = 'D:/gazelearning/confusion_test/data_temp';
const FILEPATH = '/mnt/fileserver';

// Find dedicated service for instructor
const dedicated_service_hostname ='dedicated-nodejs-nodeport-service.default.svc.cluster.local';
let dedicated_service_address = undefined;
const resolver = new Resolver();
resolver.setServers(['10.52.0.10']); // Specify DNS server in the cluster.

resolver.resolve4(dedicated_service_hostname).then((addresses) => {
    console.log(`address of ${dedicated_service_hostname}: ${JSON.stringify(addresses)}`);
    dedicated_service_address = addresses[0]
}).catch(e => console.log(e));

// app.use(cors())
app.use(express.static('./'));

async function startServer() {
    console.log('starting express');
    try {
        const tls = {
            cert: fs.readFileSync(sslCrt),
            key: fs.readFileSync(sslKey),
        };
        httpsServer = https.createServer(tls, app);
        httpsServer.on('error', (e) => {
            console.error('https server error,', e.message);
        });
        await new Promise((resolve) => {
            httpsServer.listen(PORT, () => {
                console.log(`server is running and listening on ` +
                    `https://localhost:${PORT}`);
                resolve();
            });
        });
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.error('no certificates found (check config.js)');
            console.error('  could not start https server ... trying http');
        } else {
            err('could not start https server', e);
        }
        app.listen(PORT, () => {
            console.log(`http server listening on port ${PORT}`);
        });
    }
}

startServer()

app.post('/users', multipartyModdleware, function (req, res, next) {
    let content = req.body;
    console.log(content);

    if ( content['student-number'] && !fs.existsSync( path.join(FILEPATH, content['student-number'],'/gaze') ) ) {
        fs.mkdir(path.join(FILEPATH, content['student-number'],'/gaze'),
                { recursive: true },
                (err) => {
                    if (err) throw err;
                });
    } 

    res.cookie(
        'userInfo',
        JSON.stringify({'identity': content.identity,
        'number': content['student-number'] ? content['student-number'] : null,})
    );

    res.format({'application/json': function(){
        res.send({ message: 'Cookie set.' });
      }
    });

    res.send();
});

app.post('/gazeData/cluster', express.json(), function (req, res, next) {
    let fixations = req.body;
    console.log(`Receive ${fixations.length} fixations at ${new Date()}`);

    let fixationX = fixations.map(fixation => [fixation.x]);
    let fixationY = fixations.map(fixation => [fixation.y]);

    res.format({'application/json': function(){
        res.send({ result: JSON.stringify(spectralCluster(fixationX, fixationY, 5)) });
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

// HTTP server
// var server = http.Server(app);
// server.listen(PORT, function () {
//     console.log('gaze server running');
// });

// Socket.io
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
// const { OneClassSVM } = svmpkg;
// const svm = new OneClassSVM();
let dataset = [];

let confusion_queue = [];

app.post('/gazeData/sync',
    express.json({ type: '*/*' }),
    saveGazePoints,
    sendGazePoints,
    async (req, res) => {
        // let { , role, pts } = req.body;
        let role = +req.body['role'];
        console.log('==========================');
        console.log(`Received POST from ${role === 1 ? 'student' : 'teacher'}`);

        try {
            // we have students posting gaze information
            let stuNum = req.body['stuNum'];
            console.log(`Student number : ${stuNum}`);

            res.statusCode = 200;
            res.send({
                result: `Fixations and saccades are logged @ ${Date.now()}`,
            });
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

app.post('/gazeData/confusion', express.json({ type: '*/*' }), async (req, res) => {
    let { state, fixation } = req.body;
    confusion_queue.push(state);

    // svm.loadASM().then((loadedSVM) => {
    //     var clf_res = loadedSVM.predict([grid]);
    //     res.send({ result: clf_res });
    //     if (dataset.length < 50)
    //         loadedSVM.fit(dataset, new Array(dataset.length).fill(0));
    // });
    
});

// setInterval(() => {
//     let now = Date.now();
//     Object.entries(last_seen).forEach(([name, ts]) => {
//         if ((now - ts) > 5000) {
//             // console.log(`${name} lost connection. remove!`);
//             all_fixations.delete(name);
//             all_saccades.delete(name);
//         }
//     });
// }, 5000);

// Some codes about write gaze data into file, not tested yet

function saveGazePoints(req, res, next) {
    // Save gaze data from student

    const writableStream = fs.createWriteStream(
        path.join(FILEPATH,
            `/${req.body['stuNum']}`,
            '/gaze',
            `/${new Date().getTime()}.json`
    ));
    writableStream.write(JSON.stringify(req.body));

    // req is a ended stream.Readable. readable.readableEnded=true;
    next();
}

function sendGazePoints(req, res, next) {
    // Send gaze data to instructor
    const endpoint = dedicated_service_address+'/gazeData/teacher';

    const req_instructor = http.request(endpoint,
        {
            method: 'POST',
            headers: req.headers,
        },
        (res) => {
            console.log(`STATUS: ${res.statusCode}`);
            console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                console.log(`BODY: ${chunk}`);
            });
            res.on('end', () => {
                console.log('No more data in response.');
            });
        }
    )

    req_instructor.on('error', (e) => {
        console.error(`problem with request: ${e.message}`);
    });

    // Write data to request body
    req_instructor.write(JSON.stringify(req.body));
    req_instructor.end();

    next()
}
