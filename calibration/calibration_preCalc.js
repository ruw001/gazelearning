/*========================
========================
    PUBLIC VARIABLES
========================
========================*/

// Kalman Filter defaults to on. Can be toggled by user.
window.applyKalmanFilter = true;

// Set to true if you want to save the data even if you reload the page.
window.saveDataAcrossSessions = true;
// 2020.10.30 How do I know if the data is saved?
// check L88119 @ webgazer.js, the definition of clickListener()
// check L88172 @ webgazer.js, for loadGlobalData()/setGlobalData()/clearData()

var PointCalibrate = 0;
var CalibrationPoints=[];
const clickTimes = 10;
const points = 9;
let randomClickCounter = points*clickTimes;
let caliMode = null;

/*========================
========================
SOME FUNCTION BEFORE CALI STARTS
========================
========================*/

window.onload = async function() {

  webgazer.params.showVideoPreview = true;
  //start the webgazer tracker
  await webgazer.setRegression('ridge') /* currently must set regression and tracker */
      //.setTracker('clmtrackr')
      .setGazeListener(function(data, clock) {
        //   console.log(data); /* data is an object containing an x and y key which are the x and y prediction coordinates (no bounds limiting) */
        //   console.log(clock); /* elapsed time in milliseconds since webgazer.begin() was called */
      }).begin();
      webgazer.showPredictionPoints(true); /* shows a square every 100 milliseconds where current prediction is */


  //Set up the webgazer video feedback.
  var setup = function() {
      //Set up the main canvas. The main canvas is used to calibrate the webgazer.
      var canvas = document.getElementById("plotting_canvas");
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.position = 'fixed';
  };
  setup();
};

window.onbeforeunload = function() {
  webgazer.end();
}

// Runs when document is ready. HelpModal is showed immediately when document is ready.
$(function(){
  ClearCanvas();
  helpModalShow();
});

// Clear the canvas and the calibration button.
function ClearCanvas(){
  $(".Calibration").hide();
  $(".Test").hide();
  var canvas = document.getElementById("plotting_canvas");
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// Show the help instructions right at the start.
function helpModalShow() {
  $('#helpModal').modal('show');
}

/*========================
========================
MAIN FUNCTIONS IN CALIBRATION
========================
========================*/

// Restart the calibration process by clearing the local storage and reseting the calibration point
// Also serves as the entry point when calibration mode is selected.
function Restart(mode){
  document.getElementById("Accuracy").innerHTML = "<a>Not yet Calibrated</a>";
  webgazer.clearData();
  ClearCalibration();
  PopUpInstruction(mode);
}

// This function clears the calibration buttons memory
function ClearCalibration(){
  // Clear data from WebGazer
  // webgazer.clearData();

  // Initialize all calibration points
  $(".Calibration").css('background-color','red');
  $(".Calibration").css('opacity',1/clickTimes);
  $(".Calibration").prop('disabled',false);

  // Initialize some counters
  CalibrationPoints = {};
  PointCalibrate = 0;
  randomClickCounter = points*clickTimes;
}

// Show the instruction of using calibration at the start up screen.
function PopUpInstruction(mode){
  caliMode = mode;

  ClearCanvas();
  swal({
    title:"Calibration",
    text: `Please click on each of the 9 points on the screen. You must click on each point ${clickTimes} times till it goes yellow. This will calibrate your eye movements.`,
    buttons:{
      cancel: false,
      confirm: {className:'btn btn-primary'}
    }
  }).then(isConfirm => {
    ShowCalibrationPoint();
  });
}

// Show the Calibration Points
function ShowCalibrationPoint() {
  // $(".Calibration").show();
  // $("#Pt5").hide(); // initially hides the middle button

  switch (caliMode) {
    case 0:
      console.log('Calibration mode: traditional');
      $('#Pt0').show();
      traditional(false);
      break;
    case 1:
      console.log('Calibration mode: traditional, in sequence');
      $('#Pt0').show();
      traditional(true);
      break;
    case 2:
      console.log('Calibration mode: random calibration points');
      $('#PtRandom').css({
        'background-color':'red',
        'opacity':0.5,
        'top':getRandomIntInclusive(2,98)+'vh',
        'left':getRandomIntInclusive(2,98)+'vw',
        'z-index': 99,
      });
      $('#PtRandom').show();
      randomCali();
      break;
  }
}

// Traditional 9 points calibration.
// If sequence is true, each calibration point will be hidden after each single click, and next calibration point is shown until a round is done
function traditional(sequence = false){

  function clickHandler(e) {
    var id = +$(this).attr('id').slice(2);

    if (!CalibrationPoints[id]){ // initialises if not done
      CalibrationPoints[id]=0;
    }
    CalibrationPoints[id]++; // increments values

    if (CalibrationPoints[id]<clickTimes){ 
      //Gradually increase the opacity of calibration points when click to give some indication to user.
      var opacity = (1/clickTimes)*CalibrationPoints[id]+(1/clickTimes);
      $(this).css('opacity',opacity);

      if (sequence) {
        $(this).hide();
        $('#Pt'+(id+1)%points).show();
      }
      
    } else if (CalibrationPoints[id]==clickTimes){
      //turn to yellow after clicks done

      $(this).css('background-color','yellow');
      $(this).prop('disabled', true); //disables the button
      PointCalibrate++;

      if (PointCalibrate == points){
        fourPointCalibrationTest(); // calibration is done
      } else {
        if (!sequence) {
          $('#Pt'+(id+1)).show();
        } else {
          $('#Pt'+(id+1)%points).show();
        }
        
        // not done yet, add new point to the 
        // let newPoint = document.createElement('input');
        // newPoint.setAttribute('type', 'button');
        // newPoint.setAttribute('class', 'Clibration');
        // newPoint.setAttribute('id', 'Pt'+PointCalibrate);
        // newPoint.addEventListener('click', clickHandler);

        // document.querySelector('.calibrationDiv').insertAdjacentElement('afterbegin', newPoint);
      }
    }
  }

  $(".Calibration").on('click', clickHandler);
}

// random calibration
function randomCali(){
  $(".Calibration").on('click',()=>{
    $('#PtRandom').css({'background-color':'yellow','disabled':''});
    randomClickCounter-=1;

    //Calibration is done
    if (!randomClickCounter) fourPointCalibrationTest();

    //Calibration is not finished
    sleep(100).then(()=>{
      let newTop = getRandomIntInclusive(2,98);
      let newLeft = getRandomIntInclusive(2,98);
      $('#PtRandom').css({
        'background-color':'red',
        'opacity':0.5,
        'top':newTop+'vh',
        'left':newLeft+'vw',
        'z-index': 99,
        'disabled':'false',
      });

      var canvas = document.getElementById("plotting_canvas");
      let ctx = canvas.getContext('2d');
      var canvas = document.getElementById("plotting_canvas");
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

      ctx.font = 16+'px serif';
      ctx.fillStyle = 'red'; 
      ctx.fillText(randomClickCounter, newLeft/100*window.innerWidth+20, newTop/100*window.innerHeight+20);
    });

  });
}

/*========================
========================
    TEST FUNCTIONS
========================
========================*/

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
    console.log(testId+':'+precision_measurement+'%');
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

/*========================
========================
      UTILITIES
========================
========================*/

// sleep function because java doesn't have one, sourced from http://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
function sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// Draw 50 gaze points which are used for precision calculation
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

// Random interger grnerator
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min; // Including both min and max
}