require('dotenv').config();
const args = require('minimist')(process.argv.slice(2));
const Discord = require('discord.js');
const request = require('request');


exports.Args = args._;
exports.network = args.network == undefined ? 'development' : args.network;


exports.sendToDiscord = async (content, ...infos) => {

    let message = infos.join('\n');
    let embed = new Discord.MessageEmbed().setTitle(message).toJSON();
    console.log(content);
    console.log(message);
    let webhook = process.env.DISCORD_WEBHOOK;
    if (webhook == undefined) return;

    return new Promise((resolve, reject) => {
        request.post(`${webhook}`, {
            proxy: false,
            json: {
                content: content,
                embeds: infos.length ? [embed] : [],
            }
        }, (error, response, body) => {
            if (error) {
                reject(error);
            } else if (body) {
                reject(body);
            } else {
                resolve(response);
            }
        });
    }).catch((error) => {
        console.log(error);
    });
};
