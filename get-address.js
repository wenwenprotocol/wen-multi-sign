require('dotenv').config();
const { getMultiAccount } = require('./src/multi-sign');


async function get() {
    const { sender } = await getMultiAccount();
    console.log(`✅ Get multi-sign Address: ${sender}`);
}

get();
