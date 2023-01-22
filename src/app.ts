import { importx } from "@discordx/importer";
import { Client } from "discordx";
import { config as configDotenv } from "dotenv";
import { resolve } from "path/posix";
import { log } from "./logging";
import { ActivityType, Events, GatewayIntentBits, Guild, Interaction, Partials } from "discord.js";
import { SharedMethods } from "./commands/SharedMethods";

let client: Client;

async function start() {
  try {
    await importx(`${__dirname}/{commands,model,guards}/*.{ts,js}`);

    configDotenv({
      path: resolve(__dirname, "../env/env.variables"),
    });

    client = new Client({
      silent: false,
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
      ],
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildBans,
      ],
      botGuilds: process.env.DEV == "true" ? ["664999986974687242"] : undefined,
      presence: process.env.DEV == "true" ? { status: "dnd", activities: [{ name: "Bot is underdevelopment", type: ActivityType.Listening }] } : { status: "online", activities: [{ name: "music", type: ActivityType.Listening }] },
    });

    if (process.env.DEV == "true") {
      log.info("Developer Mode");
    } else {
      log.info("Live");
    }

    client.once("ready", async () => {
      await client.initApplicationCommands();
    });

    client.on("interactionCreate", async (interaction: Interaction) => {
      try {
        client.executeInteraction(interaction);
      } catch (error) {
        log.error(error);
      }
    });

    client.on(Events.MessageReactionAdd, async (reaction, user) => {
      client.executeReaction(reaction, user);
    });

    await client.login(process.env.TOKEN).then(() => {
      log.info("Volfbot Online");
      client.guilds.cache.forEach((guild: Guild) => SharedMethods.getServer(guild));
    });
  } catch (error) {
    log.error(error);
  }
}

export function getClient(): Client {
  return client;
}

start();
