// http://localhost:5000/confusion_test/example.html

var frameInterval,
    videoElement,
    canvasElement,
    canvasCtx;

window.onload = async function () {
    videoElement = document.getElementById('input_video');
    canvasElement = document.getElementById('output_canvas');
    canvasCtx = canvasElement.getContext('2d');

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            let { result, error } = await processFrame();
        },
        width: 320,
        height: 180
    });
    camera.start();

}



function error_stream(error) {
    console.log("error has occured" + error);
}

async function processFrame() {
    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    // var image = canvasCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    let base64ImageData = canvasElement.toDataURL();
    fetch('http://172.20.3.61:8000', {
        method: 'POST',
        body: {data: base64ImageData},
        mode: 'no-cors'
    }).then(function (response) {
        // extract token from JSON response
        // let {res} = response.json();
        // console.log(res);
    })
    // console.log('image,', base64ImageData);
    return {result: 1}
}