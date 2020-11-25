var mouseX = 0;
var mouseY = 0;
var gazeList = [];
var clearCmd = false;
var wg_started = false;
var gaze_grid = []
var grid_w = 13,
    grid_h = 8;
var patch_w = 0,
    patch_h = 0;

window.onload = async function () {
    // document.getElementById('container').onmousemove = function (event) {
    //     mouseX = event.clientX;
    //     mouseY = event.clientY;
    //     console.log(mouseX, mouseY);
    //     let gaze = document.getElementById('gaze');
    //     let docx = mouseX - gaze.clientWidth / 2;
    //     let docy = mouseY ;//- gaze.clientHeight / 2;

    //     gaze.style.left = docx + "px";
    //     gaze.style.top = docy + "px";
    // }
    // setInterval(async () => {
    //     addGaze().catch(err => {
    //         clearInterval(addGaze);
    //         console.log(err)
    //     });
    // }, 250);

    gaze_grid = new Array(grid_h * grid_w).fill(0);

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

            var gaze = document.getElementById("gaze");
            xprediction -= gaze.clientWidth / 2;
            yprediction -= gaze.clientHeight / 2;

            gaze.style.left = xprediction + "px";
            gaze.style.top = yprediction + "px";

            if (clearCmd) gazeList = [];
            else gazeList.push({xprediction, yprediction});

            // console.log(xprediction, yprediction);
            // console.log(elapsedTime);
        });
    // webgazer.showPredictionPoints(true); /* shows a square every 100 milliseconds where current prediction is */
    hideVideoElements();
    setInterval(async () => {
        analyzeGaze().catch(err => {
            clearInterval(analyzeGaze);
            console.log(err)
        });
    }, 10000);
}

function hideVideoElements() {
    webgazer.showPredictionPoints(false);
    webgazer.showVideo(false);
    webgazer.showFaceOverlay(false);
    webgazer.showFaceFeedbackBox(false);
    //webgazer.showGazeDot(false);
};

async function addGaze() {
    gazeList.push({mouseX, mouseY});
}

async function analyzeGaze() {
    console.log(gazeList);
    clearCmd = true;
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