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

function detectFixations(samples, lambda=6, smooth_coordinates=false, smooth_saccades=true) {

    sample2matrix(samples);

    if (smooth_coordinates) {
        samples.x = kernal(samples.x, math.multiply(1/3, math.ones(3)));
        samples.y = kernal(samples.y, math.multiply(1/3, math.ones(3)));
    }

    samples = detectSaccades(samples, lambda, smooth_saccades);

    let [fixations, saccades] = aggregateFixations(samples);

    removeArtifacts(fixations);

    return [fixations, saccades];
}

function detectSaccades(samples, lambda, smooth_saccades){
    let dx = kernal(samples.x, math.matrix([-1, 0, 1]), 'result');
    let dy = kernal(samples.y, math.matrix([-1, 0, 1]), 'result');
    let dt = kernal(samples.t, math.matrix([-1, 0, 1]), 'result');

    let vx = math.dotDivide(dx, dt);
    let vy = math.dotDivide(dy, dt);

    let median_vx2 = math.median(pow2(vx));
    let medianvx_2 = math.pow(math.median(vx), 2);
    let msdx = math.sqrt(median_vx2 - medianvx_2);

    let median_vy2 = math.median(pow2(vy));
    let medianvy_2 = math.pow(math.median(vy), 2);
    let msdy = math.sqrt(median_vy2 - medianvy_2);

    let radiusx = math.multiply(lambda, msdx);
    let radiusy = math.multiply(lambda, msdy);

    let sacc = math.larger(
        math.add(pow2(math.divide(vx, radiusx)), pow2(math.divide(vy, radiusy))),
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
    let idx = math.range(0, samples.saccade.size()[0]);

    let sacc_event = math.concat([0], math.diff(samples.saccade));
    // In sacc_event a 1 marks the start of a saccade and a -1 the
    // start of a fixation.

    let minusOnes = math.filter(idx, (i)=>{
        return math.equal(sacc_event.get([i]),-1);  
    }); // start of sacc, end of fixation
    let plusOnes = math.filter(idx, (i)=>{
        return math.equal(sacc_event.get([i]),1);  
    }); // start of fixation, end of sacc

    // Generate Saccades
    let begin = plusOnes;
    let end = minusOnes;
    if (end.get([0]) < begin.get([0])){ // happens when the gaze starts directly from a fixation, end before start
        begin = math.concat([0], begin);
    } 
    if (begin.get([ begin.size()[0]-1 ]) > end.get([ end.size()[0]-1 ])) { // happens when the gaze ends with a fixation, begin after end
        end = math.concat(end, [math.subtract(samples.saccade.size()[0], 1)]);
    }

    let saccades = [];
    begin.forEach((element, i) => {
        slice = math.index(math.range(element,end.get(i)+1));
        saccades.push(new Saccade(
            samples.x.subset(slice),
            samples.y.subset(slice),
            samples.vx.subset(slice),
            samples.vy.subset(slice))
        );
    })

    // Genarate Fixations, special cases
    begin = minusOnes;
    end = plusOnes;
    if (end.get([0]) < begin.get([0])){ // happens when the gaze starts directly from a fixation, end before start
        begin = math.concat([0], begin);
    } 
    if (begin.get([ begin.size()[0]-1 ]) > end.get([ end.size()[0]-1 ])) { // happens when the gaze ends with a fixation, begin after end
        end = math.concat(end, [math.subtract(samples.saccade.size()[0], 1)]);
    }

    // Genarate Fixations
    let fixations = [];
    begin.forEach((element, i) => {
        slice = math.index(math.range(element,end.get(i)+1));
        fixations.push(new Fixation(
            samples.x.subset(slice),
            samples.y.subset(slice),
            samples.t.get([element]),
            samples.t.get([end.get(i)]))
        );
    });

    return [fixations, saccades];
}

function kernal(samples, kernal, padMode='original') {
    let kernalSize = math.squeeze(kernal.size());
    let sampleSize = math.squeeze(samples.size());

    let convMatrix = math.zeros(sampleSize-kernalSize+1, sampleSize);
    math.range(0,convMatrix.size()[0]).forEach( row => {
        convMatrix.subset(math.index(row, math.add(math.range(0,kernalSize), row)), kernal);
    });

    let result = math.multiply(convMatrix, samples);
    switch (padMode) {
        case 'none':
            // Do not pad
            return result;
            break;
        case 'original':
            // use original value to fill empty
            return math.concat([samples.get([0])], 
                result,
                [samples.get([sampleSize-1])], 0);
            break;
        case 'result':
            // use computed result to fill empty
            return math.concat([result.get([0])], 
                result,
                [result.get([sampleSize-kernalSize])], 0);
            break;
        default:
            throw new Error('Wrong padding mode in function kernal()! Either original or result.');
    }
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
    samples.x = math.matrix(samples.x);
    samples.y = math.matrix(samples.y);
    samples.t = math.matrix(samples.t);
}

function pow2(vector){
    return math.dotMultiply(vector, vector)
}

class Fixation{
    constructor(x_coords, y_coords, start, end){
        this.xall = x_coords;
        this.x = math.mean(x_coords);
        this.xmad = math.mad(x_coords);
        this.xmax = math.max(x_coords);
        this.xmin = math.min(x_coords);

        this.yall = y_coords;
        this.y = math.mean(y_coords);
        this.ymad = math.mad(y_coords);
        this.ymax = math.max(y_coords);
        this.ymin = math.min(y_coords);
        
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

    drawId(ctx, index, r=10, fontsize=16) {
        ctx.font = fontsize+'px serif';
        ctx.fillText(index, this.x+r, this.y+r);
    }

    drawRectArea(ctx, color='#0B5345') {
        ctx.strokeStyle = color;
        ctx.strokeRect(this.xmin, this.ymin, this.xmax - this.xmin, this.ymax - this.ymin);
    }
}

class Saccade{
    constructor(x_coords, y_coords, vx, vy) {
        this.xall = x_coords;
        this.yall = y_coords;
        this.vx = vx;
        this.vy = vy;
    }

    drawVelocity(ctx, arrowLen = 14, color = 'blue') {
        // color = '#'+Math.floor(Math.random()*16777215).toString(16);

        this.xall.forEach((fromX, i)=>{
            let fromY = this.yall.get(i);
            let offsetX = arrowLen * math.cos(math.atan2( this.vy.get(i), this.vx.get(i) ));
            let offsetY = arrowLen * math.sin(math.atan2( this.vy.get(i), this.vx.get(i) ));

            drawArrow(ctx, fromX, fromY, fromX+offsetX, fromY+offsetY, 30, 2, 3, color);

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(fromX, fromY, 5, 0, Math.PI * 2, true);
            ctx.fill();
        });
    }
}

function drawArrow(ctx, fromX, fromY, toX, toY,theta,headlen,width,color) {
 
    theta = typeof(theta) != 'undefined' ? theta : 30;
    headlen = typeof(headlen) != 'undefined' ? headlen : 10;
    width = typeof(width) != 'undefined' ? width : 1;
    color = typeof(color) != 'color' ? color : '#000';
 
    // 计算各角度和对应的P2,P3坐标
    var angle = Math.atan2(fromY - toY, fromX - toX) * 180 / Math.PI,
        angle1 = (angle + theta) * Math.PI / 180,
        angle2 = (angle - theta) * Math.PI / 180,
        topX = headlen * Math.cos(angle1),
        topY = headlen * Math.sin(angle1),
        botX = headlen * Math.cos(angle2),
        botY = headlen * Math.sin(angle2);
 
    ctx.save();
    ctx.beginPath();
 
    var arrowX = fromX - topX,
        arrowY = fromY - topY;
 
    ctx.moveTo(arrowX, arrowY);
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    arrowX = toX + topX;
    arrowY = toY + topY;
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(toX, toY);
    arrowX = toX + botX;
    arrowY = toY + botY;
    ctx.lineTo(arrowX, arrowY);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
}
