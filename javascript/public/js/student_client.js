// import { ZoomMtg } from '@zoomus/websdk';
// var ZoomMtg = require('@zoomus/websdk');
// ==============================================================
document.addEventListener("DOMContentLoaded", () => openModal("before-lecture-modal"));
document.addEventListener('visibilitychange', reportInattention)

window.onload = async function () {
    // Fetch experiment setting
    console.log('========== Preparing ==========');
    try {
        await fetchSetting();
    } catch (e) {
        console.error('Failed to fetch experiment setting.');
    }

    //////set callbacks for GazeCloudAPI/////////
    GazeCloudAPI.OnCalibrationComplete = function () {
        console.log('gaze Calibration Complete');
        calibrated = true;
        var pos = findAbsolutePosition(document.getElementById('container'));
        hm_left = pos.left;
        hm_top = pos.top;
        // [Adaptive] Follow openModal function to see how to adapt to different experiment settings
        if (cogInfo) openModal('initModal');
    }
    GazeCloudAPI.OnCamDenied = function () { console.log('camera access denied') }
    GazeCloudAPI.OnError = function (msg) { console.log('err: ' + msg) }
    GazeCloudAPI.UseClickRecalibration = true;
    GazeCloudAPI.OnResult = PlotGaze;

    // 2021.1.4 instead of canvas, the visualization is moved to SVG.
    // let svgNode = document.createElement("svg");
    // svgNode.id = 'plotting_svg';
    // document.getElementById('container').appendChild(svgNode);

    // let containerRect = document.getElementById("container").getBoundingClientRect();
    // maxH = containerRect.height;
    // maxW = containerRect.width;
    // let svg = d3.select("#plotting_svg")
    //     .attr("width", maxW)
    //     .attr("height", maxH);

    let svg = d3.select("#plotting_svg");
    svg.on('click', (e)=>report(e))
        .style("left", 0)
        .style("top", 0)
        .style("width", 0)
        .style("height", 0);

    // ZoomMtg.setZoomJSLib('node_modules/@zoomus/websdk/dist/lib', '/av');
    // ZoomMtg.preLoadWasm();
    // ZoomMtg.prepareJssdk();

    // const zoomMeeting = document.getElementById("zmmtg-root");

    // ==============================================================
    // confusion detection initializations
    videoElement = document.getElementById('input_video');
    canvasElement = document.getElementById('output_canvas');
    canvasCtx = canvasElement.getContext('2d');
    collectElement = document.getElementById('collect_canvas');
    collectCtx = collectElement.getContext('2d');
    // ==============================================================

    userInfo = getCookie('userInfo');
    if (!userInfo) throw Error('No user information. Please log in.');
    userInfo = JSON.parse(userInfo);

    selectCamera();

    socket.emit("ready");

    showPromptBox(null, 100, 100);
}

// @string.Format("https://zoom.us/wc/{0}/join?prefer=0&un={1}", ViewBag.Id, System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("Name Test")))

// Sync Gaze Information
function systemStart(fastMode) {
    if (fastMode) {
        console.log('Fast mode is on. No data collection process.')
        totalConfused = 0;
        totalNeutral = 0;
    } else {
        collecting = CONFUSED; // start with collecting confused expressions
    }
    // var last_infer_ts = Date.now();
    if (navigator.mediaDevices.enumerateDevices) {
        const camera = new Camera(videoElement, {
            onFrame: async () => {
                if (collecting !== NOTCOLLECTING) {
                    // make sure data collection starts first
                    await dataCollecting();
                } else if (totalConfused === 0 && totalNeutral === 0) {
                    // Collection is done. Do nothing.
                    // if (Date.now() - last_infer_ts >= 2500) {
                    //     stateInference();
                    //     last_infer_ts = Date.now()
                    // }

                }
            },
            width: 320,
            height: 180,
            deviceId: cameraId,
        });
        camera.start();
    }
}

// [Entry 2] Lecture
socket.on("student start", () => {
    if ( !(gazeInfo || cogInfo) ) return; // Nothing happens

    console.log('========== Synchronizing ==========');
    let infer = setInterval(() => {
        updateGazePoints()
            .catch(err => {
                clearInterval(infer);
                console.log(err)
            });
    }, inferInterval);
});

async function updateGazePoints() {
    // Facial expression collection is not finished yet
    if (totalConfused !== 0 || totalNeutral !== 0) return;

    stateInference().then(()=>{
        if (secondCounter % updateInterval === 0) {
            console.log(`[#${secondCounter/updateInterval+1} update - ${Math.floor(secondCounter/60)} min ${secondCounter%60} sec]`)
            update();
        }
    });
    // error will be handled by parent function, because its async, error are returned in Promise
}

async function update() {
    // decide what to post, then post using function signaling()
    let identity = userInfo['identity']; //teacher(2) or student(1)
    let studentNumber = userInfo['number'];

    let samples;
    if (RANDOM) {
        // ==============================================================
        // Random test part
        // Math.random() returns a random number inclusive of 0, but not 1
        // only choose last two built-in gaze traces since they have timestamp information
        // ==============================================================
        let randomGazeIndex = Math.floor(Math.random() * (GazeX.length - 2)) + 2;
        let beginTimestamp = Math.floor(Math.random() * timestamp[randomGazeIndex].length * 0.75);
        let endTimestamp = beginTimestamp;
        while (timestamp[randomGazeIndex][endTimestamp] - timestamp[randomGazeIndex][beginTimestamp] < updateInterval * 1000) {
            endTimestamp++;
        }
        timestamp_win = timestamp[randomGazeIndex].slice(beginTimestamp, endTimestamp);

        for (let i = 0; i < updateInterval; i++) {
            confusion_win[i] = 'N/A';
        }
        if (Math.random() > 0.3) {
            for (let i = 0; i < updateInterval; i++) {
                confusion_win[i] = Math.random() > 0.5 ? "Confused" : "Neutral";
            }
        }

        inattention_counter = Math.random() > 0.5 ? 1 : 0;

        samples = {
            x: GazeX[randomGazeIndex].slice(beginTimestamp, endTimestamp),
            y: GazeY[randomGazeIndex].slice(beginTimestamp, endTimestamp),
            t: timestamp[randomGazeIndex].slice(beginTimestamp, endTimestamp),
        };
    } else {
        samples = {
            x: gazeX_win,
            y: gazeY_win,
            t: timestamp_win,
        };
    }

    let fixations = [],
        saccades = [];
    // [Adaptive] Binding confusion with fixations
    if (gazeInfo) [fixations, saccades] = fixationConfusionBinding(samples);

    // Logging info to be posted
    console.log(`Length of gaze ${gazeX_win.length}`);
    console.log('Fixations');
    console.log(fixations);
    console.log('Cognitive information')
    console.log({
        confusion: confusion_win,
        inattention: inattention_counter,
    });

    signaling(
        RANDOM ? '/gazeData/teacher' : '/gazeData/sync',
        {
            stuNum: studentNumber,
            fixations: fixations.length === 0 ? fixations : fixations.map(fixation => fixation.data),
            saccades: saccades,
            cognitive: {
                confusion: confusion_win,
                inattention: inattention_counter,
            }
        },
        identity
    );

    gazeX_win = [];
    gazeY_win = [];
    timestamp_win = [];
    confusion_win = [];
    inattention_counter = 0;
}

function fixationConfusionBinding (samples) {
    if (samples.x.length === 0) return [[], []];

    let [fixations, saccades] = detector.detect(samples);

    let any_confused = confusion_win.some((state) => state === 'Confused');
    let all_noface = confusion_win.every((state) => state === 'N/A');

    if (all_noface) {
        if (!faceLostReported) {
            // Do not keep notifying the student, just once.
            faceLostReported = true;
            new Audio('/media/audio/facelost.mp3').play().catch(err => console.log(err));
        }
    } else if (faceLostReported) {
        // Face is back, reset flag.
        faceLostReported = false;
    }

    let lastConfusedFixation = 0;
    // Nested for loops for confusion/fixation binding
    if (any_confused && fixations.length !== 0) {
        for (const [i, state] of confusion_win.entries()) {
            if (state === 'Confused') {
                let tConfusion = (i + 1) * inferInterval + timestamp_win[0];
                for (let fixation of fixations) {
                    if (fixation.contain(tConfusion)) {
                        fixation.incConfusionCount()
                        lastConfusedFixation = fixations.indexOf(fixation);
                    } else if (fixation.start >= tConfusion) {
                        break;
                    }
                }
            }
        }
    }

    // fixations.forEach((fixation, i) => console.log(`#${i+1}:${fixation.data.start} - ${fixation.data.end}, contains ${fixation.data.confusionCount}`))

    if (fixations[lastConfusedFixation].confusionCount > 0) {
        console.log('Draw prompt box!')
        showPromptBox(fixations[lastConfusedFixation], patch_w, patch_h);
    } else {
        showPromptBox(fixations[lastConfusedFixation], -1, -1); // -1 means to delete
    }

    return [fixations, saccades];
}

async function signaling(endpoint, data, role) {
    // post
    let headers = { 'Content-Type': 'application/json' },
        body = JSON.stringify({ ...data, role: role });

    let res = await fetch(endpoint,
        { method: 'POST', body, headers }
    );

    return res.json();
    // error will be handled by parent function, because its async, error are returned in Promise
}

// ==============================================================
// confusion detection functions
async function query() {
    // this function is not used
    let i;
    document.getElementById('plotting_svg').innerHTML = '';
    console.log(gaze_win);
    console.log(confusion_win);

    let all_same = true;
    for (i = 0; i < gaze_win.length - 1; ++i) {
        if (gaze_win[i].x !== gaze_win[i + 1].x || gaze_win[i].y !== gaze_win[i + 1].y) {
            all_same = false;
            console.log('here!!!false');
            break;
        }
    }

    // let all_confuse = confusion_win.every((state) => state === 'Confused');
    let any_confuse = confusion_win.some((state) => state === 'Confused');

    console.log(`all_same : ${all_same}, any_confuse : ${any_confuse}`);
    if (all_same && all_confuse && gaze_win.length > 0) {
        let x = gaze_win[0].x;
        let y = gaze_win[0].y;
        showPromptBox(x, y);
        console.log('draw box!!!');
    }
    gaze_win = [];
    confusion_win = [];

}

async function report(fix, correct=true) {
    // document.getElementById('plotting_svg').innerHTML = '';

    console.log('You\'ve clicked on SVG to report confusion! @'+new Date().getTime());

    signaling(
        '/gazeData/selfreport',
        {
            correct: correct,
            fixation: fix,
        },
        userInfo['identity']
    );
}

function showPromptBox(fixation, minWidth, minHeight) {
    console.log(minWidth < 0 ? 'REMOVE prompt box' : 'SHOW prompt box');

    fakeGazeX = [412, 383.2, 445, 202, 196, 191, 153, 128.8, 141.2, 136.2, 105.19999999999999, 31.599999999999994, 112, 111.6, 148, 149.60000000000002,
        109.80000000000001, 88.6, 42.19999999999999, 44.400000000000006, 50.19999999999999, 45.599999999999994, 65.6, 75.4, 96.80000000000001, 116.4, 112,
        51.80000000000001, 42.400000000000006, 12.199999999999989, -15.599999999999994, -22.599999999999994, 5, 38.599999999999994, 45.599999999999994, 36.400000000000006,
        152, 71, -16.400000000000006, -3.5999999999999943, 2.4000000000000057, 90, 96.4, 98.80000000000001, 53, 26.80000000000001, 54.19999999999999, 21, 21, 33, 39, 64.4,
        169.8, 253.2, 393, 510.6, 524.4, 506.20000000000005, 463.79999999999995, 475.20000000000005, 577.2, 589.8, 559.6, 502, 481.6, 476.20000000000005, 502.20000000000005,
        503.79999999999995, 492.79999999999995, 482.6, 478.6, 487, 506, 525.4, 568.4, 554.8, 525.8, 547, 561.4, 562.2, 538.4, 544.8, 542.2, 544.2, 556.4, 542.6, 544.4, 548.8,
        512.4, 516.6, 513.6, 515.8, 520.4, 531, 541.4, 543.2, 524.8, 529, 534.8, 528.6, 539, 519.4, 512.8, 583.4, 712.6, 767.2, 747.4, 681.4, 630.4, 957.5999999999999, 1002,
        1027.4, 1048, 957.5999999999999, 903, 891.8, 876.2, 872, 884.2, 927.8, 928.2, 936.4000000000001, 949.8, 955.5999999999999, 949, 942, 952, 967.8, 935.4000000000001,
        972.4000000000001, 1062.8, 1054, 1096.2, 1082, 996.4000000000001, 1116.8, 1152.4, 1133.8, 1105.6, 1073.8, 1010.5999999999999, 985, 1011, 994, 1009.4000000000001,
        1005.2, 1012.2, 964.8, 992, 1011.8, 981.4000000000001, 932.4000000000001, 982.2, 1040, 1002, 943.2, 924, 864, 867.4, 1085, 1022, 930.2, 968.8, 1008.8, 1019,
        947.4000000000001, 574, 518, 502.79999999999995, 485, 493.20000000000005, 490, 502.79999999999995, 520.4, 512, 487.4, 485.6, 472.20000000000005, 452, 468.4, 480,
        473.79999999999995, 467.79999999999995, 482.4, 483.20000000000005, 464.79999999999995, 473, 343.8, 286.8];

    fakeGazeY = [152, 149.8, 79.80000000000001, 103, 136.39999999999998, 110.80000000000001, 106.39999999999998, 103.39999999999998, 116, 130.8, 131, 21,
        75.60000000000002, 78, 109.80000000000001, 109.80000000000001, 118.60000000000002, 137.8, 85.39999999999998, 126.19999999999999, 99.80000000000001, 137,
        103.60000000000002, 49, 33.80000000000001, 153.60000000000002, 255.60000000000002, 302.6, 428.79999999999995, 443.20000000000005, 424.4, 444.4, 480, 506,
        502.6, 478.4, 452, 440, 451, 448.79999999999995, 479.20000000000005, 428.6, 452.20000000000005, 478.6, 528, 535, 503.6, 497, 491.79999999999995, 505.6,
        437.20000000000005, 387, 357.20000000000005, 164.8, 257, 171, 119.60000000000002, 147.39999999999998, 265.8, 278, 157.2, 190.60000000000002, 224.8, 306, 311.4,
        326.79999999999995, 326.6, 305.2, 308.4, 316.4, 353.20000000000005, 348.4, 353.20000000000005, 308.4, 285.8, 348.4, 317.4, 296.6, 241.2, 207.60000000000002,
        212.2, 254.8, 316.6, 335.79999999999995, 342.4, 324.79999999999995, 301.4, 369.6, 487.4, 491, 429.4, 425, 458.20000000000005, 449.79999999999995,
        416.79999999999995, 336.4, 459.79999999999995, 422.6, 347.20000000000005, 313, 430.4, 466.4, 460.79999999999995, 439.20000000000005, 400.4, 387.20000000000005,
        389.20000000000005, 412, 416.4, 476, 446.20000000000005, 392.79999999999995, 380.6, 464.79999999999995, 519.2, 534.8, 520.6, 528.8, 522.8, 536.2, 526.8, 534.6,
        549.8, 512.8, 489.79999999999995, 516, 527.2, 519.6, 502.79999999999995, 514.4, 299.4, 223.8, 232.8, 170.60000000000002, 134.8, 21, -22.19999999999999,
        -14.400000000000006, 25.400000000000006, 106.39999999999998, 196, 252.8, 185.60000000000002, 166.8, 143, 123.19999999999999, 135, 102.39999999999998, 27,
        8.800000000000011, 12.199999999999989, 140.8, 173.2, 84.39999999999998, -47.80000000000001, -41, -47.80000000000001, 8.400000000000006, 60.19999999999999,
        94.60000000000002, 86.39999999999998, 62, 54.400000000000006, 39, 11.400000000000006, 56, 162.2, 155.8, 153, 161.39999999999998, 192.60000000000002,
        191.39999999999998, 200, 215, 161.39999999999998, 101.39999999999998, 95.19999999999999, 119.60000000000002, 136.8, 116.80000000000001, 115.19999999999999,
        118.60000000000002, 117.80000000000001, 118.60000000000002, 123.60000000000002, 113, 164.8, 17.19999999999999, -53.80000000000001];

    timestamp = [0, 3985, 515, 567, 534, 533, 502, 500, 532, 503, 527, 504, 568, 521, 597, 516, 535, 500, 621, 510, 538, 514,
        524, 525, 502, 502, 531, 504, 532, 531, 501, 535, 598, 535, 516, 551, 517, 515, 501, 517, 567, 517, 500, 551, 501, 501, 582, 516,
        502, 566, 551, 532, 521, 551, 513, 500, 501, 534, 532, 535, 533, 502, 533, 524, 511, 565, 500, 501, 500, 500, 519, 514, 619, 516, 551, 501, 514,
        502, 517, 501, 515, 500, 529, 506, 532, 502, 533, 501, 651, 534, 1165, 517, 534, 515, 801, 518, 501, 617, 933, 634, 501, 500, 516, 518, 501, 620, 529,
        551, 532, 501, 500, 533, 518, 517, 501, 500, 537, 583, 547, 500, 534, 533, 533, 502, 500, 533, 501, 534, 533, 522, 512, 567, 500, 501, 533, 561, 506, 500,
        541, 501, 561, 520, 511, 500, 518, 583, 523, 533, 544, 501, 533, 568, 517, 533, 551, 501, 517, 500, 532, 500, 535, 518, 549, 500, 516, 502, 533, 516, 501, 567,
        501, 500, 500, 500, 501, 634, 533, 500, 500, 501, 500, 500, 534, 501, 501, 697, 502, 557, 510];
    
    let samples = {
        x: fakeGazeX,
        y: fakeGazeY,
        t: timestamp, // not used right now
    };
    
    let [fixations, saccades] = detector.detect(samples);

    fixation = fixations[0];
    
    let tFast = d3.transition()
        .duration(500);
    let tSlow = d3.transition()
        .duration(1000);

    let data = minWidth < 0 ? [] : [1]; // whatever the datum is, it is not important.
    let svg = d3.selectAll("#plotting_svg");

    svg.transition(tSlow)
        .style("left", fixation.xmin+'px')
        .style("top", fixation.ymin+'px')
        .style("width", minWidth < 0 ? 0+'px' : Math.max(minWidth, fixation.xmax - fixation.xmin)+'px')
        .style("height", minWidth < 0 ? 0+'px' : Math.max(minHeight, fixation.ymax - fixation.ymin)+'px');

    svg.selectAll('rect')
        .data(data)
        .join(
            enter => enter.append('rect')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 0)
                .attr('height', 0)
                .attr('opacity', 0.7)
                .attr('fill', '#7584AD'),
            update => update,
            exit => exit.call(rect => rect.transition(tFast).attr("width", 0).attr("height", 0).remove())
        ).transition(tFast)
        .attr('width', Math.max(minWidth, fixation.xmax - fixation.xmin))
        .attr('height', Math.max(minHeight, fixation.ymax - fixation.ymin));

    svg.selectAll('text')
        .data(data)
        .join(
            enter => enter.append('text')
                .attr('x', 0)
                .attr('y', 0)
                .attr('stroke', 'black')
                .style("font-size", 14)
                .html("<tspan dx='5' dy='20'>Confused AROUND?</tspan><tspan x='5' dy='20'>Click to report.</tspan>"),
            update => update,
            exit => exit.remove()
        );
    
    svg.on("click", function () {
        report(fixation);
        box_click = true;
        console.log('click! -> report');
        svg.selectAll("rect").remove();
        svg.selectAll("text").remove();
    });

    setTimeout(() => {
        if (!box_click) {
            report(fixation, correct=false);
            console.log('no click -> report');
        }
        box_click = false;
        console.log('disappear');
        svg.selectAll("rect").remove();
        svg.selectAll("text").remove();
    }, 2500);

}

async function showCoords(event) {
    let cX = event.clientX;
    let cY = event.clientY;
    gazeX = cX;//GazeData.GazeX;
    gazeY = cY;//GazeData.GazeY;
    let gaze = document.getElementById("gaze");
    gaze.style.display = 'block'
    cX -= gaze.clientWidth / 2;
    cY -= gaze.clientHeight / 2;
    gaze.style.left = cX + "px";
    gaze.style.top = cY + "px";
    console.log('clicked!!!');
}

async function stateInference() {
    if (collecting === 0 && totalConfused === 0 && totalNeutral === 0) {
        let result = await reportState(INFERENCE, 0);
        document.getElementById('status_bar').innerHTML = 'Prediction result: ' + result;

        let containerHeight = document.getElementById('container').offsetHeight;
        let containerWidth = document.getElementById('container').offsetWidth;
        patch_h = containerHeight / grid_h;
        patch_w = containerWidth / grid_w;

        let x_ = Math.floor((gazeX - document.getElementById('container').offsetLeft) / patch_w);
        let y_ = Math.floor((gazeY - document.getElementById('container').offsetTop) / patch_h);
        // console.log(gazeX, gazeY, x_, y_);
        // gaze_win.push({ x: x_, y: y_ });
        confusion_win.push(result);

        secondCounter++;
    }

}

async function dataCollecting() {
    // on server side, label CONFUSED(1) is confused expressions, label NOTCOLLECTING(0) is neutral
    let label = collecting === CONFUSED ? CONFUSED : NOTCOLLECTING;
    let result = await reportState(COLLECTION, label)
    if (collecting === CONFUSED) { // collecting confusion
        totalConfused -= 1;
        document.getElementById('collectDescription').innerHTML = totalConfused.toString() + ' confusion frames left...';
        if (totalConfused === 0) {
            collecting = NOTCOLLECTING;

            document.getElementById("collectTitle").innerText = "Please make no expression.";
            document.getElementById("collectDescription").innerText = "Press \"Collect\" if you are ready.";
            document.getElementById("collectBtn").setAttribute("onclick", "collecting = NEUTRAL;");

            document.getElementById('confused_btn').disabled = false;
            document.getElementById('neutral_btn').disabled = false;
        }
    } else { // collecting neutral
        totalNeutral -= 1;
        document.getElementById('collectDescription').innerHTML = totalNeutral.toString() + ' neutral frames left...';
        if (totalNeutral === 0) {
            collecting = NOTCOLLECTING;

            closeModal("dataCollectModal");

            document.getElementById('confused_btn').disabled = false;
            document.getElementById('neutral_btn').disabled = false;
        }
    }
}

async function reportState(stage, label) {
    // after data collection stage
    if (stage === COLLECTION) {
        // During collection stage, collected data will be shown in modal dialogue.
        collectCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    } else if (reporting) {
        return null
    }
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    let base64ImageData = canvasElement.toDataURL();
    let ver = 0;
    if (stage === INFERENCE) {
        ver = model_ver;
    } else if (stage === INCREMENT) {
        ver = ++model_ver;
    }
    let data = {
        img: base64ImageData, 
        stage: stage, 
        label: label, 
        // username: 1,
        ver: ver,
        username: userInfo['number'],
        frameId: label ? totalConfused : totalNeutral,
    };
    let result = null;
    try {
        if (stage === COLLECTION) {
            // fetch('http://127.0.0.1:8000/detection', { // 172.20.16.10
            fetch('/detection', {
                method: 'POST',
                body: JSON.stringify(data),
                referrerPolicy: "origin",
            })
        } else {
            reporting = true;
            // await fetch('http://127.0.0.1:8000/detection', { // 172.20.16.10
            await fetch('/detection', {
                method: 'POST',
                body: JSON.stringify(data),
                referrerPolicy: "origin",
            }).then(
                response => response.json()
            ).then(data => {
                console.log(data)
                result = data.body.result;
            })
            reporting = false;
        }
    } catch (err) {
        console.error('ERROR:', err);
    }

    return result;
}

async function reportNeutral() {
    if (collecting !== NOTCOLLECTING) {
        console.log('collecting data, quit');
    } else {
        if (totalNeutral === total) {
            collecting = NEUTRAL; // Neutral: 2
            document.getElementById('confused_btn').disabled = true;
            document.getElementById('neutral_btn').disabled = true;
            // console.log('already finished data collection, quit');
        } else if (totalNeutral === 0 && totalConfused === 0) {
            let result = await reportState(INCREMENT, 0); // stage: 2 (single report), neutral label: 0
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
    if (collecting !== NOTCOLLECTING) {
        console.log('collecting data, quit');
    } else {
        if (totalConfused === total) {
            collecting = CONFUSED; // Confusion: 1
            document.getElementById('confused_btn').disabled = true;
            document.getElementById('neutral_btn').disabled = true;
            // console.log('already finished data collection, quit');
        } else if (totalNeutral === 0 && totalConfused === 0) {
            let result = await reportState(INCREMENT, 1); // stage: 2 (single report), confusion label: 1
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
// ==============================================================
// confusion detection functions

function reportInattention() {
    if (document.visibilityState === 'hidden') {
        lastHiddenTimestamp = new Date().getTime();
        setTimeout(()=>{
            if (lastHiddenTimestamp && !hiddenReported) {
                hiddenReported = true;
                inattention_counter++;
                new Audio('/media/audio/alert.mp3').play().catch(err => console.log(err));
            }
        }, updateInterval*inferInterval)
    } else if (document.visibilityState === 'visible') {
        lastHiddenTimestamp = 0;
        hiddenReported = false;
    }
}
