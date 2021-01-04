// import { ZoomMtg } from '@zoomus/websdk';

// var ZoomMtg = require('@zoomus/websdk');
var calibrated = false;
var wg_started = false;
var gc_started = false;
// var heatmapInstance = null;
var hm_left = 0;
var hm_top = 0;
let maxH = 0;
let maxW = 0;

window.onload = async function () {

    //////set callbacks for GazeCloudAPI/////////
    GazeCloudAPI.OnCalibrationComplete = function () {
        console.log('gaze Calibration Complete');
        calibrated = true;
        var pos = findAbsolutePosition(document.getElementById('container'));
        hm_left = pos.left;
        hm_top = pos.top;
    }
    GazeCloudAPI.OnCamDenied = function () { console.log('camera  access denied') }
    GazeCloudAPI.OnError = function (msg) { console.log('err: ' + msg) }
    GazeCloudAPI.UseClickRecalibration = true;
    GazeCloudAPI.OnResult = PlotGaze;

    // // create heatmap with configuration
    // // create configuration object
    // var config = {
    //     container: document.getElementById('container'),
    //     radius: 50,
    //     maxOpacity: .5,
    //     minOpacity: 0,
    //     blur: .75
    // };
    // heatmapInstance = h337.create(config);
    // heatmapInstance.setData({ max: 1, min: 0, data: [] }); // For proper display
    // console.log('Heatmap initialized and update MIN finished');
    
    // 2021.1.4 instead of canvas, the visualization is moved to SVG.
    let svgNode = document.createElement("svg");
    svgNode.id = 'plotting_svg';
    document.getElementById('container').appendChild(svgNode);

    let containerRect = document.getElementById("container").getBoundingClientRect();
    maxH = containerRect.height;
    maxW = containerRect.width;

    // WebGazer
    webgazer.params.showVideoPreview = true;
    //start the webgazer tracker
    await webgazer.setRegression('ridge') /* currently must set regression and tracker */
        //.setTracker('clmtrackr')
        .setGazeListener(function (data, clock) {
            //   console.log(data); /* data is an object containing an x and y key which are the x and y prediction coordinates (no bounds limiting) */
            //   console.log(clock); /* elapsed time in milliseconds since webgazer.begin() was called */
            if (data == null) {
                return;
            }
            var xprediction = data.x; //these x coordinates are relative to the viewport
            var yprediction = data.y; //these y coordinates are relative to the viewport
            var dataPoint = {
                x: xprediction - hm_left, // x coordinate of the datapoint, a number
                y: yprediction - hm_top, // y coordinate of the datapoint, a number
                value: 10 // the value at datapoint(x, y)
            };

            var gaze = document.getElementById("gaze");
            xprediction -= gaze.clientWidth / 2;
            yprediction -= gaze.clientHeight / 2;

            gaze.style.left = xprediction + "px";
            gaze.style.top = yprediction + "px";

            try {
                heatmapInstance.addData(dataPoint);
            } catch (err) {
                console.log('Error caught!', err);
            }

            // console.log(xprediction, yprediction);
            // console.log(elapsedTime);
        });
    // webgazer.showPredictionPoints(true); /* shows a square every 100 milliseconds where current prediction is */
    function hideVideoElements() {
        webgazer.showPredictionPoints(false);
        webgazer.showVideo(false);
        webgazer.showFaceOverlay(false);
        webgazer.showFaceFeedbackBox(false);
        //webgazer.showGazeDot(false);
    };
    hideVideoElements();

    // ZoomMtg.setZoomJSLib('node_modules/@zoomus/websdk/dist/lib', '/av');
    // ZoomMtg.preLoadWasm();
    // ZoomMtg.prepareJssdk();

    // const zoomMeeting = document.getElementById("zmmtg-root");

}

// async function heatmapDisplay(event) {
//     let heatmapCanvas = document.querySelector(".heatmap-canvas");
//     event.target.value = heatmapCanvas.hidden ? "Hide Heatmap" : "Show Heatmap";
//     heatmapCanvas.hidden = !heatmapCanvas.hidden;
// }

async function changeGC() {
    // change to enabled
    if (document.getElementById("et2").checked) {
        document.getElementById("et1").checked = false;
        document.getElementById("webgazeropts").style.display = 'none';
        if (wg_started) {
            await webgazer.end();
            // closeWebGazer();
            wg_started = false;
        }
        document.getElementById("gazecloudopts").style.display = 'initial';
        gc_started = true;
        if (calibrated)
            document.getElementById("gaze").style.display = 'block';

    } else {
        document.getElementById("gazecloudopts").style.display = 'none';
        GazeCloudAPI.StopEyeTracking();
        gc_started = false;
        document.getElementById("gaze").style.display = 'none';
    }
}
// document.getElementById('et2').onchange = function () { changeWG() };
async function changeWG() {
    if (document.getElementById("et1").checked) {
        document.getElementById("et2").checked = false;
        document.getElementById("gazecloudopts").style.display = 'none';
        document.getElementById("gaze").style.display = 'none';
        GazeCloudAPI.StopEyeTracking();
        gc_started = false;
        document.getElementById("webgazeropts").style.display = 'initial';
    } else {
        document.getElementById("webgazeropts").style.display = 'none';
        if (wg_started) {
            await webgazer.end();
            // closeWebGazer();
            wg_started = false;
        }
        document.getElementById("gaze").style.display = 'none';
    }
}

function closeWebGazer() {
    var webgazer_elems = ['webgazerFaceOverlay',
        'webgazerFaceFeedbackBox',
        'webgazerGazeDot',
        'webgazerFaceOverlay',
        'webgazerVideoCanvas'];
    for (var i = 0; i < 5; ++i) {
        try {
            document.getElementById(webgazer_elems[i]).remove();
        } catch (err) {
            console.log('Error caught!', err);
        }
    }
    // webgazer_elems.forEach(elem => document.getElementById(elem).remove());
}


async function beginWG() {
    if (!wg_started) {
        await webgazer.begin();
        wg_started = true;
        document.getElementById("gaze").style.display = 'block';
    }
}

async function endWG() {
    if (wg_started) {
        await webgazer.end();
        // closeWebGazer();
        wg_started = false;
    }
}

function findAbsolutePosition(htmlElement) {
    var x = htmlElement.offsetLeft;
    var y = htmlElement.offsetTop;
    for (var x = 0, y = 0, el = htmlElement;
        el != null;
        el = el.offsetParent) {
        x += el.offsetLeft;
        y += el.offsetTop;
    }
    return {
        "left": x,
        "top": y
    };
}

window.onbeforeunload = function () {
    webgazer.end();
    // closeWebGazer();
}

// Kalman Filter defaults to on. Can be toggled by user.
window.applyKalmanFilter = true;

// Set to true if you want to save the data even if you reload the page.
window.saveDataAcrossSessions = true;

// @string.Format("https://zoom.us/wc/{0}/join?prefer=0&un={1}", ViewBag.Id, System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("Name Test")))

// Sync heatmap
function getCookie(name) {
    let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
    ));
    return matches ? decodeURIComponent(matches[1]) : undefined;
}

document.getElementById("sync").addEventListener(
    'click',
    async () => {
        console.log('Syncing...');
        let userInfo = getCookie('userInfo');

        if (!userInfo) throw Error('No user information. Please log in.');

        userInfo = JSON.parse(userInfo);

        setInterval(async () => {
            // error in updateGazePoints() is handled here
            updateGazePoints(userInfo).catch(err => {
                clearInterval(updateInterval);
                console.log(err);
            });
        }, 1000);
    }
);

async function signaling(endpoint, data, role) {
// post...
        let headers = { 'Content-Type': 'application/json' },
            body = JSON.stringify({ ...data, role: role });

        let res = await fetch('/gazeData/' + endpoint,
            { method: 'POST', body, headers }
        );

        return res.json();
// error will be handled by parent function, because its async, error are returned in Promise
}

async function updateGazePoints(userInfo) {
// decide what to post, then post using function signaling()
    let identity =  userInfo['identity']; //teacher(2) or student(1)
    let studentNumber = userInfo['number'];
    // console.log(`identity ${identity}, studentNumber ${studentNumber}`) // debug line

    // This script could only be accessed by teacher, so no more identity check
    console.log('Updating teacher...')

    signaling(
        'sync',
        {
            stuNum: studentNumber,
            pts: []
        },
        identity
    ).then(res => res.json())
    .then(result => JSON.parse(result.result))
    .then(result => {
        // let all_points = res.all_points;
        // let points_arr = [];
        // for (var k in all_points) {
        //     points_arr = points_arr.concat(all_points[k]);
        // }
        // console.log(points_arr);

        console.log(result.classes);
        let [AoIs, TMatrix] = AoIBuilder(result.fixations, result.saccades, result.classes);

        console.log(AoIs);
        console.log(TMatrix);

        let animationTime = 1000; //ms
        showAoI(AoIs, animationTime);
        showTransition(AoIs, TMatrix, animationTime);
    });
    // error will be handled by parent function, because its async, error are returned in Promise
}

// LEGACY CODES

function PlotGaze(GazeData) {
    /*
        GazeData.state // 0: valid gaze data; -1 : face tracking lost, 1 : gaze uncalibrated
        GazeData.docX // gaze x in document coordinates
        GazeData.docY // gaze y in document coordinates
        GazeData.time // timestamp
    */

    var docx = GazeData.docX;
    var docy = GazeData.docY;

    if (calibrated) {
        var dataPoint = {
            x: docx - hm_left, // x coordinate of the datapoint, a number
            y: docy - hm_top, // y coordinate of the datapoint, a number
            value: 10 // the value at datapoint(x, y)
        };
        heatmapInstance.addData(dataPoint);
    }

    var gaze = document.getElementById("gaze");
    docx -= gaze.clientWidth / 2;
    docy -= gaze.clientHeight / 2;

    gaze.style.left = docx + "px";
    gaze.style.top = docy + "px";


    if (GazeData.state !== 0) {
        if (gaze.style.display === 'block')
            gaze.style.display = 'none';
    }
    else {
        if (gaze.style.display === 'none')
            gaze.style.display = 'block';
    }
}

// From heatmapTest

// function getRandomIntInclusive(min, max) {
//     min = Math.ceil(min);
//     max = Math.floor(max);
//     return Math.floor(Math.random() * (max - min + 1)) + min; //含最大值，含最小值 
// }

// function startRandom(num, w, h, heatmap) {
//     console.log(`RANDON ${num} points`);

//     let dataSet = [];

//     for (let i = 0; i < num; i++) {
//         let posX = getRandomIntInclusive(0, w);
//         let posY = getRandomIntInclusive(0, h);
//         dataSet.push({
//             x: posX, // x coordinate of the datapoint, a number
//             y: posY, // y coordinate of the datapoint, a number
//             value: 1 // the value at datapoint(x, y)
//         });
//     }

//     heatmap.addData(dataSet);
// }

// function startFix(num, w, h, heatmap) {
//     console.log(`Fix ${num} points`)

//     let dataSet = [];

//     for (let i = 0; i < num; i++) {
//         let posX = Math.floor(w / 2);
//         let posY = Math.floor(h / 2);
//         dataSet.push({
//             x: posX, // x coordinate of the datapoint, a number
//             y: posY, // y coordinate of the datapoint, a number
//             value: 1 // the value at datapoint(x, y)
//         });
//     }

//     heatmap.addData(dataSet);
// }

// document.getElementById("random").addEventListener(
//     "click",
//     (event) => {
//         let points = event.target.nextElementSibling.value;
//         startRandom(points, maxW, maxH, heatmapInstance)
//     }
// );

// document.getElementById("fix").addEventListener(
//     "click",
//     (event) => {
//         let points = event.target.nextElementSibling.value;
//         startFix(points, maxW, maxH, heatmapInstance)
//     }
// );

// document.getElementById("clean").addEventListener(
//     "click",
//     () => {
//         console.log("Cleaning...");
//         console.log(`We have ${heatmapInstance.getData().data.length} points now. MAX: ${heatmapInstance.getData().max} MIN: ${heatmapInstance.getData().min}`);
//         let myCan = document.querySelector(".heatmap-canvas");
//         myCan.getContext('2d').clearRect(0, 0, myCan.width, myCan.height);
//         new Promise((resolve, reject) => {
//             let flag = heatmapInstance.setData({ max: 1, min: 0, data: [] });
//             if (flag) resolve(true)
//         }).then(() => { console.log('Heatmap update finished') })
//     }
// );

// document.getElementById("scale").addEventListener(
//     'click',
//     () => {
//         console.log("Rescaling...");
//         heatmapInstance.setDataMin(0);
//     }
// );

// document.getElementById("display").addEventListener(
//     'click',
//     () => {
//         let dataset = heatmapInstance.getData().data;
//         dataset.forEach((dataPoint, index) => {
//             console.log(`#${index} : ${dataPoint.value} @ (${dataPoint.x},${dataPoint.y}) `);
//         })
//     }
// );