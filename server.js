var svmpkg = require('machinelearn/svm')
var PORT = process.env.PORT || 5000;
var express = require('express');
var app = express();
const path = require('path');
var fs = require('fs');
const stream = require('stream');
let httpsServer;
// var cors = require('cors')

var http = require('http');
const https = require('https');
// var server = http.Server(app);
let sslCrt = 'cert.pem';
let sslKey = 'privkey.pem'
// To process login form page
const multipart = require("connect-multiparty");
const multipartyModdleware = multipart();

// const FILEPATH = 'D:/gazelearning/gazeData/sync';
const FILEPATH = '/mnt/fileserver'

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

    if (content['student-number'] && !fs.existsSync(path.join(FILEPATH, content['student-number']),'/gaze')) {
        fs.mkdirSync(path.join(FILEPATH, content['student-number'],'/gaze'));
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
    console.log(`Recieve ${fixations.length} fixations at ${new Date()}`);

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

// server.listen(PORT, function () {
//     console.log('gaze server running');
// });

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
const STUDENT = 1;
const TEACHER = 2;
let all_fixations = new Map();
let all_saccades = new Map();
let last_seen = {};
// const { OneClassSVM } = svmpkg;
// const svm = new OneClassSVM();
let dataset = [];

let confusion_queue = [];

app.post('/gazeData/sync', express.json({ type: '*/*' }), saveGazePoints, async (req, res) => {
    // let { , role, pts } = req.body;
    let role = +req.body['role'];
    console.log('==========================');
    console.log(`Received POST from ${role === 1 ? 'student' : 'teacher'}`);

    try {
        // teacher(2) or student(1)
        if (role === TEACHER) {
            // we have teacher request syncing

            let fixationX = [];
            let fixationY = [];

            let fixationFlat = [];
            let saccadeFlat = [];

            all_fixations.forEach(fixations => {
                fixationFlat.push(
                    fixations
                );
            });

            all_saccades.forEach(saccades => {
                saccadeFlat.push(
                    saccades
                );
            });

            fixationFlat = fixationFlat.flat();
            saccadeFlat = saccadeFlat.flat();

            fixationX = fixationFlat.map(fixation => [fixation.x]);
            fixationY = fixationFlat.map(fixation => [fixation.y]);

            console.log(`Fixations to cluster : ${fixationX.length}`);

            res.format({'application/json': function(){
                    res.send({
                        fixations: fixationFlat,
                        saccades: saccadeFlat,
                        result: spectralCluster(fixationX, fixationY, 5),
                    });
                }
            });

            res.send();
        } else {
            // we have students posting gaze information
            let stuNum = req.body['stuNum'];
            console.log(`Student number : ${stuNum}`);

            all_fixations.set(stuNum, req.body['fixations']);
            all_saccades.set(stuNum, req.body['saccades']);

            console.log(`Receive ${all_fixations.get(stuNum).length} fixations at ${new Date()}`);

            res.statusCode = 200;
            res.send({
                result: `Fixations and saccades are logged @ ${Date.now()}`,
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

setInterval(() => {
    let now = Date.now();
    Object.entries(last_seen).forEach(([name, ts]) => {
        if ((now - ts) > 5000) {
            // console.log(`${name} lost connection. remove!`);
            all_fixations.delete(name);
            all_saccades.delete(name);
        }
    });
}, 5000);

// Some codes about write gaze data into file, not tested yet

function saveGazePoints(req, res, next) {
    // Save gaze data from student

    const writableStream = fs.createWriteStream(
        path.join(FILEPATH,
            `/${req.body['stuNum']}`,
            `/${new Date().getTime()}.json`
    ));
    writableStream.write(JSON.stringify(req.body));

    // req is a ended stream.Readable. readable.readableEnded=true;
    next();
}

function sendGazePoints(req, res, next) {
    // Send gaze data to teacher
    const readableStream  = fs.createReadStream(path.join(FILEPATH,'/gazeData/gaze.json'));
    readableStream.pipe(res);

    readableStream.on('end', ()=>{
        readableStream.end();
        // Return
        res.statusCode = 200;
        res.end();
    });
}

// Some code about spectral clustering
const kmeans = require('ml-kmeans');
const { Matrix, EigenvalueDecomposition } = require('ml-matrix');

function spectralCluster(X, Y, repeat) {
    console.log(`inside spectral cluster, X : ${X.length}, Y : ${Y.length}, repeat : ${repeat}`)

    let matX = X instanceof Matrix ? X : new Matrix(X);
    let matY = Y instanceof Matrix ? Y : new Matrix(Y);

    // Construct similarity matrix
    let sigma = 5;
    let distance = matX.repeat({columns:matX.rows})
                    .subtract(matX.transpose().repeat({rows:matX.rows}))
                    .pow(2)
                    .add(
                        matY.repeat({columns:matY.rows})
                        .subtract(matY.transpose().repeat({rows:matY.rows}))
                        .pow(2)
                    ).sqrt().div(-2*sigma*sigma).exp();
    let D = Matrix.diag(
        distance.mmul(Matrix.ones(distance.rows, 1)).to1DArray()
    );

    // Eigenvalue decomposition
    var eig = new EigenvalueDecomposition(D.sub(distance));
    var lambda = eig.realEigenvalues.sort(); // js array
    var deltaLambda = lambda.slice(0, lambda.length - 1)
                            .map((elem, i) => lambda[i+1] - elem);
    var k = deltaLambda.slice(0, Math.ceil(lambda.length / 2))
            .reduce((maxIdx, item, index)=>deltaLambda[maxIdx] < item ? index : maxIdx, 0) + 1;
    // var k = Math.random() > 0.5 ? 4 : 3;
    console.log(`k = ${k}`);

    var columns = [];
    for (let i = 0; i < k; i+=1) {
        columns.push(i);
    } // it suprises me that JS has no native function to generate a range...
    var data = eig.eigenvectorMatrix.subMatrixColumn(columns).to2DArray(); // Dimension reduced

    // K-means, run repeat times for stable clustering
    let trails = []
    for (let i = 0; i < repeat; i+=1) {
        trails.push(reorder(kmeans(data, k).clusters, k));
    }
    return mode(trails, k); 
}

function shapeLog(name, data) {
    console.log(`${name} shape: ${data.rows} x ${data.columns}`);
}

function reorder(cluster, k) {
    let prev = 0;
    let nClass = 1;
    let order = [cluster[prev]];

    while (nClass <= k) {
        if (cluster[prev] != cluster[prev + 1] && order.indexOf(cluster[prev + 1])==-1 ) {
            nClass+=1;
            order.push(cluster[prev + 1]);
        }
        prev += 1;
    }

    return cluster.map(elem=>order.indexOf(elem));
}

function mode(nestedArray, max) {
    let depth = nestedArray.length;
    let arrLen = nestedArray[0].length;
    let mode = [];

    for (let i = 0; i < arrLen; i+=1) {
        let elemCount = Matrix.zeros(1, max).to1DArray();
        for (let j = 0; j < depth; j+=1) {
            elemCount[ nestedArray[j][i] ] += 1;
        }
        mode.push( elemCount.indexOf( Math.max(...elemCount) ));
    }

    console.log(mode);
    return mode
}