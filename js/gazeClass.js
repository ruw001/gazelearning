class Fixation{
    constructor(x_coords, y_coords, start, end){
        this.xall = x_coords;
        this.x = tf.mean(x_coords).squeeze().dataSync()[0];
        this.xmax = tf.max(x_coords).squeeze().dataSync()[0];
        this.xmin = tf.min(x_coords).squeeze().dataSync()[0];
        this.xmad = get_median(x_coords.sub(get_median(x_coords))).dataSync()[0];

        this.yall = y_coords;
        this.y = tf.mean(y_coords).squeeze().dataSync()[0];
        this.ymax = tf.max(y_coords).squeeze().dataSync()[0];
        this.ymin = tf.min(y_coords).squeeze().dataSync()[0];
        this.ymad = get_median(y_coords.sub(get_median(y_coords))).dataSync()[0];
        
        this.start = start;
        this.end = end;
        this.duration = end.sub(start);
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
        console.log(this.x);
        console.log(this.y);
    }

    drawRectArea(ctx, color='#0B5345') {
        ctx.strokeStyle = color;
        ctx.strokeRect(this.xmin, this.ymin, this.xmax - this.xmin, this.ymax - this.ymin);
    }
}

class Saccade{
    constructor(x_coords, y_coords, vx, vy) {
        this.xall = x_coords.squeeze().arraySync();
        this.yall = y_coords.squeeze().arraySync();
        this.vx = vx.squeeze().arraySync();
        this.vy = vy.squeeze().arraySync();
    }

    mark() {
        this.additional = true;
    } // To mark saccades before the first fixation or after the last fixation

    drawVelocity(ctx, arrowLen = 14, color = 'blue') {
        // color = '#'+Math.floor(Math.random()*16777215).toString(16);

        this.xall.forEach((fromX, i)=>{
            let fromY = this.yall[i];
            let offsetX = arrowLen * Math.cos(Math.atan2( this.vy[i], this.vx[i] ));
            let offsetY = arrowLen * Math.sin(Math.atan2( this.vy[i], this.vx[i] ));

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

class AoI{
    constructor(id, fixations, saccades, nFixations){
        this.id = id;
        this.fixations = fixations;
        this.saccades = saccades;

        this.labelLineCount = 0;
        this.colorDict = {
            'safe':'rgb(218, 247, 166)', // sprout green
            'warning':'rgb(247, 220, 111)', // lemon yellow
            'danger':'rgb(236, 112, 99)', // sunset red
        };

        this.percentage = fixations.length / nFixations;

        let min = null;
        this.fixations.forEach((fixation)=>{
            if (!min) {
                min = fixation.xmin;
            } else if (fixation.xmin < min) {
                min = fixation.xmin;
            }
        });
        this.xmin = min;

        min = null;
        this.fixations.forEach((fixation)=>{
            if (!min) {
                min = fixation.ymin;
            } else if (fixation.ymin < min) {
                min = fixation.ymin;
            }
        });
        this.ymin = min;

        let max = null;
        this.fixations.forEach((fixation)=>{
            if (!max) {
                max = fixation.xmax;
            } else if (fixation.xmax > max) {
                max = fixation.xmax;
            }
        });
        this.xmax = max;

        max = null;
        this.fixations.forEach((fixation)=>{
            if (!max) {
                max = fixation.ymax;
            } else if (fixation.ymax > max) {
                max = fixation.ymax;
            }
        });
        this.ymax = max;
    }  

    dispersion2confusion() {

    }
    
    getDwellTime() {
        return this.fixations.reduce((sum, fixation) => {
            return fixation.duration.add(sum)
        }, 0).arraySync();
    }
    
    draw(ctx, status) {
        ctx.strokeStyle = this.colorDict[status];
        ctx.strokeRect(this.xmin, this.ymin, this.xmax - this.xmin, this.ymax - this.ymin);
    }

    drawRectArea(ctx, status) {
        ctx.globalAlpha = this.percentage;
        ctx.fillStyle = this.colorDict[status];
        ctx.fillRect(this.xmin, this.ymin, this.xmax - this.xmin, this.ymax - this.ymin);
        ctx.globalAlpha = 1;
    }

    addLine(ctx, status, label, value){
        ctx.font = '16px Times';
        ctx.textBaseline = "hanging";

        let text = `${label} : ${value}`;
        let textMetrics = ctx.measureText(text);
        // let lineCount = Math.ceil(textMetrics.width / (this.xmax - this.xmin));
        this.labelLineCount += 1;

        ctx.globalAlpha = this.percentage;
        ctx.fillStyle = this.colorDict[status];
        ctx.fillRect(this.xmin,
            this.ymin - this.labelLineCount*(textMetrics['actualBoundingBoxDescent']+textMetrics['actualBoundingBoxAscent']+8),
            this.xmax - this.xmin,
            textMetrics['actualBoundingBoxDescent']+textMetrics['actualBoundingBoxAscent']+8)
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'black';
        ctx.fillText(text,
            this.xmin,
            this.ymin - this.labelLineCount*(textMetrics['actualBoundingBoxDescent']+textMetrics['actualBoundingBoxAscent']+8),
            this.xmax - this.xmin); // to control maxWidth
        // console.log('LABEL #'+ this.labelLineCount + ':'+ this.labelLineCount*(textMetrics['actualBoundingBoxDescent']+textMetrics['actualBoundingBoxAscent']+8))
    }
}

function AoIBuilder (fixations, saccades, classes) {
    let nClass = Math.max(...classes) + 1;
    let AoIs = [];

    let TMatrix = tf.zeros([nClass, nClass]).arraySync()

    for (let classId of Array(nClass).keys()) {

        let fixationInAoI = [];
        let saccadeInAoI = [];

        let preIdx = classes.indexOf(classId);
        let nextIdx = classes.indexOf(classId, preIdx+1);
        while (nextIdx != -1) {
            fixationInAoI.push( fixations[preIdx] );
            if ( preIdx + 1 == nextIdx ) {
                saccadeInAoI.push( saccades[preIdx] );
            } else {
                TMatrix[classId][ classes[preIdx + 1] ] += 1;
            }
            preIdx = nextIdx;
            nextIdx = classes.indexOf(classId, nextIdx + 1);
        }
        fixationInAoI.push( fixations[preIdx] );
        if ( preIdx + 1 < classes.length ) TMatrix[classId][ classes[preIdx + 1] ] += 1;

        AoIs.push( new AoI(classId, fixationInAoI, saccadeInAoI, classes.length) )
        // keep fixations and saccades that belong to the specified class
    }

    return [AoIs, TMatrix];
}

function showTransition(ctx, AoIs, TMatrix, width=20) {
    let AoIX = [];
    let AoIY = [];

    let nTransition = tf.sum(tf.tensor2d(TMatrix, [AoIs.length, AoIs.length]).reshape([-1])).arraySync();

    AoIs.forEach((AoI)=>{
        AoIX[AoI.id] = ( (AoI.xmin + AoI.xmax) / 2 );
        AoIY[AoI.id] = ( (AoI.ymin + AoI.ymax) / 2 );
    });

    AoIX.forEach((fromX, id) => {
        let fromY = AoIY[id];
        TMatrix[id].forEach((transitionCount, classId)=>{
            if (transitionCount) {
                let toX = AoIX[classId];
                let toY = AoIY[classId];
                let percent = transitionCount/nTransition;
                console.log(`#${id}=>#${classId}:${percent}, width=${width*percent}, transparency=${percent}`);
                drawArrow(ctx, fromX, fromY, toX, toY, 30, 10,width*percent,color=`rgba(0,0,255,${percent})`);
            }
        });
    });
}
