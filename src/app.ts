import { Client } from "@typeit/discord";
import { Intents } from "discord.js";
import { config as configDotenv } from "dotenv";
import * as fs from "fs";
import { resolve } from "path/posix";

const configPath = 'config.json';

async function start() {
    const client = new Client({
        classes: [
            `${__dirname}/discords/*.ts`, // glob string to load the classes
            `${__dirname}/discords/*.js` // If you compile using "tsc" the file extension change to .js
        ],
        silent: false,
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_VOICE_STATES,
            Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
            Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
            Intents.FLAGS.DIRECT_MESSAGES,
            Intents.FLAGS.DIRECT_MESSAGE_TYPING,
            Intents.FLAGS.GUILD_INTEGRATIONS,
            Intents.FLAGS.GUILD_PRESENCES,
            Intents.FLAGS.GUILD_WEBHOOKS,
            Intents.FLAGS.GUILD_MEMBERS,
            Intents.FLAGS.GUILD_INVITES,
            Intents.FLAGS.GUILD_BANS,
        ]
    });

    client.once("ready", async () => {
        await client.initSlashes();
    });

    client.on("interaction", (interaction) => {
        client.executeSlash(interaction);
    });

    configDotenv({
        path: resolve(__dirname, "../env/env.variables"),
    });

    await client.login(process.env.TOKEN);
}

start();