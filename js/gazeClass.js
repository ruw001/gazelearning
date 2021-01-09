class Fixation{
    constructor(x_coords, y_coords, start, end){
        if (typeof(tf) !== "undefined") {
            // Toggle when use tensorflow.js to compute fixations and saccades
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
            this.duration = end.sub(start).dataSync()[0];
        } else {
            // Toggle when use math.js to compute fixations and saccades
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

        // Bind confusion detection with fixation
        this.confusionCount = 0;
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
        if (typeof(tf) !== "undefined") {
            // Toggle when use tensorflow.js to compute fixations and saccades
            this.xall = x_coords.squeeze().arraySync();
            this.yall = y_coords.squeeze().arraySync();
            this.vx = vx.squeeze().arraySync();
            this.vy = vy.squeeze().arraySync();
        } else {
            // Toggle when use math.js to compute fixations and saccades
            this.xall = x_coords;
            this.yall = y_coords;
            this.vx = vx;
            this.vy = vy;
        }
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
            'safe': "#06d6a0",
            'warning':"#ffd166",
            'danger':"#ef476f",
        };

        this.status;

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
            return fixation.duration + sum
        }, 0);
    }
    
    getStatus() {

        if (this.status !== undefined) return this.status;

        let randNum = Math.random();

        if (randNum < 0.33) {
            this.status = "safe";
        } else if (randNum < 0.66) {
            this.status = "warning";
        } else {
            this.status = "danger";
        }

        return this.status
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

    let TMatrix = d3.range(0, nClass).fill(d3.range(0, nClass).fill(0));
    // equals to zeros(nClass, nClass)
    // which creates a nClass x nClass matrix filled with zeros

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

function showAoI(AoIs, animationTime) {
    // Powered with d3.js https://d3js.org/
    let t = d3.transition()
            .duration(animationTime);

    let strokeWidth = 10;

    let gSelection = d3.select("#plotting_svg")
                        .selectAll("g.AoI")
                        .data(AoIs)
                        .join(
                            enter => enter.append("g").classed("AoI", true),
                            update => update,
                            exit => exit.call(
                                g => {
                                    g.selectAll("rect")
                                    .transition(t)
                                    .remove()
                                    .attr("width", 0)
                                    .attr("height", 0);

                                    g.selectAll("text")
                                    .transition(t)
                                    .remove()
                                    .text(" ");

                                    g.transition(t).remove();
                        }));
    
    gSelection.selectAll("rect.AoI")
            .data(d => [d])
            .join(
                enter => enter.append("rect")
                            .attr("x", d => d.xmin)
                            .attr("y", d => d.ymin)
                            .attr("width", 0)
                            .attr("height", 0)
                            .style("stroke-width", strokeWidth+"px")
                            .classed("AoI", true),
                update => update,
                exit => exit.remove() // should never be called? remove of <g> should have handled this.
            ).call(rect => rect.transition(t)
                .attr("x", d => d.xmin) // update rects in selection "update"
                .attr("y", d => d.ymin) // update rects in selection "update"
                .attr("width", d => d.xmax - d.xmin)
                .attr("height", d => d.ymax - d.ymin)
                // .style("fill", d => d.colorDict[d.getStatus()])
                .style("fill", "none")
                .style("stroke", d => d.colorDict[d.getStatus()])
                .style('opacity', d => d.percentage)
            );
    
    gSelection.selectAll("text")
            .data(d => [d])
            .join(
                enter => enter.append("text")
                        .attr("x", d => d.xmin)
                        .attr("y", d => d.ymin)
                        .attr("dx", -strokeWidth / 2)
                        .attr("dy", -strokeWidth)
                        .text(d => "Dwell Time:"+d.getDwellTime()),
                update => update.text(d => "Dwell Time:"+d.getDwellTime()),
                exit => exit.remove() // should never be called? remove of <g> should have handled this.
            )
            .call(s => s.each( function (d) {console.log(this.getBBox()); return d.bbox = this.getBBox();} ))
            .transition(t)
            .attr("x", d => d.xmin) // update rects in selection "update"
            .attr("y", d => d.ymin);

    gSelection.selectAll("rect.background")
            .data(d => [d])
            .join(
                enter => enter.insert("rect","text")
                            .attr("x", d => d.xmin - strokeWidth / 2)
                            .attr("y", d => d.ymin - d.bbox.height - strokeWidth / 2)
                            .attr("width", 0)
                            .attr("height", 0)
                            .classed("background", true),
                update => update,
                exit => exit.remove()
            ).transition(t)
            .attr("x", d => d.xmin -strokeWidth / 2) // update rects in selection "update"
            .attr("y", d => d.ymin - d.bbox.height - strokeWidth / 2) // update rects in selection "update"
            .attr("width", d => d.bbox.width + strokeWidth) // the background extends a little bit
            .attr("height", d => d.bbox.height)
            .style("fill", d => d.colorDict[d.getStatus()])
            .style("opacity", d => d.percentage);
}

function showTransition(AoIs, TMatrix, animationTime) {
    let t = d3.transition()
            .duration(animationTime);
    let theta = 30;
    let arrowLen = 20;
    let margin = 10;
    let arrowWidth = 20;

    let AoIX = [];
    let AoIY = [];

    let nTransition = d3.sum(d3.merge(TMatrix));

    AoIs.forEach((AoI)=>{
        AoIX[AoI.id] = ( (AoI.xmin + AoI.xmax) / 2 );
        AoIY[AoI.id] = ( (AoI.ymin + AoI.ymax) / 2 ) + 1;
        // for transition calculation, otherwise initial arrow state calculation will thrwo error
    });

    let gSelection = d3.select("#plotting_svg")
                    .selectAll("g.transition")
                    .data(TMatrix)
                    .join("g")
                    .classed("transition", true);

    gSelection.selectAll("path")
        .data( (d, i) => {
            let dataList = [];
            for (let j = 0; j < d.length; j++) {
                dataList.push({count:d[j],fixationId:i})
            }
            return dataList
        })
        .join("path")
        .attr("d", (d, i) => arrowGenerator(
            AoIX[d.fixationId], AoIY[d.fixationId], AoIX[d.fixationId]+5, AoIY[d.fixationId]+5, arrowWidth*d.count/nTransition, theta, arrowLen
        ))
        .attr("stroke", "#000")
        // .attr("fill", "url(#arrowGradient)")
        // .attr("stroke-width", d => arrowWidth*d.count/nTransition)
        .attr("opacity", d => d.count/nTransition)
        .transition(t)
        .attr("d", (d, i) => arrowGenerator(
            AoIX[d.fixationId], AoIY[d.fixationId], AoIX[i], AoIY[i], arrowWidth*d.count/nTransition, theta, arrowLen
        ))
}

function arrowGenerator(fromX, fromY, toX, toY, width, theta,headlen) {
    //         P4
    //         |\
    //       P5| \ 
    // P6------|  \ 
    // |           \P3 (toX, toY)
    // |           /
    // P0------|  /
    //       P1| /
    //         |/ 
    //         P2 

    let pathString = "";

    theta = typeof(theta) != 'undefined' ? theta : 30;
    headlen = typeof(headlen) != 'undefined' ? headlen : 10;

    let angle = Math.atan2(toY - fromY, toX - fromX);
    let k = Math.tan(angle);
    let perpendicularAngle = angle - Math.PI / 2;

    let p0x = fromX + width / 2 * Math.cos(perpendicularAngle);
    let p0y = fromY + (width / 2 * Math.sin(perpendicularAngle)); // y axis is inversed in JS 

    let p1x = (toX - headlen * Math.cos(angle)) + width / 2 * Math.cos(perpendicularAngle);
    let p1y = (toY - headlen * Math.sin(angle)) + width / 2 * Math.sin(perpendicularAngle);

    let p2x = p1x + width * Math.cos(perpendicularAngle);
    let p2y = p1y + (width * Math.sin(perpendicularAngle));

    let p6x = fromX - width / 2 * Math.cos(perpendicularAngle);
    let p6y = fromY - (width / 2 * Math.sin(perpendicularAngle));

    let p5x = (toX - headlen * Math.cos(angle)) - width / 2 * Math.cos(perpendicularAngle);
    let p5y = (toY - headlen * Math.sin(angle)) - width / 2 * Math.sin(perpendicularAngle);

    let p4x = p5x - width * Math.cos(perpendicularAngle);
    let p4y = p5y - width * Math.sin(perpendicularAngle);

    let curveAngle = angle - theta * Math.PI / 180;
    let curveLength = Math.round(Math.sqrt(Math.pow(fromY - toY, 2) + Math.pow(fromX - toX, 2)) * 0.1);

    let fromDX = curveLength * Math.cos(curveAngle);
    let fromDY = curveLength * Math.sin(curveAngle); // for Bézier Curves

    let toDX, toDY;
    if (k === Infinity || k === -Infinity){
        toDX = fromDX;
        toDY = -fromDY; // for Bézier Curves
    } else if (k == 0) {
        toDX = -fromDX;
        toDY = fromDY; // for Bézier Curves 
    } else {
        toDX = -(- fromDX*k*k + 2*fromDY*k + fromDX)/(k*k + 1);
        toDY = -(fromDY*k*k + 2*fromDX*k - fromDY)/(k*k + 1);
    }

    pathString += `M ${p0x} ${p0y} `;
    pathString += `C ${p0x + fromDX} ${p0y + fromDY}, ${(p1x + toDX)} ${(p1y + toDY)}, ${p1x} ${p1y} `;
    pathString += `L ${p2x} ${p2y} `;
    pathString += `L ${toX} ${toY} `;
    pathString += `L ${p4x} ${p4y} `;
    pathString += `L ${p5x} ${p5y} `;
    pathString += `C ${p5x + toDX} ${p5y + toDY}, ${(p6x + fromDX)} ${(p6y + fromDY)}, ${p6x} ${p6y} `;
    pathString += `Z`; // Z for close path

    // console.log(`angle: ${angle * 180 / Math.PI},  fromDX : ${fromDX}, fromDY : ${fromDY}, toDX : ${toDX}, toDY : ${toDY}`)
    // console.log(`Path genera ted : ${pathString}`);

    return pathString;
}