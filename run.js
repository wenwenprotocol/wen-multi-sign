const Config = require('./src/config');
const {
    Args,
    network,
    sendToDiscord,
} = require('./src/constant');
const {
    readTxn,
    writeTxn,
    mergeMultiTxn,
    readHexFromFile,
    getMultiAccount,
} = require('./src/multi-sign');


async function run() {
    const txnFile = Args[0];
    const config = Config.networks[network];
    console.log(config, network)
    const provider = config.provider();

    const balanceOf = async (address, tokenType='0x1::STC::STC') => {
        let balance = await provider.getBalance(address, tokenType);
        return balance / (10 ** 9);
    };

    await sendToDiscord(
        `Begin ${network} multi-sign job ...`,
        `file: ${txnFile}`,
    );

    const { shardAccount, sender } = await getMultiAccount();

    const timed = `✅ Transaction Multi ${txnFile}`;
    console.time(timed);

    const { enough, txn } = await mergeMultiTxn(shardAccount, readTxn(txnFile));
    const newFilename = await writeTxn(txn);
    if (enough) {
        const before_b = await balanceOf(sender);
        const signedUserTransactionHex = readHexFromFile(newFilename);
        const txnInfo = await sendTransaction(signedUserTransactionHex);
        const after_b = await balanceOf(sender);
        await sendToDiscord(
            `👍 Success ${txnInfo.status}`,
            `${config.stcscan}${txnInfo.transaction_hash}`,
            `Gas: ${before_b - after_b}`,
        );
    } else {
        await sendToDiscord(
            `👍 Success transaction with multi-sign`,
            `txn file: ${newFilename}`,
        );
    };
    console.timeEnd(timed);

    await sendToDiscord(`Done ${network} multi-sign job.`);
};

run()
