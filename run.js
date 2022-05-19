const inquirer = require('inquirer');
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
const {
    printTxn,
} = require('./src/printer');


async function run() {
    const txnFile = Args[0];
    const config = Config.networks[network];
    const provider = config.provider();

    await printTxn(provider, txnFile);
    try {
        const answers = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'isConfirmRun',
                message: 'Can this be submitted ?',
                default: false,
            }
        ]);
        if (!answers.isConfirmRun) {
            console.log('Cancelling ...');
            return;
        };
    } catch (error) {
        console.log('❌ inquirer got some error.');
    };

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
        const txn = await provider.sendTransaction(signedUserTransactionHex);
        const txnInfo = await txn.wait(1);
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

    if (network == "development") {
        provider.destroy();
    };
};

run()
