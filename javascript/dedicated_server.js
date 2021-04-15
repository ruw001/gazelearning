// Require modules
const {errorHandler} = require("./errorHandler");

const express = require('express');
const http = require('http');
const path = require('path');

// Settings
const PORT = process.env.PORT || 5000;

// Run the application
const app = express();
let server = http.Server(app);
server.listen(PORT, function () {
    console.log('dedicated server running');
});

// Global storage
const STUDENT = 1;
const TEACHER = 2;
let all_fixations = new Map();
let all_saccades = new Map();
let last_seen = {};

// Deploy or test locally
const DEPLOY = true;

app.get('/',(req, res) => {
    if (DEPLOY) {
        // When deployed on k8s
        res.send(`<h1>Dedicated server is on.</h1>`);
    } else {
        // When testing locally
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
})

// ===================================
// When testing locally
if (!DEPLOY) {
    const multipart = require("connect-multiparty");
    const multipartyMiddleware = multipart();
    const fs = require('fs');

    const FILEPATH = '/Users/hudongyin/Documents/Projects/gazelearning/python/data_temp';
    // please change to local filepath where gaze/face will be stored

    let registeredStudents = new Map(); // Student Name => Student Number, which is the order of student
    fs.readFile("./restricted/users/registeredStudents.json", 'utf-8', (err, data) => {
        if (err) throw err;
        let nameList = JSON.parse(data);
        nameList.forEach((item, index) => {
            registeredStudents.set([item.firstName, item.lastName].join(' '), index);
        });
    });

    const teacherPasscodeHash = 'a5ec177fcb171aee626a6c5785c7274693a6a35a8adeae663a9746177ed9ddac';
    const studentAuthHash = '264c8c381bf16c982a4e59b0dd4c6f7808c51a05f64c35db42cc78a2a72875bb';
    const teacherAuthHash = '1057a9604e04b274da5a4de0c8f4b4868d9b230989f8c8c6a28221143cc5a755';

    app.use(express.static(path.join(__dirname, 'public')));
    app.post('/users', multipartyMiddleware, newUserLogin);
    app.get('/studentPage.html',
        (req, res) => {
            res.statusCode = 200;
            res.sendFile(path.join(__dirname, 'restricted', 'studentPage.html'));
        });
    app.get('/teacherPage.html',
        (req, res) => {
            res.statusCode = 200;
            res.sendFile(path.join(__dirname, 'restricted', 'teacherPage.html'));
        });

    function newUserLogin(req, res, next) {
        // Creates user directory and generate cookie
        let content = req.body;
        console.log(content);
        const identity = +content.identity;

        if (identity === STUDENT) {
            // Check if the name is valid. All name will be converted to lower case at client side.
            if (!registeredStudents.has(content.name)) {
                let err = new Error('Student name not registered.');
                err.statusCode = 401;
                return next(err);
            }

            const studentNumber = registeredStudents.get(content.name).toString();
            if (!fs.existsSync(path.join(FILEPATH, studentNumber), '/gaze')) {
                fs.mkdir(path.join(FILEPATH, studentNumber, '/gaze'),
                    {recursive: true},
                    (err) => {
                        if (err) throw err;
                    });
            }
        } else {
            // Teacher
            // Check if correct passcode is provided.
            if (content.passcodeHash !== teacherPasscodeHash) {
                let err = new Error('Wrong teacher passcode. Please retry.');
                err.statusCode = 401;
                return next(err);
            }
        }

        res.cookie(
            'userInfo',
            JSON.stringify({
                'identity': content.identity,
                'number': identity === STUDENT ? registeredStudents.get(content.name) : null,
                'authcode': identity === STUDENT ? studentAuthHash : teacherAuthHash,
            })
        );

        res.send({message: 'Cookie set.'});
    }


    // ===================================
    // Deployment code on k8s. Responsible for spectral clustering.
    // Now moved to python dedicated server.
    // ===================================
    app.get('/gazeData/teacher', (req, res) => {
        res.send(`<h1>Dedicated server, page /gazeData/teacher</h1>`);
    })

    app.post('/gazeData/teacher', express.json({type: '*/*'}), async (req, res) => {
        // let { , role, pts } = req.body;
        let role = +req.body['role'];
        console.log('==========================');
        console.log(`Received POST from ${role === STUDENT ? 'student' : 'teacher'}`);

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

                fixationX = fixationFlat.map(fixation => [fixation.x_per]);
                fixationY = fixationFlat.map(fixation => [fixation.y_per]);

                console.log(`Fixations to cluster : ${fixationX.length}`);

                res.statusCode = 200;
                res.format({
                    'application/json': function () {
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
            res.send({error: e.message});
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
}

// ===================================
// Some code about administration control (Information Hub)
const crypto = require("crypto");
const cookieParser = require('cookie-parser');
const passcodeHash = "f1318196aaf4c2fc35932ac09b63d6bbde01fde79c401870a8321b361a47b01d";
let digestMessage = function (message) {
    return crypto.createHash("sha256").update(message.toString()).digest("hex")
};
let authHash = digestMessage(Date.now());

class Trial {
    constructor(lecture, setting) {
        this.lecture = lecture;
        this.setting = setting === undefined ? {gazeinfo: true, coginfo: true} : setting;
    }

    updateInfo(info) {
        this.lecture = info.lecture;
        this.setting = info.setting;
    }
}

let registeredTrials = [];
registeredTrials.push(new Trial({
    title: 'Introduction in Linear Algebra',
    abstract: 'This lecture will briefly introduce some basic concepts in linear algebra, such as vector, matrix and rules of calculation.',
    instructor: 'David Liu',
    time: (new Date('Mon Apr 5 2021 13:00:00 GMT+0800')).getTime(),
    zoomid: '71123774899',
}, {
    gazeinfo: true,
    coginfo: true,
}));

let adminRouter = express.Router();
app.use('/admin', adminRouter);
app.get('/admin.html',
    cookieParser(),
    express.json({type: '*/*'}),
    verifyUser,
    (req, res) => {
        res.statusCode = 200;
        res.sendFile(path.join(__dirname, 'restricted', 'admin.html'));
    }
);

adminRouter.post('/', express.json({type: '*/*'}), generateAuthCookie);
adminRouter.get('/trial',
    (req, res) => {
        res.statusCode = 200;
        // req.body.number specifies how many lecture information is required.
        res.send(registeredTrials[0]);
    });
adminRouter.get('/trials',
    (req, res) => {
        res.statusCode = 200;
        // req.body.number specifies how many lecture information is required.
        res.send(registeredTrials);
    });
adminRouter.post('/trials',
    cookieParser(),
    express.json({type: '*/*'}),
    verifyUser,
    informationPost);

// Error handling
app.use(errorHandler);

function generateAuthCookie(req, res) {
    // Generate authorization cookie.
    if (req.body.passcode !== passcodeHash) {
        // Hash of passcode does not pass.
        res.statusCode = 401;
        res.send('Wrong message.')
    } else {
        // Passcode match. Generate authorization cookie.
        res.statusCode = 200;
        res.cookie('userInfo',
            JSON.stringify({
                'identity': 'admin',
                'authcode': authHash,
            }));
        res.send('Successfully logged in as admin.');
    }
}

function verifyUser(req, res, next) {
    try {
        // Hash of passcode does not pass.
        let parsedCookie = JSON.parse(req.cookies['userInfo']);

        if (!parsedCookie || parsedCookie.authcode !== authHash) {
            let err = new Error('Please login as admin first.');
            err.statusCode = 401;
            next(err);
        }
        // Authorization code match. Allow to proceed.
        next();
    } catch (err) {
        err.statusCode = 401;
        next(err);
    }
}

function informationPost(req, res) {
    // req.body
    // {verb: add, lecture: lecture-info, setting: setting-info}
    // {verb: delete, trialno: index}
    // {verb: update, trialno: index, info: info}
    console.log('===================================');
    console.log('Received ' + req.body.verb.toUpperCase() + ' request.')
    switch (req.body.verb) {
        case 'add':
            registeredTrials.push(new Trial(req.body.lecture, req.body.setting));
            registeredTrials.sort((a, b) => a.lecture.time - b.lecture.time);
            res.statusCode = 202;
            res.send('Add new trial successfully.');
            console.log('Add new trial successfully. There are ' + registeredTrials.length + ' registered trials.');
            console.log(req.body.lecture, req.body.setting);
            break
        case 'delete':
            registeredTrials.splice(req.body.trialno, 1); // from index req.body.trialno remove 1 element
            res.statusCode = 202;
            res.send('Delete specified trial successfully.');
            console.log('Delete specified trial successfully. There are ' + registeredTrials.length + ' registered trials.');
            break
        case 'update':
            registeredTrials[req.body.trialno].updateInfo(req.body.info);
            res.statusCode = 202;
            res.send('Update specified trial successfully.');
            console.log('Update specified trial successfully. There are ' + registeredTrials.length + ' registered trials.');
            console.log(req.body.info);
            break
        default:
            res.statusCode = 404;
            res.send('Invalid verb.')
    }
}

// ===================================
// Some code about administration control (Timing control)

const options = { /* ... */};
const io = require('socket.io')(server, options);

/* abstract */
class SessionStore {
    findSession(id) {
    }

    saveSession(id, session) {
    }

    findAllSessions() {
    }
}

class InMemorySessionStore extends SessionStore {
    constructor() {
        super();
        this.sessions = new Map();
    }

    findSession(id) {
        return this.sessions.get(id);
    }

    saveSession(id, session) {
        this.sessions.set(id, session);
    }

    findAllSessions() {
        return [...this.sessions.values()];
    }
}

let sessionStore = new InMemorySessionStore();
let unregisterEvent = undefined;

const randomId = () => crypto.randomBytes(8).toString("hex");

const adminNamespace = io.of("/admin");
adminNamespace.use((socket, next) => {
    const sessionID = socket.handshake.auth.sessionID;
    if (sessionID) {
        // find existing session
        const session = sessionStore.findSession(sessionID);
        if (session) {

            console.log('============================')
            console.log('Existing socket.')
            console.log(`session.name: ${session.name}`);
            console.log(`session.identity: ${session.identity}`);

            socket.sessionID = sessionID;
            socket.userID = session.userID;
            socket.name = session.name;
            socket.identity = session.identity;
            return next();
        }
    }
    // create new session
    socket.sessionID = randomId();
    socket.userID = randomId();
    socket.name = socket.handshake.auth.name;
    socket.identity = socket.handshake.auth.identity;

    console.log('============================')
    console.log('New socket.')
    console.log(`socket.handshake.auth.name: ${socket.handshake.auth.name}`);
    console.log(`socket.handshake.auth.identity: ${socket.handshake.auth.identity}`);
    console.log(`socket.name: ${socket.name}`);
    console.log(`socket.identity: ${socket.identity}`);

    next();
})

adminNamespace.on("connection", socket => {
    if (socket.identity === STUDENT) {
        socket.join("student");
    } else if (socket.identity === TEACHER) {
        socket.join("teacher");
    } else {
        socket.join("admin");
    }

    socket.emit("session", {
        sessionID: socket.sessionID,
        userID: socket.userID,
    });

    const users = [];
    for (let [id, socket] of adminNamespace.sockets) {
        users.push({
            userID: socket.userID,
            name: socket.name,
        });
    }

    adminNamespace.to("admin").emit("users", users); // When new users logged in, notify admin
    console.log(`Connected users:`);
    console.log(users);

    socket.on("ready", () => {
        // event ready comes from the teacherPage/studentPage.
        // "delay" event is used to block students/teacher from accessing the next procedure.

        // Some possible bugs:
        // 1. The instructor comes in early, the same lecture will be scheduled several times
        // 2. When to remove past course?

        let delay = registeredTrials[0].lecture.time - Date.now();
        if (delay !== undefined) {
            // Assert if delay exists. Emit "delay" event
            // This will allow late students to attend the lecture
            socket.emit("delay", delay);
        }
    });

    socket.on("schedule", () => {
        // This will be initiated from instructor (precisely client.js).
        // If the instructor receives "teacher start" event, it is similar to click on sync button;
        // If the student receives "student start" event, it will start to infer every inferInterval;

        let delay = registeredTrials[0].lecture.time - Date.now();

        if (delay > 0 && ( unregisterEvent === undefined || unregisterEvent._idleTimeout < 0 )) {
            // unregisterEvent === undefined : server just initialized
            // unregisterEvent._idleTimeout < 0 : last timed-out function is executed

            // Schedule "student start" event for students
            let startStudentEvent = setTimeout(() => {
                adminNamespace.to("student").emit("student start");
                console.log('============================');
                console.log('student start is sent to students');
            }, delay);

            // Schedule "teacher start" event for instructor
            let startInstructorEvent = setTimeout(() => {
                adminNamespace.to("teacher").to("admin").emit("teacher start");
                console.log('teacher start is sent to teacher and administrator');
            }, delay + 2 * 1000); // delay 2 seconds then students

            // Unregister trial
            unregisterEvent = setTimeout(() => {
                registeredTrials.shift();
                console.log('============================');
                console.log('Trial is removed.');
            }, delay + 30 * 60 * 1000);
        }
    });

    socket.on("disconnect", async () => {
        const matchingSockets = await adminNamespace.in(socket.userID).allSockets();
        const isDisconnected = matchingSockets.size === 0;
        if (isDisconnected) {
            // notify instructor and admin
            socket.to("teacher").to("admin").emit("user disconnected", socket.userID);
            // update the connection status of the session
            sessionStore.saveSession(socket.sessionID, {
                userID: socket.userID,
                name: socket.name,
                identity: socket.identity,
                connected: false,
            });
        }
    });
});

// ===================================
// Some code about spectral clustering
// Now moved to python dedicated server.
// ===================================

const kmeans = require('ml-kmeans');
const { Matrix, EigenvalueDecomposition } = require('ml-matrix');

function spectralCluster(X, Y, repeat) {
    console.log(`inside spectral cluster, X : ${X.length}, Y : ${Y.length}, repeat : ${repeat}`)

    let matX = X instanceof Matrix ? X : new Matrix(X);
    let matY = Y instanceof Matrix ? Y : new Matrix(Y);

    // Construct similarity matrix
    let sigma = 7.5;
    let distance = matX.repeat({columns:matX.rows})
        .subtract(matX.transpose().repeat({rows:matX.rows}))
        .pow(2)
        .add(
            matY.repeat({columns:matY.rows})
                .subtract(matY.transpose().repeat({rows:matY.rows}))
                .pow(2)
        ).sqrt().div(-2*sigma*sigma).exp();
    let D = Matrix.diag(
        distance.mmul(Matrix.ones(distance.rows, 1)).to1DArray().map(item => 1 / item)
    );

    // Eigenvalue decomposition
    let eig = new EigenvalueDecomposition(Matrix.eye(distance.rows).sub(D.mmul(distance)));
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

