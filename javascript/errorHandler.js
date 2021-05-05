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