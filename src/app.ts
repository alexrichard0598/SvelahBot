import { Client } from "discordx";
import { Intents } from "discord.js";
import { config as configDotenv } from "dotenv";
import * as Path from "path";
import { resolve } from "path/posix";
import { log } from "./logging";
import * as ytDl from 'youtube-dl-wrap';

var client: Client;

async function start() {
  try {
    configDotenv({
      path: resolve(__dirname, "../env/env.variables"),
    });

    client = new Client({
      classes: [
        Path.join(__dirname, "commands", "*.{ts,js}"),
        Path.join(__dirname, "guards", "*.{ts,js}"),
        Path.join(__dirname, "model", "*.{ts,js}"),
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
        Intents.FLAGS.GUILD_WEBHOOKS,
        Intents.FLAGS.GUILD_INVITES,
        Intents.FLAGS.GUILD_BANS,
      ],
      botGuilds: process.env.DEV ? ["664999986974687242"] : undefined,
    });

    client.once("ready", async () => {
      await client.initApplicationCommands();
    });

    client.on("interactionCreate", async (interaction) => {
      try {
        client.executeInteraction(interaction);
      } catch (error) {
        log.error(error);
      }
    });

    await client
      .login(process.env.TOKEN)
      .then(() => log.info("SvelahBot Online"));
  } catch (error) {
    log.error(error);
  }
}

export function getClient(): Client {
  return client;
}

start();
