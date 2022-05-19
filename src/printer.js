const {
    encoding,
    bcs,
} = require('@starcoin/starcoin');
const {
    hexlify,
    arrayify,
} = require('@ethersproject/bytes');
const {
    readHexFromFile,
} = require('./multi-sign');


function makeId(item) {
    /// item: {
    ///     name:
    ///     functionName:
    ///     address:
    ///     module:
    /// }
    let name = item.name;
    if (!name) {
        name = item.functionName;
    };
    return `${item.address}::${item.module}::${name}`;
};


function makeTyArgs(ty_args) {
    /// ty_args: [
    ///        {
    ///          Struct: {
    ///            module: 'WEN',
    ///            name: 'WEN',
    ///            type_params: [],
    ///            address: '0xbf60b00855c92fe725296a436101c8c6'
    ///          }
    ///        }
    /// ]
    let result = [];
    ty_args.forEach((ty_arg) => {
        result.push(makeId(ty_arg.Struct))
    });
    return result;
};


function decodePayloadFromFile(filename) {

    /// signedUserTransaction {
    ///      transaction_hash: '',
    ///      raw_txn: {
    ///        sender: '0xbf60b00855c92fe725296a436101c8c6',
    ///        sequence_number: 2n,
    ///        payload: 'payload hex',
    ///        max_gas_amount: 10000000n,
    ///        gas_unit_price: 1n,
    ///        gas_token_code: '0x1::STC::STC',
    ///        expiration_timestamp_secs: 1652973713n,
    ///        chain_id: 1
    ///      },
    ///      authenticator: {
    ///        MultiEd25519: {
    ///          public_key: '',
    ///          signature: ''
    ///        }
    ///      }
    ///    }
    const signedUserTransaction = encoding.decodeSignedUserTransaction(
        readHexFromFile(filename)
    );

    /// Three types
    /// ScriptFunction: {
    ///      func: {
    ///        address: '0x00000000000000000000000000000001',
    ///        module: 'TransferScripts',
    ///        functionName: 'batch_peer_to_peer_v2'
    ///      },
    ///      ty_args: [
    ///        {
    ///          Struct: {
    ///            module: 'WEN',
    ///            name: 'WEN',
    ///            type_params: [],
    ///            address: '0xbf60b00855c92fe725296a436101c8c6'
    ///          }
    ///        }
    ///      ],
    ///      args: [ ]
    ///    }
    /// Script: {
    ///     code: '',
    ///     ty_args: [],
    ///     args: [],
    /// }
    /// Package: {
    ///     package_address: '',
    ///     modules: [],
    ///     init_script: {
    ///         func: {
    ///           address: '0x00000000000000000000000000000001',
    ///           module: 'TransferScripts',
    ///           functionName: 'batch_peer_to_peer_v2'
    ///         },
    ///         ty_args: [ ],
    ///         args: [ ]
    ///     },
    /// }
    return encoding.decodeTransactionPayload(signedUserTransaction.raw_txn.payload);
};


function deserializeAddress(deserializer) {
    var list = [];
    for (var i = 0; i < 16; i++) {
      list.push(deserializer.deserializeU8());
    }
    return hexlify(list);
};


function deserializeVectorAddress(deserializer) {
    let length = deserializer.deserializeLen();
    let list = [];
    for (let i = 0; i < length; i++) {
        list.push(deserializeAddress(deserializer));
    };
    return list;
};


function deserializeVectorU128(deserializer) {
    let length = deserializer.deserializeLen();
    let list = [];
    for (let i = 0; i < length; i++) {
        list.push(deserializer.deserializeU128());
    };
    return list;
};


function deserializeVectorU8(deserializer) {
    let length = deserializer.deserializeLen();
    let list = [];
    for (let i = 0; i < length; i++) {
        list.push(deserializer.deserializeU8());
    };
    return list;
};


function deserializeVectorU64(deserializer) {
    let length = deserializer.deserializeLen();
    let list = [];
    for (let i = 0; i < length; i++) {
        list.push(deserializer.deserializeU64());
    };
    return list;
};


function formatArgsWithTypeTag(deserializer, typeTag) {
    if (typeof typeTag == 'string') {
        switch (typeTag) {
            case "Address": {
                return hexlify(deserializer.deserializeBytes());
            }
            case "U128": {
                return deserializer.deserializeU128();
            }
            case "U8": {
                return deserializer.deserializeU8();
            }
            case "U64": {
                return deserializer.deserializeU64();
            }
            case "U16": {
                return deserializer.deserializeU16();
            }
            case "Bool": {
                return deserializer.deserializeBool() ? 'true' : 'false';
            }
        };
    } else if ('Vector' in typeTag) {
        switch (typeTag.Vector) {
            case "Address": {
                return deserializeVectorAddress(deserializer);
            }
            case "U128": {
                return deserializeVectorU128(deserializer);
            }
            case "U8": {
                return deserializeVectorU8(deserializer);
            }
            case "U64": {
                return deserializeVectorU64(deserializer);
            }
        };
    } else {
        return undefined;
    };
};


async function makeScriptFunction(provider, scriptFunction) {
    const functionId = makeId(scriptFunction.func);
    const ty_args = makeTyArgs(scriptFunction.ty_args);
    let args = scriptFunction.args;
    if (args.length > 0) {
        const { args: argsType } = await provider.send(
            'contract.resolve_function', [functionId],
        );
        /// argsType [
        ///  { doc: '', name: 'p0', type_tag: 'Signer' },
        ///  { doc: '', name: 'p1', type_tag: { Vector: 'Address' } },
        ///  { doc: '', name: 'p2', type_tag: { Vector: 'U128' } },
        /// ]
        let decodedArgs = [];
        for (let i = 0; i < args.length; i++) {
            decodedArgs.push(formatArgsWithTypeTag(
                new bcs.BcsDeserializer(arrayify(args[i])),
                argsType[i + 1].type_tag,
            ));
        };
        args = decodedArgs;
    };
    return { functionId, ty_args, args };
};


exports.printTxn = async (provider, filename) => {
    const payload = decodePayloadFromFile(filename);

    console.log('======= Transaction Info ===========');
    if (payload.ScriptFunction) {
        let p = await makeScriptFunction(provider, payload.ScriptFunction);
        console.log(
            'Type:  ScriptFunction',
            '\n functionId:', p.functionId,
            '\n ty_args:', p.ty_args,
            '\n args:', p.args,
        );
    } else if (payload.Package) {
        let data = payload.Package;
        console.log(
            'Type:  Package',
            '\npackage_address:', data.package_address,
        );
        if (data.init_script) {
            let p = await makeScriptFunction(provider, payload.Package.init_script);
            console.log(
                'init_script:',
                '\n\t functionId:', p.functionId,
                '\n\t ty_args:', p.ty_args,
                '\n\t args:', p.args,
            );
        };
    };
    console.log('====================================');
};
