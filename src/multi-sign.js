const {
    hexlify,
    arrayify,
} = require('@ethersproject/bytes');

const {
    utils,
    encoding,
    starcoin_types,
} = require('@starcoin/starcoin');

const {
    utils: ed25519Utils,
} = require('@starcoin/stc-ed25519');

const {
    readFileSync,
    writeFileSync,
} = require('fs');


exports.getMultiAccount = async () => {
    const shardAccount = await utils.multiSign.generateMultiEd25519KeyShard(
        process.env.PUBLIC_KEYS.split(','),
        process.env.PRIVATE_KEY.split(','),
        process.env.THRESHOLD,
    );
    const account = utils.account.showMultiEd25519Account(shardAccount);
    return { shardAccount, sender: account.address };
};


exports.writeTxn = (txn) => {
    const name = Buffer.from(ed25519Utils.randomPrivateKey()).toString('hex').slice(0, 8);
    const filename = `${ name }.multisig-txn`;
    writeFileSync(filename, arrayify(encoding.bcsEncode(txn)));
    console.log(`{  "ok": "${ filename }"   }`)
    return filename;
};


exports.readHexFromFile = (filename) => {
    const rbuf = readFileSync(filename);
    return hexlify(rbuf);
};


exports.readTxn = (filename) => {
    const hex = this.readHexFromFile(filename);
    return encoding.bcsDecode(starcoin_types.SignedUserTransaction, hex);
};


exports.signMultiTxn = (shardAccount, signatureShard, rawTransaction) => {
    const threshold = signatureShard.threshold;
    const address = encoding.addressFromSCS(rawTransaction.sender);
    const authenticator = new starcoin_types.TransactionAuthenticatorVariantMultiEd25519(
        shardAccount.publicKey(),
        signatureShard.signature,
    );

    if (signatureShard.is_enough()) {
        console.log(`multisig txn(address: ${address}): enough signatures collected for the multisig txn, txn can be submitted now`);
    } else {
        const count = signatureShard.signature.signatures.length;
        console.log(`multisig txn(address: ${address}): ${count} signatures collected still require ${threshold-count} signatures`);
    };
    return new starcoin_types.SignedUserTransaction(rawTransaction, authenticator);
};


exports.mergeMultiTxn = async (shardAccount, rawSignatureShard) => {
    const rawTransaction = rawSignatureShard.raw_txn;
    const rawAuthenticator = rawSignatureShard.authenticator;
    const threshold = rawAuthenticator.public_key.threshold;

    // raw
    const rawSignatureShards = new starcoin_types.MultiEd25519SignatureShard(rawAuthenticator.signature, threshold);

    // new
    const signatureShard = await utils.multiSign.generateMultiEd25519SignatureShard(shardAccount, rawTransaction);
    const newSignatureShards = new starcoin_types.MultiEd25519SignatureShard(signatureShard.signature, threshold);

    // merge
    const mergedSignatureShards = starcoin_types.MultiEd25519SignatureShard.merge([rawSignatureShards, newSignatureShards]);

    const enough = mergedSignatureShards.is_enough();
    const txn = this.signMultiTxn(shardAccount, mergedSignatureShards, rawTransaction);
    return { enough, txn };
};
