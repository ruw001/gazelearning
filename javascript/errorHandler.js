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

exports.errorHandler = function (err, req, res, next) {
    res.status(err.statusCode).send(errorPage(err.statusCode, err.message));
}

exports.getLogFilename = function (servername) {
    const dedicated = servername.toLowerCase().indexOf('d') >= 0;

    const today = new Date();
    const logpath = path.join(FILEPATH, 'logs', `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`);
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
            if (!fs.lstatSync(path.resolve(logpath, file)).isDirectory() && file.toLowerCase().indexOf('js')) {
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

    return path.join(logpath, `${dedicated ? 'dedicated-' : ''}js-${count}.log`)
}