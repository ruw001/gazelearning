let heatmapInstance = null;
let maxH = 0;
let maxW = 0;
var role = 'student';
let username = "";
let updateInterval;
let loggedin = false;

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; //含最大值，含最小值 
}

function startRandom(num, w, h, heatmap) {
    console.log(`RANDON ${num} points`);

    let dataSet = [];

    for (let i = 0; i < num; i++) {
        let posX = getRandomIntInclusive(0, w);
        let posY = getRandomIntInclusive(0, h);
        dataSet.push({
            x: posX, // x coordinate of the datapoint, a number
            y: posY, // y coordinate of the datapoint, a number
            value: 1 // the value at datapoint(x, y)
        });
    }

    heatmap.addData(dataSet);
}

function startFix(num, w, h, heatmap) {
    console.log(`Fix ${num} points`)

    let dataSet = [];

    for (let i = 0; i < num; i++) {
        let posX = Math.floor(w / 2);
        let posY = Math.floor(h / 2);
        dataSet.push({
            x: posX, // x coordinate of the datapoint, a number
            y: posY, // y coordinate of the datapoint, a number
            value: 1 // the value at datapoint(x, y)
        });
    }

    heatmap.addData(dataSet);
}

window.onload = async function () {

    var config = {
        container: document.getElementById('container'),
        radius: 50,
        maxOpacity: .8,
        minOpacity: 0,
        blur: 0.75,
        // gradient: {
        //     // enter n keys between 0 and 1 here
        //     // for gradient color customization
        //     '.01': '#1d976c',
        //     '.98': '#93F9B9'
        // }
    };

    new Promise((resolve, reject) => {
        heatmapInstance = h337.create(config);
        if (heatmapInstance) resolve(true);
    }).then(() => {
        // MUST REMEMBER SET TO 0! Otherwise will not show small values
        // CHECK https://developer.mozilla.org/zh-CN/docs/Web/API/CanvasRenderingContext2D/createRadialGradient
        //   and https://github.com/pa7/heatmap.js/blob/4e64f5ae5754c84fea363f0fcf24bea4795405ff/src/renderer/canvas2d.js#L196
        //   for how interpolation is done
        let flag = heatmapInstance.setData({ max: 1, min: 0, data: [] });
        if (flag) Promise.resolve(true);
    }).then(() => {
        console.log('Heatmap initialized and update MIN finished');
    })

    
    // heatmapInstance = h337.create(config);
    // heatmapInstance.setData({ max: 1, min: 0, data: [] });

    let containerRect = document.getElementById("container").getBoundingClientRect();
    maxH = containerRect.height;
    maxW = containerRect.width;

    document.getElementById("random").addEventListener(
        "click",
        (event) => {
            let points = event.target.nextElementSibling.value;
            startRandom(document.getElementById("random-num").value, maxW, maxH, heatmapInstance)
        }
    );

    document.getElementById("fix").addEventListener(
        "click",
        (event) => {
            let points = event.target.nextElementSibling.value;
            startFix(points, maxW, maxH, heatmapInstance)
        }
    );

    document.getElementById("clean").addEventListener(
        "click",
        () => {
            console.log("Cleaning...");
            console.log(`We have ${heatmapInstance.getData().data.length} points now. MAX: ${heatmapInstance.getData().max} MIN: ${heatmapInstance.getData().min}`);
            let myCan = document.querySelector(".heatmap-canvas");
            myCan.getContext('2d').clearRect(0, 0, myCan.width, myCan.height);
            new Promise((resolve, reject) => {
                let flag = heatmapInstance.setData({ max: 1, min: 0, data: [] });
                if (flag) resolve(true)
            }).then(() => { console.log('Heatmap update finished') })
        }
    );

    document.getElementById("scale").addEventListener(
        'click',
        () => {
            console.log("Rescaling...");
            heatmapInstance.setDataMin(0);
        }
    );

    document.getElementById("display").addEventListener(
        'click',
        () => {
            let dataset = heatmapInstance.getData().data;
            dataset.forEach((dataPoint, index) => {
                console.log(`#${index} : ${dataPoint.value} @ (${dataPoint.x},${dataPoint.y}) `);
            })
        }
    );
    document.getElementById("username_submit").addEventListener(
        'click',
        () => {
            // TODO: add a login step
            username = document.getElementById('username').value;
            document.getElementById('username').disabled = true;
            document.getElementById('role_opt').disabled = true;
            loggedin = true;
        }
    );

    updateInterval = setInterval(async () => {
        let { error } = await updateGazePoints();
        if (error) {
            clearInterval(updateInterval);
            console.log(error);
        }
    }, 1000);
}

async function changeRole() {
    if (document.getElementById("role_opt").checked) {
        role = 'teacher';
    } else {
        role = 'student';
    }
    
}

async function signaling(endpoint, data) {
    try {
        let headers = { 'Content-Type': 'application/json' },
            body = JSON.stringify({ ...data, role: role });

        let response = await fetch(
            '/signaling/' + endpoint, { method: 'POST', body, headers }
        );
        return await response.json();
    } catch (e) {
        console.error(e);
        return { error: e };
    }
}

async function updateGazePoints() {
    if (!loggedin)
        return ({});
    if (role == 'teacher') {
        let { all_points, error } = await signaling('sync', { name: username, pts: [] });
        console.log(all_points);
        let points_arr = []
        for (var k in all_points) {
            points_arr = points_arr.concat(all_points[k]);
        }
        heatmapInstance.setData({ max: 1, min: 0, data: points_arr });
        if (error) {
            return ({ error});
        }
    } else {
        let { result, error } = await signaling('sync', { name: username, pts: heatmapInstance.getData().data });
        if (error) {
            return ({ error });
        }
    }
    return ({});
}

        // 2020.10.31
        // @TODO:
        // 0. fix error in safari/MacOS/iOS platforms
        // 1. code organize
        // 2. heatmap discretify
        // 3. POST/GET method for passing heatmap