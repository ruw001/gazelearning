var calibrated = false;
var wg_started = false;
var gc_started = false;
var heatmapInstance = null;
var hm_left = 0;
var hm_top = 0;

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

    // create heatmap with configuration
    // create configuration object
    var config = {
        container: document.getElementById('container'),
        radius: 50,
        maxOpacity: .5,
        minOpacity: 0,
        blur: .75
    };
    heatmapInstance = h337.create(config);

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

            try {
                heatmapInstance.addData(dataPoint);
            } catch (err) {
                console.log('Error caught!', err);
            }

            // console.log(xprediction, yprediction);
            // console.log(elapsedTime);
        });
    webgazer.showPredictionPoints(true); /* shows a square every 100 milliseconds where current prediction is */

    console.log('here!!!!!');
}

async function changeGC() {
    // change to enabled
    if (document.getElementById("et2").checked) {
        document.getElementById("et1").checked = false;
        document.getElementById("webgazeropts").style.display = 'none';
        if (wg_started) {
            await webgazer.end();
            closeWebGazer();
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
            closeWebGazer();
            wg_started = false;
        }
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
    }
}

async function endWG() {
    if (wg_started) {
        await webgazer.end();
        closeWebGazer();
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

function PlotGaze(GazeData) {
    /*
        GazeData.state // 0: valid gaze data; -1 : face tracking lost, 1 : gaze uncalibrated
        GazeData.docX // gaze x in document coordinates
        GazeData.docY // gaze y in document cordinates
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


    if (GazeData.state != 0) {
        if (gaze.style.display == 'block')
            gaze.style.display = 'none';
    }
    else {
        if (gaze.style.display == 'none')
            gaze.style.display = 'block';
    }
}
window.onbeforeunload = function () {
    webgazer.end();
    closeWebGazer();
}

// Kalman Filter defaults to on. Can be toggled by user.
window.applyKalmanFilter = true;

// Set to true if you want to save the data even if you reload the page.
window.saveDataAcrossSessions = true;
