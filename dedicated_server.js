// Require modules
const express = require('express');
const http = require('http');

// Settings
const PORT = process.env.PORT || 5000;

// Run the application
const app = express();
let server = http.Server(app);
server.listen(PORT, function () {
    console.log('gaze server running');
});

// Global storage
const STUDENT = 1;
const TEACHER = 2;
let all_fixations = new Map();
let all_saccades = new Map();
let last_seen = {};

app.get('/',(req, res) => {
    res.send(`<h1>Dedicated server is on.</h1>`);
})

app.get('/gazeData/teacher', (req, res) => {
    res.send(`<h1>Dedicated server, page /gazeData/teacher</h1>`);
})

app.post('/gazeData/teacher', express.json({ type: '*/*' }), async (req, res) => {
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

            res.statusCode = 200;

            // res.setHeader('Access-Control-Allow-Origin', '*')
            // res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
            // res.setHeader('Access-Control-Allow-Headers', 'x-api-key,Content-Type')

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
            // res.setHeader('Access-Control-Allow-Origin', '*')
            // res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
            // res.setHeader('Access-Control-Allow-Headers', 'x-api-key,Content-Type')
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

// ===================================
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
    let eig = new EigenvalueDecomposition(D.sub(distance));
    let lambda = eig.realEigenvalues.sort(); // js array
    let deltaLambda = lambda.slice(0, lambda.length - 1)
        .map((elem, i) => lambda[i + 1] - elem);
    let k = deltaLambda.slice(0, Math.ceil(lambda.length / 2))
        .reduce((maxIdx, item, index) => deltaLambda[maxIdx] < item ? index : maxIdx, 0) + 1;
    // var k = Math.random() > 0.5 ? 4 : 3;
    console.log(`k = ${k}`);

    let columns = [];
    for (let i = 0; i < k; i+=1) {
        columns.push(i);
    } // it surprises me that JS has no native function to generate a range...
    let data = eig.eigenvectorMatrix.subMatrixColumn(columns).to2DArray(); // Dimension reduced

    // K-means, run repeat times for stable clustering
    let trails = []
    for (let i = 0; i < repeat; i+=1) {
        trails.push(reorder(kmeans(data, k).clusters, k));
    }
    return mode(trails, k);
}

function reorder(cluster, k) {
    let prev = 0;
    let nClass = 1;
    let order = [cluster[prev]];

    while (nClass <= k) {
        if (cluster[prev] !== cluster[prev + 1] && order.indexOf(cluster[prev + 1]) === -1 ) {
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

