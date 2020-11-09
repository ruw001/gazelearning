// This is a lagacy version
// It has implemented syncing, but not written in a Promise fashion
// And it is not integrated with Login Form and Cookie
// It is kept for possible usage

const crypto = require('crypto');
var PORT = process.env.PORT || 5000;
var express = require('express');
var app = express();

var http = require('http');
var server = http.Server(app);

app.use(express.static('./'));
app.use(express.json({ type: '*/*' }));

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

var all_points = {};
var last_seen = {}

// signaling stuff
app.post('/signaling/sync', async (req, res) => {
    let { name, role, pts } = req.body;
    try {
        if (role === 'teacher') {
            res.send({
                all_points
            });
        } else {
            all_points[name] = pts;
            res.send({
                result: 'OK'
            });
            last_seen[name] = Date.now();
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