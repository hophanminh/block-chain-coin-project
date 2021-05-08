const SHA256 = require('crypto-js/sha256');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const {Block} = require('./block');
const {hexToBinary} = require('../utils/hexToBinary');

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

const calculateHash = (index, previousHash, timestamp, data) => 
    SHA256(index + previousHash + timestamp + data).toString();

const genesisBlock = new Block(
    0, '04c21c8fe713bdb2b32be295b42a13e3e31dedd365fd06a7be04dd7d9d99f37cb8ddf270af344af55f213013e97e972736ebed2fc33858c1ef23fa34e7488f36fd', null, 1465154705, 'Genesis block'
);

const generateNextBlock = (blockData) => {
    const previousBlock = getLatestBlock();
    const nextIndex = previousBlock.index + 1;
    const nextTimestamp = new Date().getTime() / 1000;
    const nextHash = calculateHash(nextIndex, previousBlock.hash, nextTimestamp, blockData);
    const newBlock = new Block(nextIndex, nextHash, previousBlock.hash, nextTimestamp, blockData);
    return newBlock;
};

const isValidNewBlock = (newBlock, previousBlock) => {
    if (previousBlock.index + 1 !== newBlock.index) {
        console.log('invalid index');
        return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
        console.log('invalid previoushash');
        return false;
    } else if (calculateHashForBlock(newBlock) !== newBlock.hash) {
        console.log(typeof (newBlock.hash) + ' ' + typeof calculateHashForBlock(newBlock));
        console.log('invalid hash: ' + calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
        return false;
    }
    return true;
};

const isValidBlockStructure = (block) => {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'string';
};

const isValidChain = (blockchainToValidate) => {
    const isValidGenesis = (block) => {
        return JSON.stringify(block) === JSON.stringify(genesisBlock);
    };

    if (!isValidGenesis(blockchainToValidate[0])) {
        return false;
    }

    for (let i = 1; i < blockchainToValidate.length; i++) {
        if (!isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
            return false;
        }
    }
    return true;
};

const replaceChain = (newBlocks) => {
    if (isValidChain(newBlocks) && newBlocks.length > getBlockchain().length) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain = newBlocks;
        broadcastLatest();
    } else {
        console.log('Received blockchain invalid');
    }
};

let blockchain = [genesisBlock];

const hashMatchesDifficulty = (hash, difficulty) => {
    const hashInBinary = hexToBinary(hash);
    const requiredPrefix = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
};

const findBlock = (index, previousHash, timestamp, data, difficulty) => {
    let nonce = 0;
    while (true) {
        const hash = calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
        if (hashMatchesDifficulty(hash, difficulty)) {
            return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
        }
        nonce++;
    }
};

// in seconds
const BLOCK_GENERATION_INTERVAL = 10;

// in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;

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

const isValidTimestamp = (newBlock, previousBlock) => {
    return ( previousBlock.timestamp - 60 < newBlock.timestamp )
        && newBlock.timestamp - 60 < getCurrentTimestamp();
};

// // in seconds
// const BLOCK_GENERATION_INTERVAL = 10;

// // in blocks
// const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;

// class Transaction {
//     constructor(fromAddress, toAddress, amount) {
//         this.fromAddress = fromAddress;
//         this.toAddress = toAddress;
//         this.amount = amount;
//     }

//     calculateHash() {
//         return SHA256(this.fromAddress + this.toAddress + this.amount).toString();
//     }

//     signTransaction(signingKey) {
//         if(signingKey.getPublic('hex') !== this.fromAddress) {
//             throw new Error('Cannot sign.')
//         }

//         const hashTx = this.calculateHash();
//         const sign = signingKey.sign(hashTx, 'base46');
//         this.signature = sign.toDER('hex');
//     }

//     isValid() {
//         if(this.fromAddress === null) return true;
        
//         if(!this.signature || this.signature.length === 0){
//             throw new Error("No signature")
//         }

//         const publickey = ec.keyFromPublic(this.fromAddress, 'hex');
//         return publickey.verify(this.calculateHash(), this.signature)
//     }
// }

// class BlockChain {
//     constructor() {
//         this.chain = [this.createGenesisBlock()];
//         this.difficulty = 2;
//         this.pendingTransactions = [];
//         this.mineReward = 100;
//     }

//     createGenesisBlock() {
//         return new Block(0, 
//         "04c21c8fe713bdb2b32be295b42a13e3e31dedd365fd06a7be04dd7d9d99f37cb8ddf270af344af55f213013e97e972736ebed2fc33858c1ef23fa34e7488f36fd", 
//         null,
//         1465154705,
//         'Genesis Block'
//         );
//     }

//     calculateHash(index, previousHash, timestamp, transaction, nonce) {
//         return SHA256(this.index, this.previousHash + this.timestamp + JSON.stringify(this.transaction) + this.nonce).toString();
//     }

//     generateNextBlock(blockData) {
//         const previousBlock = this.getLatestBlock();
//         const nextIndex = previousBlock.index + 1;
//         const nextTimeStamp = new Date().getTime()/1000;
//         const nonce = 0;
//         const nextHash = this.calculateHash(nextIndex, previousBlock.hash, nextTimeStamp, blockData, nonce);
//         const newBlock = new Block(nextIndex, nextHash, previousBlock.hash, nextTimeStamp, blockData);
//     }



//     getLatestBlock() {
//         return this.chain[this.chain.length - 1];
//     }

//     miniPendingTransaction(mineRewardAddress) {
//         let block = new Block(this.getLatestBlock().index + 1, Date.now(), this.pendingTransactions);
//         block.mineBlock(this.difficulty);
//         console.log("Block successfully mined");
//         this.chain.push(block);
//         this.pendingTransactions = [
//             new Transaction(null, mineRewardAddress, this.mineReward)
//         ]
//     }

//     addTransaction(transaction) {
//         if(!transaction.fromAddress || !transaction.toAddress) {
//             throw new Error("Must include address");
//         }

//         if(!transaction.isValid()) {
//             throw new Error("Cannot add transaction")
//         }
//         this.pendingTransactions.push(transaction);
//     }

//     getBalanceOfAddress(address) {
//         let balance = 0;
//         for(const block of this.chain) {
//             for(const trans of block.transaction) {
//                 if(trans.fromAddress === address) {
//                     balance -= trans.amount;
//                 }

//                 if(trans.toAddress === address) {
//                     balance += trans.amount;
//                 }
//             }
//         }
//         return balance;
//     }

//     addBlock(newBlock) {
//         newBlock.previousHash = this.getLatestBlock().hash;
//         newBlock.mineBlock(this.difficulty);
//         this.chain.push(newBlock);
//     }

//     isChainValid() {
//         for(let i = 1; i < this.chain.length; i++) {
//             const currentBlock = this.chain[i];
//             const previousBlock = this.chain[i-1];

//             if(!currentBlock.hasValidTransaction()) {
//                 return false;
//             }

//             if(currentBlock.hash !== currentBlock.calculateHash() ||
//                 currentBlock.previousHash !== previousBlock.hash ) {
//                     return false;
//             }

//             return true;
//         }
//     }

//     replaceChain (newBlocks) {
//         if (newBlocks.isChainValid() && newBlocks.chain.length > this.chain.length) {
//             console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
//             this.chain = newBlocks;
//             broadcastLatest();
//         } else {
//             console.log('Received blockchain invalid');
//         }
//     };

//     adjustDifficult () {
//         const latestBlock = this.chain.getLatestBlock();
//         if (latestBlock.index % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && latestBlock.index !== 0) {
//             return getAdjustedDifficulty(latestBlock, aBlockchain);
//         } else {
//             return latestBlock.difficulty;
//         }
//     }

//     getAdjustedDifficulty(latestBlock) {
//         const timeExpected = BLOCK_GENERATION_INTERVAL * DIFFICULTY_ADJUSTMENT_INTERVAL;
//         const previousAdjustBlock = this.chain[this.chain.length - DIFFICULTY_ADJUSTMENT_INTERVAL];
//         const timeTaken = latestBlock.timestamp - previousAdjustBlock.timestamp;
//         if (timeTaken > timeExpected) {
//             this.difficulty--;
//         }
//         if(timeTaken < timeExpected) {
//             this.difficulty++;
//         }
//         return this.difficulty;
//     }
// }

// module.exports.BlockChain = BlockChain;
// module.exports.Transaction = Transaction;