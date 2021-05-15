const fs = require('fs');
const path = require('path');
const winston = require('winston');

// const FILEPATH = '/Users/hudongyin/Documents/Projects/File storage';
// const FILEPATH = 'D:\\mnt\\fileserver'

const FILEPATH = '/mnt/fileserver';
// const FILEPATH = '/Users/williamwang/Desktop/temp_log'

const errorPage = (code, message) => `<head>
    <title>Something's wrong!</title>
    <meta charset="utf-8"/>
    <style type="text/css">
          .box {
            display: flex;
            align-items: center;
            justify-content: center;
          }
    </style>
</head>
<body>
    <div class="box">
      <div style="font-size: 110px">${code}</div>
      <ul style="font-size: 30px"> ${message} <br> <a href="/">Click to go back homepage.</a></li></ul>
    </div>
</body>
`;

function getRequestLogFormatter() {
    const {combine, timestamp, printf} = winston.format;

    return combine(
        timestamp(),
        printf(info => {
            return `[${info.timestamp}] [${info.level.toUpperCase()}]: ${info.message}`;
        })
    );
}

function getLogFilename(servername) {
    const dedicated = servername.toLowerCase().indexOf('d') >= 0;

    const today = new Date();
    const logpath = path.join(FILEPATH, 'logs', `${today.getFullYear()}-${today.getMonth() + 1 < 10 ? '0' + (today.getMonth() + 1) : today.getMonth() + 1}-${today.getDate() < 10 ? '0' + today.getDate() : today.getDate()}`);
    let count = 0;

    if (!fs.existsSync(logpath)) {
        fs.mkdir(logpath,
            {recursive: true},
            (err) => {
                if (err) throw err;
            });
    } else {
        fs.readdirSync(logpath).forEach(file => {
            // is js log file?
            if (file.endsWith('log') && file.toLowerCase().indexOf('js') >= 0) {
                if (dedicated) {
                    // filename contains d from dedicated
                    if (file.toLowerCase().indexOf('d') >= 0) ++count;
                } else {
                    // filename does not contain d
                    if (file.toLowerCase().indexOf('d') < 0) ++count;
                }
            }
        });
    }

    return path.join(logpath, `${dedicated ? 'dedicated-' : ''}js-${count}.log`);
}

// Exports
exports.FILEPATH = FILEPATH;
exports.errorHandler = function (err, req, res, next) {
    res.status(err.statusCode).send(errorPage(err.statusCode, err.message));
}
exports.getLogger = function (servername) {
    return winston.createLogger({
        format: getRequestLogFormatter(),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({filename: getLogFilename(servername)})
        ]
    });
}