var PointCalibrate = 0;
var CalibrationPoints={};
const clickTimes = 2;

/**
 * Clear the canvas and the calibration button.
 */
function ClearCanvas(){
  $(".Calibration").hide();
  $(".Test").hide();
  var canvas = document.getElementById("plotting_canvas");
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * Show the instruction of using calibration at the start up screen.
 */
function PopUpInstruction(){
  ClearCanvas();
  swal({
    title:"Calibration",
    text: `Please click on each of the 9 points on the screen. You must click on each point ${clickTimes} times till it goes yellow. This will calibrate your eye movements.`,
    buttons:{
      cancel: false,
      confirm: true
    }
  }).then(isConfirm => {
    ShowCalibrationPoint();
  });

}
/**
  * Show the help instructions right at the start.
  */
function helpModalShow() {
    $('#helpModal').modal('show');
}

/**
 * Load this function when the index page starts.
* This function listens for button clicks on the html page
* checks that all buttons have been clicked 5 times each, and then goes on to measuring the precision
*/
$(document).ready(function(){
  ClearCanvas();
  helpModalShow();
  $(".Calibration").click(function(){ // click event on the calibration buttons

      var id = $(this).attr('id');

      if (!CalibrationPoints[id]){ // initialises if not done
        CalibrationPoints[id]=0;
      }
      CalibrationPoints[id]++; // increments values

      if (CalibrationPoints[id]==clickTimes){ //only turn to yellow after 5 clicks
        $(this).css('background-color','yellow');
        $(this).prop('disabled', true); //disables the button
        PointCalibrate++;
      }else if (CalibrationPoints[id]<clickTimes){
        //Gradually increase the opacity of calibration points when click to give some indication to user.
        var opacity = (1/clickTimes)*CalibrationPoints[id]+(1/clickTimes);
        $(this).css('opacity',opacity);
      }

      //Show the middle calibration point after all other points have been clicked.
      if (PointCalibrate == 8){
        $("#Pt5").show();
      }

      if (PointCalibrate >= 9){   // last point is calibrated
        fourPointCalibrationTest();
      }
    });
});

/**
 * Show the Calibration Points
 */
function ShowCalibrationPoint() {
  $(".Calibration").show();
  $("#Pt5").hide(); // initially hides the middle button
}

/**
* This function clears the calibration buttons memory
*/
function ClearCalibration(){
  // Clear data from WebGazer

  $(".Calibration").css('background-color','red');
  $(".Calibration").css('opacity',1/clickTimes);
  $(".Calibration").prop('disabled',false);

  CalibrationPoints = {};
  PointCalibrate = 0;
}

// sleep function because java doesn't have one, sourced from http://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function middlePointCalibrationTest (){
  //using jquery to grab every element in Calibration class and hide them except the middle point.
  $(".Calibration").hide();
  $("#Pt5").show();

  // clears the canvas
  var canvas = document.getElementById("plotting_canvas");
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

  // notification for the measurement process
  swal({
    title: "Calculating measurement",
    text: "Please don't move your mouse & stare at the middle dot for the next 5 seconds. This will allow us to calculate the accuracy of our predictions.",
    closeOnEsc: false,
    allowOutsideClick: false,
    closeModal: true
  }).then( isConfirm => {
      // makes the variables true for 5 seconds & plots the points
      $(document).ready(function(){

        store_points_variable(); // start storing the prediction points

        sleep(5000).then(() => {
            stop_storing_points_variable(); // stop storing the prediction points
            var past50 = webgazer.getStoredPoints(); // retrieve the stored points
            var precision_measurement = calculatePrecision(past50, 'middle');
            var accuracyLabel = "<a>Accuracy | "+precision_measurement+"%</a>";
            document.getElementById("Accuracy").innerHTML = accuracyLabel; // Show the accuracy in the nav bar.
            swal({
              title: "Your accuracy measure is " + precision_measurement + "%",
              allowOutsideClick: false,
              buttons: {
                cancel: "Recalibrate",
                confirm: true,
              }
            }).then(isConfirm => {
                if (isConfirm){
                  //clear the calibration & hide the last middle button
                  // ClearCanvas();
                } else {
                  //use restart function to restart the calibration
                  document.getElementById("Accuracy").innerHTML = "<a>Not yet Calibrated</a>";
                  webgazer.clearData();
                  ClearCalibration();
                  ClearCanvas();
                  ShowCalibrationPoint();
                }
            });
        });
      });
  });
}

async function fourPointCalibrationTest (){
  let testIds = ['upperleft', 'upperright', 'lowerleft', 'lowerright'];
  let colors = ['#DAF7A6', '#FFC300', '#FF5733', '#C70039'];
  let pastGazesX = [];
  let pastGazesY = [];

  ClearCanvas();

  swal({
    title: "Precision test (4 points)",
    text: "Stare at the upcomming 4 dots, each for 5 seconds.",
    closeOnEsc: false,
    allowOutsideClick: false,
    closeModal: true
  }).then( async (isConfirm) => {  
    for (let testId of testIds) {
      let past50 = await singlePoint(testId);
      pastGazesX.push(past50[0].slice());
      pastGazesY.push(past50[1].slice());
    }
    return Promise.resolve(true);
  }).then( ()=>{
    // Visualize all calibration result
    testIds.forEach((element, index) =>{
      $('#'+element).show();
      draw50(colors[index], [pastGazesX[index], pastGazesY[index]]);
    });  
  });
}

async function singlePoint(testId) {
  console.log(testId);
  $('#'+testId).show();
  let past50 = null;
  // $(document).ready(async function(){
  store_points_variable(); // start storing the prediction points

  await sleep(5000).then(() => {
    // console.log('After sleep'); // debug line
    stop_storing_points_variable(); // stop storing the prediction points
    past50 = webgazer.getStoredPoints(); // retrieve the stored points
    draw50('green', past50);
    sleep(1000);
    var precision_measurement = calculatePrecision(past50, testId);
    var accuracyLabel = "<a>Accuracy | "+precision_measurement+"%</a>";
    document.getElementById("Accuracy").innerHTML = accuracyLabel; // Show the accuracy in the nav bar.
    return swal({
      title: "Your accuracy measure is " + precision_measurement + "%",
      allowOutsideClick: false,
      buttons: {
        cancel: "Recalibrate",
        confirm: true,
      }
    })
  }).then(isConfirm => {
      // console.log('After confirm'); // debug line
      if (isConfirm){
        //clear the calibration & hide the last middle button
        ClearCanvas();
      } else {
        //use restart function to restart the calibration
        document.getElementById("Accuracy").innerHTML = "<a>Not yet Calibrated</a>";
        webgazer.clearData();
        ClearCalibration();
        ClearCanvas();
        ShowCalibrationPoint();
      }
  });    
  return past50;
}

function draw50(color,gaze){
  let x = gaze[0];
  let y = gaze[1];  

  var ctx = document.getElementById("plotting_canvas").getContext('2d');
  ctx.fillStyle = color; // Red color

  x.forEach((element, index) => {
    ctx.beginPath();
    ctx.arc(element, y[index], 5, 0, Math.PI * 2, true);
    ctx.fill();
  });
}