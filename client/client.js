var calibrated = false;
var wg_started = false;
var heatmapInstance = null;
var hm_left = 0;
var hm_top = 0;

window.onload = function() {
    // document.getElementById('et1').onchange = function() {changeGC()};
    //////set callbacks/////////
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

    // WebGazer
    webgazer.setGazeListener(function (data, elapsedTime) {
        if (data == null) {
            return;
        }
        var xprediction = data.x; //these x coordinates are relative to the viewport
        var yprediction = data.y; //these y coordinates are relative to the viewport
        var dataPoint = {
            x: xprediction, // x coordinate of the datapoint, a number
            y: yprediction, // y coordinate of the datapoint, a number
            value: 100 // the value at datapoint(x, y)
        };
        heatmapInstance.addData(dataPoint);
        console.log(xprediction, yprediction);
        console.log(elapsedTime); //elapsed time is based on time since begin was called
    });

    console.log('here!!!!!');

    // create configuration object
    var config = {
        container: document.getElementById('container'),
        radius: 50,
        maxOpacity: .5,
        minOpacity: 0,
        blur: .75
    };
    // create heatmap with configuration
    heatmapInstance = h337.create(config);
}

function changeGC() {
    // change to enabled
    if (document.getElementById("et2").checked) {
        document.getElementById("et1").checked = false;
        document.getElementById("webgazeropts").style.display = 'none';
        document.getElementById("gazecloudopts").style.display = 'initial';
        if (calibrated)
            document.getElementById("gaze").style.display = 'block';

    } else {
        document.getElementById("gazecloudopts").style.display = 'none';
        GazeCloudAPI.StopEyeTracking();
        document.getElementById("gaze").style.display = 'none';
    }
}
// document.getElementById('et2').onchange = function () { changeWG() };
function changeWG() {
    if (document.getElementById("et1").checked) {
        document.getElementById("et2").checked = false;
        document.getElementById("gazecloudopts").style.display = 'none';
        document.getElementById("webgazeropts").style.display = 'initial';
    } else {
        document.getElementById("webgazeropts").style.display = 'none';
        webgazer.end();
    }
}

function beginWG() {
    if (!wg_started) {
        webgazer.begin();
        console.log('began!!!!');
    } else {
        webgazer.resume();
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
            value: 100 // the value at datapoint(x, y)
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


