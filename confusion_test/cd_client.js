// http://localhost:5000/confusion_test/example.html
var frameInterval,
    videoElement,
    canvasElement,
    canvasCtx,
    gazeX = 0,
    gazeY = 0;

var total = 1000
var totalNeutral = total;
var totalConfusion = total;
var collecting = 0;

var fastMode = false;

var grid_w = 6,
    grid_h = 4;
var patch_w = 0,
    patch_h = 0;
var gaze_win = [];
var confusion_win = []

window.onload = async function () {
    videoElement = document.getElementById('input_video');
    canvasElement = document.getElementById('output_canvas');
    canvasCtx = canvasElement.getContext('2d');

    // gaze_grid = new Array(grid_h * grid_w).fill(0);
    patch_h = document.getElementById('container').offsetHeight / grid_h;
    patch_w = document.getElementById('container').offsetWidth / grid_w;

    if (fastMode) {
        totalConfusion = 0;
        totalNeutral = 0;
    }

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            if (collecting !== 0) {
                await dataCollecting();
            } else if (totalConfusion === 0 && totalNeutral === 0) {

            }
        },
        width: 320,
        height: 180
    });
    camera.start();

    var inferInterval = setInterval(() => {
        stateInference().catch(err => {
            clearInterval(inferInterval);
            console.log(err)
        });
    }, 1000);

    var queryInterval = setInterval(() => {
        query().catch(err => {
            clearInterval(queryInterval);
            console.log(err)
        });
    }, 5000);
    

}

async function query() {
    var i;
    document.getElementById('plotting_svg').innerHTML = '';
    console.log(gaze_win);
    console.log(confusion_win);
    all_same = true;
    for (i=0; i<gaze_win.length-1; ++i) {
        if (gaze_win[i].x !== gaze_win[i + 1].x || gaze_win[i].y !== gaze_win[i + 1].y) {
            all_same = false;
            console.log('here!!!false');
            break;
        }
    }

    all_confuse = true;
    for (i = 0; i < confusion_win.length; ++i) {
        if (confusion_win[i] !== 'Confused') {
            all_confuse = false;
            break;
        }
    }
    console.log(all_same, all_confuse);
    if (all_same && all_confuse && gaze_win.length > 0) {
        let x = gaze_win[0].x;
        let y = gaze_win[0].y;
        showPromptBox(x, y);
        console.log('draw box!!!');
    }
    gaze_win = [];
    confusion_win = [];

}

async function report(event) {
    document.getElementById('plotting_svg').innerHTML = '';
    if (event.key === 'N') {
        // TODO: send data to server
    } else if (event.key === 'Y') {
        // TODO: send data to server
    }

}

async function showPromptBox(x, y) {
    // create svg element:
    var svg = d3.select("#plotting_svg")
                .attr("width", document.getElementById('container').offsetWidth)
                .attr("height", document.getElementById('container').offsetHeight)

    x = x * patch_w;
    y = y * patch_h;
    console.log(x, y)

    // x = 100;
    // y = 100;

    // Add the path using this helper function
    svg.append('rect')
        .attr('x', x)
        .attr('y', y)
        .attr('width', patch_w)
        .attr('height', patch_h)
        .attr('stroke', 'black')
        .attr('opacity', 0.5)
        .attr('fill', '#7584AD');
    svg.append('text')
        .attr('x', x+5)
        .attr('y', y+20)
        .attr('stroke', 'black')
        .style("font-size", 12)
        .text("Are you confused? (Y/N)")
}

async function showCoords(event) {
    var cX = event.clientX;
    var cY = event.clientY;
    gazeX = cX;//GazeData.GazeX;
    gazeY = cY;//GazeData.GazeY;
    var gaze = document.getElementById("gaze");
    gaze.style.display = 'block'
    cX -= gaze.clientWidth / 2;
    cY -= gaze.clientHeight / 2;
    gaze.style.left = cX + "px";
    gaze.style.top = cY + "px";
    console.log('clicked!!!');
}

async function stateInference() {
    if (collecting === 0 && totalConfusion === 0 && totalNeutral === 0) {
        let result = await reportState(1, 0);
        document.getElementById('status_bar').innerHTML = 'Prediction result: ' + result;

        let x_ = Math.floor((gazeX - document.getElementById('container').offsetLeft) / patch_w);
        let y_ = Math.floor((gazeY - document.getElementById('container').offsetTop) / patch_h);
        // console.log(x, y)
        gaze_win.push({ x: x_, y: y_ });
        confusion_win.push(result)
    }
    
}

async function dataCollecting() {
    let label = collecting === 1 ? 1 : 0;
    let result = await reportState(0, label)
    if (collecting === 1) { // collecting confusion
        totalConfusion -= 1;
        document.getElementById('status_bar').innerHTML = totalConfusion.toString() + ' confusion frames left...';
        if (totalConfusion === 0) {
            collecting = 0;
            document.getElementById('confused_btn').disabled = false;
            document.getElementById('neutral_btn').disabled = false;
        }
    } else { // collecting neutral
        totalNeutral -= 1;
        document.getElementById('status_bar').innerHTML = totalNeutral.toString() + ' neutral frames left...';
        if (totalNeutral === 0) {
            collecting = 0;
            document.getElementById('confused_btn').disabled = false;
            document.getElementById('neutral_btn').disabled = false;
        }
    } 
}


async function reportState(stage, label) {
    // after data collection stage
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    let base64ImageData = canvasElement.toDataURL();
    let data = { img: base64ImageData, stage: stage, label: label, username: 'ruru'};
    var result = null;
    try {
        await fetch('http://172.20.3.61:8000', { // 172.20.16.10
            method: 'POST',
            body: JSON.stringify(data),
        }).then(
            response => response.json()
        ).then(data => {
            console.log(data)
            result = data.body.result;
        })
    } catch (err) {
        console.log('ERROR:', err);
    }
    
    return result;
}

async function reportNeutral() {
    if (collecting !== 0) {
        console.log('collecting data, quit');
    } else {
        if (totalNeutral === total) {
            collecting = 2; // Neutral: 2
            document.getElementById('confused_btn').disabled = true;
            document.getElementById('neutral_btn').disabled = true;
            // console.log('already finished data collection, quit');
        } else if (totalNeutral === 0 && totalConfusion === 0) {
            let result = await reportState(2, 0); // stage: 2 (single report), neutral label: 0
            console.log(result)
            if (result === 'success') {
                console.log('data collected!');
            } else {
                console.log('data missed!', result);
            }
        } else {
            console.log('do nothing...');
        }
    }

}

async function reportConfusion() {
    if (collecting !== 0) {
        console.log('collecting data, quit');
    } else {
        if (totalConfusion === total) {
            collecting = 1; // Confusion: 1
            document.getElementById('confused_btn').disabled = true;
            document.getElementById('neutral_btn').disabled = true;
            // console.log('already finished data collection, quit');
        } else if (totalNeutral === 0 && totalConfusion === 0) {
            let result = await reportState(2, 1); // stage: 2 (single report), confusion label: 1
            if (result === 'success') {
                console.log('data collected!');
            } else {
                console.log('data missed!', result);
            }
        } else {
            console.log('do nothing...');
        }
    }
}