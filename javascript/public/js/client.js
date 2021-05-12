// import { ZoomMtg } from '@zoomus/websdk';

// var ZoomMtg = require('@zoomus/websdk');
document.addEventListener("DOMContentLoaded", () => openModal("before-lecture-modal"));

window.onload = async function () {
    // Fetch experiment setting
    console.log('========== Preparing ==========');
    try {
        await fetchSetting();
    } catch (e) {
        console.error('Failed to fetch experiment setting: %s', e);
    }

    //////set callbacks for GazeCloudAPI/////////
    GazeCloudAPI.OnCalibrationComplete = function () {
        console.log('gaze Calibration Complete');
        calibrated = true;
        var pos = findAbsolutePosition(document.getElementById('container'));
        hm_left = pos.left;
        hm_top = pos.top;
    }
    GazeCloudAPI.OnCamDenied = function () { console.error('camera access denied') }
    GazeCloudAPI.OnError = function (msg) { console.error('err: %s', msg) }
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
                console.error('Error caught! %s', err);
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
    }
    hideVideoElements();

    // ZoomMtg.setZoomJSLib('node_modules/@zoomus/websdk/dist/lib', '/av');
    // ZoomMtg.preLoadWasm();
    // ZoomMtg.prepareJssdk();

    // const zoomMeeting = document.getElementById("zmmtg-root");

    socket.emit("ready");
    socket.emit("schedule"); // Schedule start events and when to unregister lecture.

}

window.onbeforeunload = function () {
    webgazer.end();
    // closeWebGazer();
}

// @string.Format("https://zoom.us/wc/{0}/join?prefer=0&un={1}", ViewBag.Id, System.Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("Name Test")))

// [Entry 2] Lecture
socket.on("teacher start", ()=>{
    if ( !(gazeInfo || cogInfo) ) return; // Nothing happens
    sync();
});

document.getElementById("sync").addEventListener(
    'click',
    sync
);

async function sync() {
    // 2021.1.4 instead of canvas, the visualization is moved to SVG.
    let containerRect = document.getElementById("container").getBoundingClientRect();
    maxH = containerRect.height;
    maxW = containerRect.width;

    d3.select("#container").insert("svg", "iframe").attr("id", "plotting_svg");
    d3.select("#container").insert("svg", "iframe").attr("id", "cognitive_svg");

    let svg = d3.select("#plotting_svg")
        // .style('left', xOffset)
        // .style('top', yOffset)
        .attr("width", maxW)
        .attr("height", maxH)
        .attr("font-family", "sans-serif");
    console.log('SVG set.');

    cog_width = 0.5*maxW;
    cog_height = 0.1*maxH;
    // Map percentage to coordinate
    x = d3.scaleLinear()
        .domain([0, 1])
        .range([margin.left, cog_width - margin.right]);
    y = d3.scaleBand()
        .domain(["Knowledge", "Attention"])
        .range([margin.top, cog_height - margin.bottom])
        .padding(0.1);

    let cog_svg = d3.select("#cognitive_svg")
        // .style('left', xOffset)
        // .style('top', yOffset)
        .attr("width", cog_width)
        .attr("height", cog_height);
    cog_svg.append("g").call(xAxis);
    cog_svg.append("g").call(yAxis);
    console.log('Cognitive SVG set.');

    console.log('========== Synchronizing ==========');
    let userInfo = getCookie('userInfo');
    if (!userInfo) throw Error('No user information. Please log in.');
    userInfo = JSON.parse(userInfo);

    let update = setInterval(async () => {
        // error in updateGazePoints() is handled here
        updateGazePoints(userInfo).catch(err => {
            clearInterval(update);
            console.error(err);
        });
    }, updateInterval*inferInterval);
}

async function signaling(endpoint, data, role) {
// post...
        let headers = { 'Content-Type': 'application/json' },
            body = JSON.stringify({ ...data, role: role });

        let res = await fetch(endpoint,
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
        'gazeData/teacher',
        {
            stuNum: studentNumber,
            pts: []
        },
        identity
    ).then(res => {console.log(res); return res;})
    .then(result => {
        let animationTime = 1000; //ms
        let confusionRate = 0, inattentionRate = 0, total = result.cognitives.length;

        // [Adaptive] Follow openModal function to see how to adapt to different experiment settings
        // AoI visualization
        if(gazeInfo) {

            if (result.fixations.length === 0) {
                console.warn('No fixation is received from server.');
            } else {
                console.debug(result.result);
                result.fixations = result.fixations.map(fixation => Fixation.fromFixationData(fixation));
                let [AoIs, TMatrix] = AoIBuilder(result.fixations, result.saccades, result.result);

                let confusedStudents = new Set();
                AoIs.forEach((AoI) => {
                    for (let stuNum of AoI.confusedStudents) {
                        if (confusedStudents.has(stuNum)) continue;
                        confusedStudents.add(stuNum);
                    }
                });
                confusionRate = confusedStudents.size;

                console.debug(AoIs);
                console.debug(TMatrix);

                showAoI(AoIs, animationTime);
                showTransition(AoIs, TMatrix, animationTime);
            }
        }

        // Cognitive bar chart
        if (cogInfo) { // gazeInfo off/on, cogInfo on
            // Show global cognitive information.
            result.cognitives.forEach((cogInfo) => {
                // cogInfo {stuNum: number, confusion: string[], inattention: number}
                if (cogInfo.inattention > 0) ++inattentionRate;
                if (!gazeInfo) {
                    if (cogInfo.confusion.some((state) => state === 'Confused')) ++confusionRate;
                }
            })

            confusionRate = confusionRate/total;
            inattentionRate = inattentionRate/total;

            showCognitive([confusionRate, inattentionRate], animationTime);
        } else { // no info post
            // do nothing
        }

    });
    // error will be handled by parent function, because its async, error are returned in Promise
}

// ==============================================================
// Visualization helper functions

// Plot axis of the figure
function xAxis (g) {
    return g.attr("transform", `translate(0,${margin.top})`)
        .call(d3.axisTop(x).ticks(4, "%").tickSizeOuter(0))
        .call(g => g.select(".domain").remove()) // Remove horizontal line
        .call(g => g.append("text")
            .attr("x", cog_width - margin.right - 40)
            .attr("fill", "currentColor")
            .text('Rate (%)'))
}
function yAxis (g){
    return g.attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(2))
        .call(g => g.select(".domain").remove()) // Remove horizontal line
        .call(g => g.selectAll(".tick line")
            .call(line => line.remove())
        ); // remove tick line
}

function showCognitive(cogInfo, animationTime) {
    let t = d3.transition()
        .duration(animationTime);
    const textWidth = 45, textHeight = 14, opacity = 0.7;
    const colorDict = {
        'safe': "#06d6a0",
        'warning':"#ffd166",
        'danger':"#ef476f",
    };

    let gSelection = d3.select("#cognitive_svg")
        .selectAll("g.bar")
        .data(cogInfo.map((val, ord) => {
            return {val, ord}
        }))
        .join("g")
        .classed("bar", true);

    gSelection.selectAll("rect")
        .data(d => [d])
        .join(
            enter => enter.append("rect")
                .attr("x", d => x(0))
                .attr("y", d => d.ord === 0 ? y("Knowledge") : y("Attention"))
                .attr("height", d => y.bandwidth())
                .attr("fill", d => {
                    if (d.val < 1/3) return colorDict["safe"];
                    else if (d.val < 2/3) return colorDict["warning"];
                    else return colorDict["danger"];
                })
                .attr("opacity", opacity),
            update => update,
            exit => exit.call(g => g.remove())
        )
        .call(rect => rect.transition(t)
            .attr("width", d => x(1-d.val) - x(0))
            .attr("fill", d => {
                if (d.val < 1/3) return colorDict["safe"];
                else if (d.val < 2/3) return colorDict["warning"];
                else return colorDict["danger"];
            })
        );

    gSelection.selectAll("text")
        .data(d => [d])
        .join(
            enter => enter.append("text")
                .attr("x", d => x(1-d.val) + ( x(1-d.val) > x(0) + textWidth ?  -textWidth : textWidth ))
                .attr("y", d => (d.ord === 0 ? y("Knowledge") : y("Attention")) + textHeight)
                .attr("stroke", "black")
                .attr("fill", "none"),
            update => update,
            exit => exit.call(g => g.remove())
        )
        .call(rect => rect.transition(t)
            .attr("x", d => x(1-d.val) + (x(1-d.val) > x(0) + textWidth ?  -textWidth : 1))
            .text(d => d3.format('.1%')(1-d.val))
        );
}

// ==============================================================
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

function defineGradient () {
    svg.append("defs");
    let gradient = d3.select("#plotting_svg")
        .select("defs")
        .append("linearGradient")
        .attr("id", "arrowGradient");
    gradient.append("stop")
        .attr("offset", "5%")
        .attr("stop-color", "white");
    gradient.append("stop")
        .attr("offset", "95%")
        .attr("stop-color", "blue");
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