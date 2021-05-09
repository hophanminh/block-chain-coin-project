const CryptoJS = require("crypto-js");
const _ = require('lodash');
const hexToBinary = require('hex-to-binary');
const { UnspentTxOut, Transaction, processTransactions, getCoinbaseTransaction, isValidAddress } = require('./transaction');
const { createTransaction, findUnspentTxOuts, getBalance, getPrivateFromWallet, getPublicFromWallet } = require('./wallet');
const { addToTransactionPool, getTransactionPool, updateTransactionPool } = require('./transactionPool');

class Block {
    constructor(index, hash, previousHash, timestamp, data, difficulty, nonce) {
        this.index = index;
        this.previousHash = previousHash;
        this.timestamp = timestamp;
        this.data = data;
        this.hash = hash;
        this.difficulty = difficulty;
        this.nonce = nonce;
    }
}

// in seconds
const BLOCK_GENERATION_INTERVAL = 10;

// in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;

const genesisBlock = new Block(
    0, '816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7', '', 1465154705, [], 0, 0
);

let blockchain = [genesisBlock];
let unspentTxOuts = [];

// get function
const getBlockchain = () => blockchain;

const getLatestBlock = () => blockchain[blockchain.length - 1];

const getUnspentTxOuts = () => _.cloneDeep(unspentTxOuts);

const getMyUnspentTransactionOutputs = () => {
    return findUnspentTxOuts(getPublicFromWallet(), getUnspentTxOuts());
};

const setUnspentTxOuts = (newUnspentTxOut) => {
    console.log('replacing unspentTxouts with: %s', newUnspentTxOut);
    unspentTxOuts = newUnspentTxOut;
};

const getCurrentTimestamp = () => Math.round(new Date().getTime() / 1000);

const generateRawNextBlock = (blockData) => {
    const previousBlock = getLatestBlock();
    const nextIndex = previousBlock.index + 1;
    const nextTimestamp = getCurrentTimestamp();
    const difficulty = getDifficulty(getBlockchain());

    const newBlock = mineBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);
    if (addBlock(newBlock)) {
        const { broadcastLatest } = require('../socket/p2p')
        broadcastLatest();
        return newBlock;
    } else {
        return null;
    }
};

const generateNextBlock = () => {
    const coinbaseTx = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
    const blockData = [coinbaseTx].concat(getTransactionPool());
    return generateRawNextBlock(blockData);
};

const generatenextBlockWithTransaction = (receiverAddress, amount) => {
    if (!isValidAddress(receiverAddress)) {
        console.log('invalid address');
        return null
    }
    if (typeof amount !== 'number') {
        console.log('invalid amount');
        return null
    }
    const coinbaseTx = getCoinbaseTransaction(getPublicFromWallet(), getLatestBlock().index + 1);
    const tx = createTransaction(receiverAddress, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool());

    const blockData = [coinbaseTx, tx];
    return generateRawNextBlock(blockData);
};

// calculate difficulty, hash. balance function
const getDifficulty = (aBlockchain) => {
    const latestBlock = aBlockchain[blockchain.length - 1];
    if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
        return getAdjustedDifficulty(latestBlock, aBlockchain);
    } else {
        return latestBlock.difficulty;
    }
};

const getAdjustedDifficulty = (latestBlock, aBlockchain) => {
    const prevAdjustmentBlock = aBlockchain[blockchain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
    const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
    const timeTaken = latestBlock.timestamp - prevAdjustmentBlock.timestamp;
    if (timeTaken < timeExpected / 2) {
        return prevAdjustmentBlock.difficulty + 1;
    } else if (timeTaken > timeExpected * 2) {
        return prevAdjustmentBlock.difficulty - 1;
    } else {
        return prevAdjustmentBlock.difficulty;
    }
};

const getAccountBalance = () => {
    return getBalance(getPublicFromWallet(), getUnspentTxOuts());
};

const sendTransaction = (address, amount) => {
    const tx = createTransaction(address, amount, getPrivateFromWallet(), getUnspentTxOuts(), getTransactionPool());
    addToTransactionPool(tx, getUnspentTxOuts());
    const { broadCastTransactionPool } = require('../socket/p2p')
    broadCastTransactionPool();
    return tx;
};

const calculateHashForBlock = (block) =>
    calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);

const calculateHash = (index, previousHash, timestamp, data, difficulty, nonce) =>
    CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();

const addBlock = (newBlock) => {
    if (isValidNewBlock(newBlock, getLatestBlock())) {
        const retVal = processTransactions(newBlock.data, getUnspentTxOuts(), newBlock.index);
        if (retVal === null) {
            console.log('block is not valid in terms of transactions');
            return false;
        } else {
            blockchain.push(newBlock);
            setUnspentTxOuts(retVal);
            updateTransactionPool(unspentTxOuts);
            return true;
        }
    }
};

// check valid function
const isValidTimestamp = (newBlock, previousBlock) => {
    return (previousBlock.timestamp - 60 < newBlock.timestamp)
        && newBlock.timestamp - 60 < getCurrentTimestamp();
};

const isValidBlockStructure = (block) => {
    if (block == null) {
        console.log('block is null');
        return false;
    } else if (typeof block.index !== 'number') {
        console.log('invalid block index type');
        return false;
    } else if (typeof block.hash !== 'string') {
        console.log('invalid block hash type');
        return false;
    } else if (typeof block.previousHash !== 'string') {
        console.log('invalid block previousHash type');
        return false;
    } else if (typeof block.timestamp !== 'number') {
        console.log('invalid block timestamp type');
        return false;
    }
    // else if (typeof block.data !== 'object') {
    //     console.log('invalid block data type');
    //     return false;
    // }
    return true;
};

const hashMatchesDifficulty = (hash, difficulty) => {
    const hashInBinary = hexToBinary(hash);
    const requiredPrefix = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};

const isValidNewBlock = (newBlock, previousBlock) => {
    if (!isValidBlockStructure(newBlock)) {
        console.log('invalid block structure: %s', JSON.stringify(newBlock));
        return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    }
    else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    }
    else if (!isValidTimestamp(newBlock, previousBlock)) {
        console.log('invalid timestamp');
        return false;
    }
    else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
        console.log('invalid hash, got:' + newBlock.hash);
        return false;
    }
    else if (!hashMatchesDifficulty(newBlock.hash, newBlock.difficulty)) {
        console.log('block difficulty not satisfied. Expected: ' + newBlock.difficulty + 'got: ' + newBlock.hash);
        return false;
    }

    return true;
};

const isValidChain = (blockchainToValidate) => {
    if (JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(genesisBlock)) {
        return null;
    }

    let newUnspentTxOuts = [];
    for (let i = 1; i < blockchainToValidate.length; i++) {
        if (!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return null;
        }

        const currentBlock = blockchainToValidate[i];
        newUnspentTxOuts = processTransactions(currentBlock.data, newUnspentTxOuts, currentBlock.index);
        if (newUnspentTxOuts === null) {
            console.log('invalid transactions when replace blockchain');
            return null;
        }
    }

    return newUnspentTxOuts;
};

// edit blockchain function 

const getAccumulatedDifficulty = (aBlockchain) => {
    return aBlockchain
        .map((block) => block.difficulty)
        .map((difficulty) => Math.pow(2, difficulty))
        .reduce((a, b) => a + b);
};

const replaceChain = (newBlocks) => {
    const newUnspentTxOuts = isValidChain(newBlocks);
    if (newUnspentTxOuts !== null &&
        getAccumulatedDifficulty(newBlocks) > getAccumulatedDifficulty(getBlockchain())) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        setUnspentTxOuts(newUnspentTxOuts);
        updateTransactionPool(unspentTxOuts);
        const { broadcastLatest } = require('../socket/p2p')
        broadcastLatest();
    } else {
        console.log('Received blockchain invalid');
    }
};

const mineBlock = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    while (true) {
        const hash = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
};

const handleReceivedTransaction = (transaction) => {
    addToTransactionPool(transaction, getUnspentTxOuts());
};

module.exports = {
    Block,
    getBlockchain,
    getLatestBlock,
    generateRawNextBlock,
    generateNextBlock,
    generatenextBlockWithTransaction,
    getAccountBalance,
    isValidBlockStructure,
    replaceChain,
    addBlock,
    getUnspentTxOuts,
    sendTransaction,
    handleReceivedTransaction,
    getMyUnspentTransactionOutputs
};