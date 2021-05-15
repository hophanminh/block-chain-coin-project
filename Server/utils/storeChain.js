const fs = require('fs');

const saveChain = (chain) => {
    try {
        fs.writeFileSync('chaindb/chain.json', JSON.stringify(chain));
    } catch (err) {
        console.log(err)
    }
}

const readChain = () => {
    try {
        const file = fs.readFileSync('chaindb/chain.json', 'utf8')
        if (file === '') {
            return null
        }
        const data = JSON.parse(file);
        return data
    } catch (err) {
        console.log(err)
        return null
    }
}

const saveTransaction = (transactionPool) => {
    try {
        fs.writeFileSync('transactiondb/transaction.json', JSON.stringify(transactionPool));
    } catch (err) {
        console.log(err)
    }

}

const readTransaction = () => {
    try {
        const file = fs.readFileSync('transactiondb/transaction.json', 'utf8')
        if (file === '') {
            return null
        }
        const data = JSON.parse(file);
        return data
    } catch (err) {
        console.log(err)
        return null
    }
}

module.exports = {
    saveChain,
    readChain,
    saveTransaction,
    readTransaction
};
