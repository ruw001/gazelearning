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
    sample2tensor(samples);

    if (smooth_coordinates) {
        samples.x = vectorConv(samples.x, tf.ones([3, 1]).mul(1 / 3), 'original');
        samples.y = vectorConv(samples.y, tf.ones([3, 1]).mul(1 / 3), 'original');
    }

    samples = detectSaccades(samples, lambda, smooth_saccades);

    let [fixations, saccades] = aggregateFixations(samples);

    removeArtifacts(fixations);
    // @TODO:
    // 1. Filter our outliers
    // 2. Change to 5-nearest-neighbor graph

    return [fixations, saccades];
}

function detectSaccades(samples, lambda, smooth_saccades) {
    let dx = vectorConv(samples.x, tf.tensor1d([-1, 0, 1]), 'result');
    let dy = vectorConv(samples.y, tf.tensor1d([-1, 0, 1]), 'result');
    let dt = vectorConv(samples.t, tf.tensor1d([-1, 0, 1]), 'result');

    let vx = dx.div(dt);
    let vy = dy.div(dt);

    let median_vx2 = get_median(vx.pow(2));
    let medianvx_2 = get_median(vx).pow(2);
    let msdx = tf.sqrt(median_vx2.sub(medianvx_2));

    let median_vy2 = get_median(vy.pow(2));
    let medianvy_2 = get_median(vy).pow(2);
    let msdy = tf.sqrt(median_vy2.sub(medianvy_2));

    let radiusx = msdx.mul(lambda);
    let radiusy = msdy.mul(lambda);

    let sacc = vx.div(radiusx).pow(2)
        .add(vy.div(radiusy).pow(2))
        .greater(1);
    if (smooth_saccades) {
        sacc = vectorConv(sacc, tf.ones([3, 1]).mul(1 / 3), 'original');
        sacc = sacc.greater(0.5);
    }

    samples.saccade = sacc;
    samples.vx = vx;
    samples.vy = vy;

    return samples;
}

function aggregateFixations(samples) {
    let idx = tf.range(0, samples.saccade.shape[0]);

    let sacc_event = tf.concat([tf.tensor2d([0], [1, 1]),
        vectorConv(samples.saccade, tf.tensor1d([-1, 1]), 'none')])
        .squeeze().arraySync();
    // In sacc_event a 1 marks the start of a saccade and a -1 the
    // start of a fixation.

    let minusOnes = [];
    let plusOnes = [];
    sacc_event.forEach((sacc_e, i) => {
        if (sacc_e == -1) minusOnes.push(i);
        if (sacc_e == 1) plusOnes.push(i);
    }); // have to remove the use of tf.booleanMaskAsync(), since is an async function

    // Generate Saccades
    let begin = [...plusOnes];
    let end = [...minusOnes];
    let markBegin = false;
    let markEnd = false;
    if (end[0] < begin[0]) { // happens when the gaze starts directly from a fixation, end before start
        begin.unshift(0);
        markBegin = !markBegin;
    }
    if (begin[begin.length - 1] > end[end.length - 1]) { // happens when the gaze ends with a fixation, begin after end
        end.push(samples.saccade.shape[0] - 1);
        markEnd = !markEnd;
    }

    let saccades = [];
    begin.forEach((element, i) => {
        let sliceLen = end[i] - element;
        saccades.push(new Saccade(
            samples.x.slice(element, sliceLen),
            samples.y.slice(element, sliceLen),
            samples.vx.slice(element, sliceLen),
            samples.vy.slice(element, sliceLen)),
        );
    });
    if ((markBegin && !markEnd) || (!markBegin && markBegin)) {
        // markBegin xor markEnd, because there is no xor operator in js
        if (markBegin) {
            saccades[0].mark();
        } else {
            saccades[saccades.length - 1].mark();
        }
    }

    // Genarate Fixations, special cases
    begin = [...minusOnes];
    end = [...plusOnes];
    if (end[0] < begin[0]) { // happens when the gaze starts directly from a fixation, end before start
        begin.unshift(0);
    }
    if (begin[begin.length - 1] > end[end.length - 1]) { // happens when the gaze ends with a fixation, begin after end
        end.push(samples.saccade.shape[0] - 1);
    }

    // Genarate Fixations
    let fixations = [];
    begin.forEach((element, i) => {
        let sliceLen = end[i] - element;
        fixations.push(new Fixation(
            samples.x.slice(element, sliceLen),
            samples.y.slice(element, sliceLen),
            samples.t.slice(element, 1).squeeze(),
            samples.t.slice(end[i], 1).squeeze()) // Do we contain end[i] as fixation point?
        );
    });

    return [fixations, saccades];
}

function vectorConv(samples, kernal, padMode = 'original') {

    let result = tf.conv1d(samples.reshape([1, -1, 1]),
        kernal.reshape([-1, 1, 1]),
        1, 'valid').reshape([-1, 1]);
    // conv1d, x - [batch_size, input_size, feature_length]
    //         kernal - [kernal_width, indpeth, ourdepth]
    //         stride
    //         pad - 'same' for same size, 'valid' for valid length (input - kernal + 1)

    switch (padMode) {
        case 'none':
            // Do not pad
            return result;
            break;
        case 'original':
            // use original value to fill empty
            return tf.concat([samples.slice([0], [1]),
                result,
                samples.slice([samples.shape[0] - 1], [1])]);
            break;
        case 'result':
            // use computed result to fill empty
            return tf.concat([result.slice([0], [1]),
                result,
                result.slice([result.shape[0] - 1], [1])]);
            break;
        default:
            throw new Error('Wrong padding mode in function kernal()! Either original or result.');
    }
}

// Experimental: This function tries to detect blinks and artifacts
// based on x- and y-dispersion and duration of fixations.
function removeArtifacts(fixations) {
    // not implemented yet... might cost a lot

    // fixations.forEach((fixation)=>{
    //     let lsdx = math.log10(fixation.madx);
    //     let lsdy = math.log10(fixation.mady);

    // })
}

function sample2tensor(samples) {
    if (!(samples.x instanceof tf.Tensor)) {
        samples.x = tf.tensor2d(samples.x, [samples.x.length, 1]);
        samples.y = tf.tensor2d(samples.y, [samples.y.length, 1]);
        samples.t = tf.tensor2d(samples.t, [samples.t.length, 1]);
    }
}

function get_median(v) {
    let flattenV = v.reshape([-1]);
    let len = flattenV.shape[0]
    let mid = Math.floor(len / 2) + 1
    let val = tf.topk(flattenV.arraySync(), mid).values.dataSync();
    // I do not know why? Why must .arraySync()? Otherwise the topk() will raise an error.

    if (len % 2 == 1) {
        return tf.scalar(val[val.length - 1]);
    } else {
        return tf.scalar((val[val.length - 1] + val[val.length - 2]) / 2);
    }
}
