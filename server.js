const crypto = require('crypto');
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

server.listen(PORT, function () {
    console.log('gaze server running');
});

// var io = require('socket.io')(server);

// io.on('connection', function (socket) {
//     socket.on('message', function (msg) {
//         io.emit('message', msg);
//     });
// });

function generateSignature(apiKey, apiSecret, meetingNumber, role) {

    // Prevent time sync issue between client signature generation and zoom 
    const timestamp = new Date().getTime() - 30000
    const msg = Buffer.from(apiKey + meetingNumber + timestamp + role).toString('base64')
    const hash = crypto.createHmac('sha256', apiSecret).update(msg).digest('base64')
    const signature = Buffer.from(`${apiKey}.${meetingNumber}.${timestamp}.${role}.${hash}`).toString('base64')

    return signature
}


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

// Some code about spectral clustering
const kmeans = require('ml-kmeans');
const { Matrix, EigenvalueDecomposition } = require('ml-matrix');

function spectralCluster(X, Y, repeat) {
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