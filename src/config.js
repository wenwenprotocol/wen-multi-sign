const {
    providers
} = require('@starcoin/starcoin');


// networks
module.exports = {
    networks: {
        development: {
            chainId: 254,
            provider: () => {
                return new providers.WebsocketProvider("ws://127.0.0.1:9870");
            },
            stcscan: "",
        },
        mainnet: {
            chainId: 1,
            provider: () => {
                return new providers.JsonRpcProvider("https://main-seed.starcoin.org");
            },
            stcscan: "https://stcscan.io/main/transactions/detail/",
        },
        barnard: {
            chainId: 251,
            provider: () => {
                return new providers.JsonRpcProvider("https://barnard-seed.starcoin.org");
            },
            stcscan: "https://stcscan.io/barnard/transactions/detail/",
        },
    }
};
