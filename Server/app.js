const express = require("express");
const cors = require("cors");
require('console-stamp')(console, '[HH:MM:ss.l]');
require('dotenv').config()
const http = require("http")
const createError = require('http-errors');
const fs = require('fs');
const app = express();
const URL = `http://localhost:3000`;
const _ = require('lodash');
app.use(cors({
  origin: [URL]
}));

const { getBlockchain,
  getLatestBlock,
  generateRawNextBlock,
  generateNextBlock,
  generateNextBlockAnonymous,
  generatenextBlockWithTransaction,
  getAccountBalance,
  isValidBlockStructure,
  replaceChain,
  addBlock,
  getUnspentTxOuts,
  sendTransaction,
  sendTransactionAnonymous,
  handleReceivedTransaction,
  getMyUnspentTransactionOutputs,
  getAccountBalanceAnonymous,
  generatenextBlockWithTransactionAnonymous,
  getFinishTransactionAnonymous,
  getFinishTransaction
} = require('./model/blockchain');
const { getTransactionPool, setTransactionPool } = require('./model/transactionPool');
const { getPublicFromWallet, initWallet } = require('./model/wallet');
const {connectToPeers, getSockets, initP2PServer} = require('./websocket/p2p');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

// view engine setup

// app.use(logger('dev'));
// app.use(cookieParser());
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

app.set('view engine', 'jade');
app.use(express.urlencoded({ extended: false }));

const httpPort = parseInt(process.env.HTTP_PORT) || 9000;
const p2pPort = parseInt(process.env.P2P_PORT) || 3001;


// route
initWallet();
initP2PServer(p2pPort);

const { readTransaction, readChain } = require('./utils/storeChain')
if (fs.existsSync("chaindb/chain.json")) {
  const data = readChain()
  //console.log(data)
  if (data && data.length === 1) {
    return
  }
  replaceChain(data)
}

if (fs.existsSync("transactitondb/transactiondb")) {
  setTransactionPool(readTransaction())
}


app.get('/blocks', (req, res) => {
  res.send(getBlockchain());
});

app.get('/balance', (req, res) => {
  console.log("Here");
  const balance = getAccountBalance();
  res.send({ 'balance': balance });
});

app.post('/balanceAnonymous', (req, res) => {
  console.log(req.body.address);
  const balance = getAccountBalanceAnonymous(req.body.address);
  res.send({ 'balance': balance });
});

app.get('/unSpent', (req, res) => {
  res.send(getUnspentTxOuts());
});

app.get('/myUnSpent', (req, res) => {
  res.send(getMyUnspentTransactionOutputs());
});

app.get('/address', (req, res) => {
  const address = getPublicFromWallet();
  res.send({ 'address': address });
});

app.get('/pool', (req, res) => {
  res.send(getTransactionPool());
});

app.get('/peers', (req, res) => {
  res.send(getSockets().map((s) => s._socket.remoteAddress + ':' + s._socket.remotePort));
});

app.get('/block/:id', (req, res) => {
  const block = _.find(getBlockchain(), { 'index': Number(req.params.id) });
  if (block) {
    res.send(block);
  }
  else {
    res.status(400).send('could not find block');
  }
});

app.get('/transaction/:id', (req, res) => {
  const tx = _(getBlockchain())
    .map((blocks) => blocks.data)
    .flatten()
    .find({ 'id': req.params.id });
  res.send(tx);
});

app.post('/mineBlock', (req, res) => {                 //  reward for miner, but without transaction
  const newBlock = generateNextBlock();
  if (newBlock === null) {
    res.status(400).send('could not generate block');
  } else {
    res.send(newBlock);
  }
});

app.post('/mineBlockAnonymous', (req, res) => {
  const address = req.body.address;
  console.log(address);                 //  reward for miner, but without transaction
  const newBlock = generateNextBlockAnonymous(address);
  if (newBlock === null) {
    res.status(400).send('could not generate block');
  } else {
    res.send(newBlock);
  }
});

app.post('/mineTransaction', (req, res) => {           //  reward for miner and with transaction
  const address = req.body.address;
  const amount = Number(req.body.amount);
  try {
    const resp = generatenextBlockWithTransaction(address, amount);
    res.send(resp);
  } catch (e) {
    console.log(e.message);
    res.status(400).send(e.message);
  }
});

app.post('/sendTransaction', (req, res) => {
  try {
    const address = req.body.address;
    const amount = req.body.amount;
    if (address === undefined || amount === undefined) {
      throw Error('invalid address or amount');
    }
    const resp = sendTransaction(address, amount);
    res.send(resp);
  } catch (e) {
    console.log(e.message);
    res.status(400).send(e.message);
  }
});

app.post('/sendTransactionAnonymous', (req, res) => {
  try {
    const transaction = req.body.transaction;
    const sender = req.body.sender;
    const reeceiver = req.body.reeceiver;
    const amount = req.body.amount;
    const privateKey = req.body.privateKey;

    const resp = generatenextBlockWithTransactionAnonymous(sender, reeceiver, amount, privateKey)
    res.send(resp);
  } catch (e) {
    console.log(e.message);
    res.status(400).send(e.message);
  }
});

app.post('/addPeer', (req, res) => {
  connectToPeers(req.body.peer);
  res.send();
});

app.post('/stop', (req, res) => {
  res.send({ 'msg': 'stopping server' });
  process.exit();
});

app.post('/finishTransactionAnonymous', (req, res) => {
  try {
    const pool = getFinishTransactionAnonymous(getBlockchain(), req.body.address);
    res.send(pool);
  }
  catch (error) {
    res.status(400).send(error.message);
  }
});

app.get('/finishTransaction', (req, res) => {
  const pool = getFinishTransaction(getBlockchain());
  console.log(pool[0]);
  res.send(pool);
});

// catch 404 and forward to error handler
app.use(function (err, req, res, next) {
  console.log(err)
});


app.listen(httpPort, () => {
  console.log('Listening http on port: ' + httpPort);
});

