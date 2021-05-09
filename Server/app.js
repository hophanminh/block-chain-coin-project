var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
{Block, generateNextBlock, getBlockchain} require('./model/blockchain');
{connectToPeers, getSockets, initP2PServer} require('./websocket/p2p');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

const httpPort = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort = parseInt(process.env.P2P_PORT) || 6001;

  app.use((err, req, res, next) => {
      if (err) {
          res.status(400).send(err.message)
      }
  });

  app.get('/blocks', (req, res) => {
      res.send(getBlockchain());
  });
  app.post('/mineBlock', (req, res) => {
      if (req.body.data == null) {
          res.send('data parameter is missing');
          return;
      }
      const newBlock = generateNextBlock(req.body.data);
      if (newBlock === null) {
          res.status(400).send('could not generate block');
      } else {
          res.send(newBlock);
      }
  });
  app.get('/peers', (req, res) => {
      res.send(getSockets().map((s) => s._socket.remoteAddress + ':' + s._socket.remotePort));
  });
  app.post('/addPeer', (req, res) => {
      connectToPeers(req.body.peer);
      res.send();
  });

  app.listen(myHttpPort, () => {
      console.log('Listening http on port: ' + myHttpPort);
  });


initHttpServer(httpPort);
initP2PServer(p2pPort);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
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
