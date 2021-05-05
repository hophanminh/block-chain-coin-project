const SHA256 = require('crypto-js/sha256');
const EC = require('elliptic').ec;
const ec = new EC('secp256k1');

class Transaction {
    constructor(fromAddress, toAddress, amount) {
        this.fromAddress = fromAddress;
        this.toAddress = toAddress;
        this.amount = amount;
    }

    calculateHash() {
        return SHA256(this.fromAddress + this.toAddress + this.amount).toString();
    }

    signTransaction(signingKey) {
        if(signingKey.getPublic('hex') !== this.fromAddress) {
            throw new Error('Cannot sign.')
        }

        const hashTx = this.calculateHash();
        const sign = signingKey.sign(hashTx, 'base46');
        this.signature = sign.toDER('hex');
    }

    isValid() {
        if(this.fromAddress === null) return true;
        
        if(!this.signature || this.signature.length === 0){
            throw new Error("No signature")
        }

        const publickey = ec.keyFromPublic(this.fromAddress, 'hex');
        return publickey.verify(this.calculateHash(), this.signature)
    }
}

class Block {
    constructor(timestamp, transaction, previousHash = '') {
        this.timestamp = timestamp;
        this.transaction = transaction;
        this.previousHash = previousHash;
        this.hash = '';
        this.nonce = 0;
    }

    calculateHash() {
        return SHA256(this.previousHash + this.timestamp + JSON.stringify(this.transaction) + this.nonce).toString();
    }

    mineBlock(difficulty) {
        while(this.hash.substring(0, difficulty) !== Array(difficulty+1).join("0")) {
            this.nonce++;
            this.hash = this.calculateHash();
        }

        console.log("Block mined: " + this.hash);
    }
 
    hasValidTransaction() {
        for( const tx of this.transaction) {
            if(!tx.isValid())
            return false;
        }
        return true;
    }
}



class BlockChain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = 5;
        this.pendingTransactions = [];
        this.mineReward = 100;
    }

    createGenesisBlock() {
        return new Block('04/05/2021', "Genesis Block", "0");
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    miniPendingTransaction(mineRewardAddress) {
        let block = new Block(Date.now(), this.pendingTransactions);
        block.mineBlock(this.difficulty);
        console.log("Block successfully mined");
        this.chain.push(block);
        this.pendingTransactions = [
            new Transaction(null, mineRewardAddress, this.mineReward)
        ]
    }

    addTransaction(transaction) {
        if(!transaction.fromAddress || !transaction.toAddress) {
            throw new Error("Must include address");
        }

        if(!transaction.isValid()) {
            throw new Error("Cannot add transaction")
        }
        this.pendingTransactions.push(transaction);
    }

    getBalanceOfAddress(address) {
        let balance = 0;
        for(const block of this.chain) {
            for(const trans of block.transaction) {
                if(trans.fromAddress === address) {
                    balance -= trans.amount;
                }

                if(trans.toAddress === address) {
                    balance += trans.amount;
                }
            }
        }
        return balance;
    }

    addBlock(newBlock) {
        newBlock.previousHash = this.getLatestBlock().hash;
        newBlock.mineBlock(this.difficulty);
        this.chain.push(newBlock);
    }

    isChainValid() {
        for(let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i-1];

            if(!currentBlock.hasValidTransaction()) {
                return false;
            }

            if(currentBlock.hash !== currentBlock.calculateHash() ||
                currentBlock.previousHash !== previousBlock.hash ) {
                    return false;
            }

            return true;
        }
    }
}

module.exports.BlockChain = BlockChain;
module.exports.Transaction = Transaction;