const express = require('express');
const app = express();
const bodyParser = require('body-parser'); 
const Blockchain = require('./blockchain'); 
const rp = require('request-promise');
var path = require('path');
var validator = require('validator');
const SHA256 = require('crypto-js/sha256');
const fs = require('fs');
const http = require('http');
var server = http.createServer(app);
var nodemailer = require('nodemailer');
var forge = require('node-forge');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const {BlockChain, Transaction} = require('./blockchain');


const myKey = ec.keyFromPrivate('6182404c59864c19c4b950a5ed2e4a618a01d18b06c50d917b4b1f6b96283578');
const walletAddress = myKey.getPublic('hex');

let coin = new BlockChain();
const tx1 = new Transaction(walletAddress, 'publicKeyHere', 100);

app.set('view engine', 'ejs');

const port = process.env.PORT || process.argv[2];

app.use(express.static(path.join(__dirname, 'Front'))); //public
app.use("/styles", express.static(__dirname + '/Front/assets'));//allow css in invitation page (public)

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var server = app.listen(port, function () {
    console.log('listening to port: ' + port);
});

const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
let coin = new Blockchain();



const nodes = [];
var io = require('socket.io')(server);

/*  -Socket.io-  */
io.on('connection', (socket) => {
    const key = ec.genKeyPair();
    const publicKey = key.getPublic('hex');
    const privateKey = key.getPrivate('hex');
    console.log('privateKey: ' + privateKey);
    console.log('public key: ' + publicKey);

    const initialFirstTransaction = new Transaction("publicKey", publicKey, 100);
    initialFirstTransaction.signTransaction(key);
    coin.addTransaction(initialFirstTransaction);

    app.get("/mine", (req, res) => {
        coin.miniPendingTransaction(publicKey);
    })

    app.get("/balance", (req, res) => {

    })

    app.post("/sendMoney", (req, res) => {
        
    })

















    /*  -On connection of socket-  */
    nodes.push(new Blockchain(socket.id));
    socket.emit('PT', backup.pendingTransactions); //emit to that specific socket
    console.log('New user connected');
    console.log(socket.id);

    /*
    * Title: Broadcast Transanction section
    * Description: Init transaction for every endpoint.
    */
    app.post('/transaction/broadcast', (req, res) => {

        const amount = parseFloat(req.body.amount);
        const newTransaction = nodes[nodes.length-1].createNewTransaction(amount, req.body.sender, req.body.recipient);
        let flag = true;
        let sender = req.body.sender;
        /*  -Authentication: check for valid private key-  */
        if ((sender !== "system-reward") && (sender !== "system-reward: new user") && (sender !== "system-reward: invitation confirmed")) {
            const privateKey_Is_Valid = sha256(req.body.privKey) === req.body.sender;
            if (!privateKey_Is_Valid) {
                flag = false;
                res.json({
                    note: false
                });
            }
            /*  -Authentication: check if user have the require amount of coins for current transaction && if user exist in the blockchain-  */
            const addressData = backup.getAddressData(req.body.sender);
            const addressData1 = backup.getAddressData(req.body.recipient);
            if (addressData.addressBalance < amount || addressData === false || addressData1 === false) {
                flag = false;
                res.json({
                    note: false
                });
            }
            /*  -Authentication: fields cannot be empty-  */
            if (req.body.amount.length === 0 || amount === 0 || amount < 0 || req.body.sender.length === 0 || req.body.recipient.length === 0) {
                flag = false;
                res.json({
                    note: false
                });
            }
        }
        
        if (amount > 0 && flag === true) {
            var pt = null;
            backup.addTransactionToPendingTransactions(newTransaction);//put new transaction in global object
            nodes.forEach(socketNode => {
                socketNode.addTransactionToPendingTransactions(newTransaction);
                io.clients().sockets[(socketNode.socketId).toString()].pendingTransactions = socketNode.pendingTransactions;//add property to socket
                pt = socketNode.pendingTransactions;
            });
            io.clients().emit('PT', pt);//emit to all sockets
            res.json({
                note: `Transaction complete!`
            });
        }
    });


    /*
    * Title: Miner section
    * Description: user mine the last block of transaction by POW, getting reward and init a new block
    */
    app.get('/mine', (req, res) => {
        const lastBlock = backup.getLastBlock();
        const previousBlockHash = lastBlock['hash'];

        const currentBlockData = {
            transactions: backup.pendingTransactions,
            index: lastBlock['index'] + 1
        }

        const nonce = backup.proofOfWork(previousBlockHash, currentBlockData);//doing a proof of work
        const blockHash = backup.hashBlock(previousBlockHash, currentBlockData, nonce);//hash the block
        const newBlock = backup.createNewBlock(nonce, previousBlockHash, blockHash);//create a new block with params
        
        const requestOptions = {//a promise to make a new block
            uri: backup.currentNodeUrl + '/receive-new-block',
            method: 'POST',
            body: { newBlock: newBlock },
            json: true
        };
        rp(requestOptions)
            .then(data => {//reward the miner after mining succed and new block already created
                const requestOptions = {
                    uri: backup.currentNodeUrl + '/transaction/broadcast',
                    method: 'POST',
                    body: {
                        amount: 12.5,
                        sender: "system-reward",
                        recipient: public_key
                    },
                    json: true
                };
                return rp(requestOptions);
            })
            .then(data => {
                res.json({
                    note: "New block mined and broadcast successfully",
                    block: newBlock
                });
            });
    });


    /*
    * Title: receive new block section
    * Description: checking validity of new block.
    */
    app.post('/receive-new-block', (req, res) => {
        const newBlock = req.body.newBlock;
        const lastBlock = backup.getLastBlock();
        const correctHash = lastBlock.hash === newBlock.previousBlockHash;
        const correctIndex = lastBlock['index'] + 1 === newBlock['index'];

        if (correctHash && correctIndex) {
            backup.chain.push(newBlock);
            backup.pendingTransactions = [];
            res.json({
                note: 'New block received and accepted.',
                newBlock: newBlock
            });
        }
        else {
            res.json({
                note: 'New block rejected',
                newBlock: newBlock
            });
        }
    });

    
    /*
    * Title: emitMiningSuccess
    * Description: emit all sockets - a message to all sockets for mining operation succed
    */
    app.get('/emitMiningSuccess', (req, res) => {
        io.clients().emit('mineSuccess', true);//emit to all sockets
    });


    /*
    * Title: pendingTransactions
    * Description: get all pending Transactions
    */
    app.get('/pendingTransactions', (req, res) => {
        const transactionsData = backup.getPendingTransactions();
        res.json({
            pendingTransactions: transactionsData
        });
    });


    /*
    * Title: Main Blockchain
    * Description: display the whole block chain (Developers Only!)
    */
    app.get('/blockchain', (req, res) => {
        res.send(backup);
    });

    /*
* Title: generateKeyPair
* Description: generateKeyPair
*/
    var keyPair = forge.pki.rsa.generateKeyPair(1024);
    app.get('/generateKeyPair', (req, res) => {
        res.send(keyPair.publicKey);
    });

    /*
    * Title: Authentication Keys
    * Description: Authentication for private and public keys
    */
    app.post('/hashKeys', (req, res) => {
        const k1 = req.body.key1;
        
            //const k1 = keyPair.privateKey.decrypt(req.body.k1);
            //console.log(k1);

            const k2 = req.body.key2;
            const privateKey_Is_Valid = sha256(k1) === k2;

            const addressData = backup.getAddressData(k2);
            if (addressData === false) {
                res.json({
                    note: false
                });
            }

            else if (!privateKey_Is_Valid) {
                res.json({
                    note: false
                });
            }
            else {
                res.json({
                    note: true
                });
            }
        
    });


    /*
    * Title: Send Invitation (INVITE A FRIEND: step 1/3)
    * Description: generate an invitation and send it to recipient email
    */
    app.post('/sendInvitation', (req, res) => {
        let email = req.body.email;//email of recipient
        const senderKey = req.body.sender;//sender ID/Key
        let invitationID = uniqid();//generate invitation ID

        var toChange;//the value that need to be change
        if (validator.isEmail(email.toString())) {
            /*  -Connect to database "invitationsDB"-  */
            MongoClient.connect(url, function (err, db) {
                if (err) throw err;
                console.log("Database connected!");
                let dbo = db.db("invitationsDB");

                let query = { key: senderKey };//query to find

                let promise = new Promise(function (resolve, reject) {
                    dbo.collection("users").find(query).toArray(function (err, result) {//find the sender in db
                        if (err) throw err;
                        toChange = result[0].inv;//set the veriable to the num of avilable invitations 
                        resolve("done!");
                    });
                });
                promise.then(
                    function (result) {
                        if (toChange === 0) {
                            toChange = 0;
                            res.json({
                                note: false,
                                message: 'dismiss - num of invitation is 0'
                            });
                        }
                        else {
                            toChange--;//substruct the num of available invitations
                            let newvalues = { $set: { inv: toChange } };
                            let newInvite = { $push: { availableInvitations: invitationID } };
                            dbo.collection("users").updateOne(query, newvalues, function (err, res1) {//update in db
                                if (err) throw err;
                                console.log(res1.result.nModified + " document(s) updated");
                                dbo.collection("users").updateOne(query, newInvite, function (err, res2) {//update in db
                                    if (err) throw err;
                                    console.log(res2.result.nModified + " document(s) updated");
                                    ///////////////////////////////////////////////////////////////

                                    /*  -going to invitation end point and generate new invitation-  */
                                    const uri = backup.currentNodeUrl + '/invitation/' + invitationID + '/sender=' + senderKey;
                                    const requestOptions = {
                                        uri: uri,
                                        method: 'GET',
                                        json: true
                                    };
                                    rp(requestOptions)
                                        .then(data => {
                                            //
                                        });

                                    /*  -email configurations-  */
                                    var transporter = nodemailer.createTransport({
                                        service: 'gmail',
                                        auth: {
                                            user: 'YourEmailAdress@gmail.com',
                                            pass: 'YourPassword'
                                        }
                                    });

                                    var mailOptions = {
                                        from: 'JewCOIN',
                                        to: email,
                                        subject: 'הוזמנת לרשת הבלוקציין של JewCOIN',
                                        text: 'קיבלת הזמנה לרשת הבלוקציין של JewCOIN \n להפעלת החשבון לחץ על הקישור המצורף:\n\n' + uri
                                    };

                                    /*  -send the email-  */
                                    transporter.sendMail(mailOptions, function (error, info) {
                                        if (error) {
                                            console.log(error);
                                            res.json({
                                                note: false
                                            });
                                        }
                                        else {
                                            console.log('Email sent: ' + info.response);
                                            res.json({
                                                note: true,
                                                numOfInv: toChange
                                            });
                                        }
                                    });

                                    ///////////////////////////////////////////////////////////////
                                    db.close();
                                });
                            });

                        }
                    },
                    function (error) {
                        console.log("there was an error");
                    }
                )
            });
        }

        else {
            res.json({
                note: 'not valid email'
            });
        }
        
    });
    
    /*  -Chat: send message to all users-  */
    /*
    * Title: Chat - get new message
    * Description: get a message and emit it to all users
    */
    socket.on('getNewMessage', (message) => {
        //message = message.toString();
        //message = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        io.clients().emit('newMessage', message);
    });

    /*
    * Title: disconnect
    * Description: enabled when user logs off
    */
    socket.on('disconnect', () => {
        console.log(`User: ${socket.id} was disconnected`)
        nodes.splice(search((socket.id).toString(), nodes), 1);
    });

});