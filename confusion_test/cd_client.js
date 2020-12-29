// http://localhost:5000/confusion_test/example.html

var frameInterval,
    videoElement,
    canvasElement,
    canvasCtx;

var total = 1000
var totalNeutral = total;
var totalConfusion = total;
var collecting = 0;

var fastMode =false;


window.onload = async function () {
    videoElement = document.getElementById('input_video');
    canvasElement = document.getElementById('output_canvas');
    canvasCtx = canvasElement.getContext('2d');

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
    

}

async function stateInference() {
    if (collecting === 0 && totalConfusion === 0 && totalNeutral === 0) {
        let result = await reportState(1, 0);
        document.getElementById('status_bar').innerHTML = 'Prediction result: ' + result;
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
    await fetch('http://172.20.3.61:8000', { // 172.20.16.10
        method: 'POST',
        body: JSON.stringify(data),
    }).then( 
        response => response.json()
    ).then( data => {
        console.log(data)
        result = data.body.result;
    })
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