import { Discord, Slash } from "discordx";
import { CommandInteraction, MessageEmbed } from "discord.js";
import { log } from "../logging";
import { SharedMethods } from "./sharedMethods";
import * as fs from 'fs';
import { KnownUser } from "../model/knownUser";

@Discord()
export abstract class HelloWorld {
  @Slash("hello", { description: "A hello world message" })
  async hello(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Hello world!").catch((err) => {
      log.error(err);
    });
  }

  @Slash("heya", { description: "Replies to the user" })
  async heya(interaction: CommandInteraction): Promise<void> {
    try {
      interaction.reply("Heya " + interaction.user.username)

      const data = fs.readFileSync('./src/data/known_users.json', { encoding: 'utf-8' });
      const knownUsers: Array<KnownUser> = await JSON.parse(data).known_users;
      console.log(knownUsers);

      const knownUser = knownUsers.find(u => u.userId == interaction.user.id);

      if (knownUser != undefined) {
        var msg = new MessageEmbed();
        msg.addField(
          "🤖User Recognized🤖",
          `${knownUser.message}`
        );
        interaction.followUp({ embeds: [msg] }).catch((err) => {
          log.error(err);
        });
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("clear-messages", { description: "Clears all messages from a bot in the text channel" })
  async clear(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();
      const server = SharedMethods.getServer(interaction.guild);
      (await server).lastChannel = interaction.channel;
      const deleting = await interaction.fetchReply();
      const messages = await SharedMethods.retrieveBotMessages(interaction.channel, [deleting.id]);

      SharedMethods.clearMessages(messages, interaction);
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }
}
