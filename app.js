var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const responseTime = require('response-time')

var indexRouter = require('./routes/index');
var textRouter = require('./routes/text');
var imageRouter = require('./routes/image');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(responseTime());

app.use('/', indexRouter);
app.use('/quote', textRouter);
app.use('/image', imageRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const response = '<!DOCTYPE html>  <head><title>Wiki-What - 404 not found</title><link rel="icon" href="favicon.png"><link rel="stylesheet" type="text/css" href="stylesheets/style.css"> <meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="5;url=/" /></head>' +
  '<body>' +
  '<div class="box">' +
  '<a href="/"><h1>The Take</h1></a>'+
  '<img src="/images/error.png" width="40%"/><h1>Oh no</h1>'+
    '<h2 style="color:#ba3b3b;">404</h2>'+
    '<h3>The page you where looking for does not exist.</h3>'+
    '<p>Unless you where looking for this page, in which case congrats, You will be re-directed to the home page in 5 seconds.</p>'+
    '</div></div>' +
    '</body><style> body {background-image: url("/images/cross-red.gif");}</style>';
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html');
    res.end(response);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
