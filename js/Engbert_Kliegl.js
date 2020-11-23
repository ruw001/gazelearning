// Ralf Engbert, Reinhold Kliegl: Microsaccades uncover the
// orientation of covert attention, Vision Research, 2003.

// Functions for the detection of fixations in raw eye-tracking data.
//
// Offers a function for detecting fixations in a stream of eye
// positions recorded by an eye-tracker.  The detection is done using
// an algorithm for saccade detection proposed by Ralf Engbert and
// Reinhold Kliegl (see reference below).  Anything that happens
// between two saccades is considered to be a fixation.  This software
// is therefore not suited for data sets with smooth-pursuit eye
// movements.

// @param samples a data frame containing the raw samples as recorded
// by the eye-tracker.  This data frame has four columns:
// \describe{
//  \item{time:}{the time at which the sample was recorded}
//  \item{trial:}{the trial to which the sample belongs}
//  \item{x:}{the x-coordinate of the sample}
//  \item{y:}{the y-coordinate of the sample}
// }
// Samples have to be listed in chronological order.  The velocity
// calculations assume that the sampling frequency is constant.
// @param lambda a parameter for tuning the saccade
// detection.  It specifies which multiple of the standard deviation
// of the velocity distribution should be used as the detection
// threshold.
// @param smooth.coordinates logical. If true the x- and y-coordinates will be
// smoothed using a moving average with window size 3 prior to saccade
// detection.
// @param smooth.saccades logical.  If true, consecutive saccades that
// are separated only by a few samples will be joined.  This avoids
// the situation where swing-backs at the end of longer saccades are
// recognized as separate saccades.  Whether this works well, depends
// to some degree on the sampling rate of the eye-tracker.  If the
// sampling rate is very high, the gaps between the main saccade and
// the swing-back might become too large and look like genuine
// fixations.  Likewise, if the sampling frequency is very low,
// genuine fixations may be regarded as spurious.  Both cases are
// unlikely to occur with current eye-trackers.

import { create, all } from 'mathjs'

const config = { }
const math = create(all, config)

function detectFixations(samples, lambda=6, smooth_coordinates=FALSE, smooth_saccades=TRUE) {

    // samples = sample2matrix(samples);

    if (smooth_coordinates) {
        samples.x = kernal(samples.x, math.multiply(1/3, math.ones(3)));
        samples.y = kernal(samples.y, math.multiply(1/3, math.ones(3)));
    }

    samples = detectSaccades(samples, lambda, smooth_saccades);

    let fixations = aggregateFixations(samples);

    removeArtifacts(fixations);

    return fixations;
}

function detectSaccades(samples, lambda, smooth_saccades){
    let vx = kernal(samples.x, math.matrix([-0.5, 0, 0.5]));
    let vy = kernal(samples.y, math.matrix([-0.5, 0, 0.5]));

    let median_vx2 = math.median(math.pow(vx, 2));
    let medianvx_2 = math.pow(math.median(vx), 2);
    let msdx = math.sqrt(median_vx2 - medianvx_2);

    let median_vy2 = math.median(math.pow(vy, 2));
    let medianvy_2 = math.pow(math.median(vy), 2);
    let msdy = math.sqrt(median_vy2 - medianvy_2);

    let radiusx = math.multiply(lambda, msdx);
    let radiusy = math.multiply(lambda, msdy);

    let sacc = math.larger(
        math.pow(math.divide(vx, radiusx), 2) + math.pow(math.divide(vy, radiusy), 2),
        1);
    if (smooth_saccades) {
        sacc = kernal(sacc, math.multiply(1/3, math.ones(3)));
        sacc = math.larger(sacc, 0.5);
    }

    samples.saccade = sacc;
    samples.vx = vx;
    samples.vy = vy;

    return samples;
}

function aggregateFixations(samples) {
    let idx = math.range(0, samples.saccade.size());

    let sacc_event = math.concat(0, math.diff(samples.saccade));

    let begin = idx.filter((i)=>{
        math.equal(sacc_event.get(i),1);  
    });
    let end = idx.filter((i)=>{
        math.equal(sacc_event.get(i),-1);  
    });

    fixations = [];
    begin.forEach((element, i) => {
        slice = math.chain().range(element,end.get(i)+1).index().done();
        fixations.push(Fixation(
            samples.x.subset(slice),
            samples.y.subset(slice),
            element,
            end.get(i)));
    });

    return fixations;
}

function kernal(samples, kernal) {
    let kernalSize = length(kernal);
    let sampleSize = length(samples);

    let convMatrix = math.zeros(sampleSize, kernalSize);
    for (let row in math.range(0,sampleSize)) {
        convMatrix.subset(math.index(row, math.range(0,sampleSize)+row), kernal);
    }

    return math.concat(samples[0], 
        math.multiply(convMatrix, samples),
        samples[sampleSize-1]);
}

// Experimental: This function tries to detect blinks and artifacts
// based on x- and y-dispersion and duration of fixations.
function removeArtifacts(fixations){
    // not implemented yet... might cost a lot

    // fixations.forEach((fixation)=>{
    //     let lsdx = math.log10(fixation.madx);
    //     let lsdy = math.log10(fixation.mady);

    // })
}

function sample2matrix(samples) {
    let x = samples.x;
    let y = samples.y;
    let t = samples.timestamp;
}

class Fixation{
    constructor(x_coords, y_coords, start, end){
        this.x = math.median(x_coords);
        this.y = math.median(y_coords);
        this.madx = math.mad(x_coords);
        this.mady = math.mad(y_coords);
        this.start = start;
        this.end = end;
        this.duration = end - start;
    }

    draw(ctx, r=10, color='#0B5345') {
        ctx.fillStyle = color; 
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2, true);
        ctx.fill();
    }

    drawId(ctx, index, fontsize=16) {
        ctx.font = fontsize+'px serif';
        ctx.fillText(index, this.x, this.y);
    }

}