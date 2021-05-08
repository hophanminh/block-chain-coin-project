const {BlockChain, Transaction} = require('./blockchain');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

const myKey = ec.keyFromPrivate('6182404c59864c19c4b950a5ed2e4a618a01d18b06c50d917b4b1f6b96283578');
const walletAddress = myKey.getPublic('hex');

let coin = new BlockChain();
const tx1 = new Transaction(walletAddress, 'publicKeyHere', 10);

tx1.signTransaction(myKey);
coin.addTransaction(tx1);
coin.miniPendingTransaction(walletAddress);
console.log("balance: " + coin.getBalanceOfAddress(walletAddress));
coin.miniPendingTransaction(walletAddress);
console.log("balance: " + coin.getBalanceOfAddress(walletAddress));



// coin.addBlock(new Block("04/05/2021", {amount: 10}));
// coin.addBlock(new Block("04/05/2021", {amount: 20}));

// coin.addTransaction(new Transaction('address1', 'address2', '100'));
// coin.addTransaction(new Transaction('address2', 'address1', '50'));
// coin.miniPendingTransaction('abcde');
// console.log("balance: " + coin.getBalanceOfAddress('abcde'));
// coin.miniPendingTransaction('abcde');
// console.log("balance: " + coin.getBalanceOfAddress('abcde'));

// console.log(JSON.stringify(coin, null, 4));