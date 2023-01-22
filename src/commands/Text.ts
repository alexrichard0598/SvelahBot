import { Discord, Slash } from "discordx";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import { log } from "../logging";
import { SharedMethods } from "./SharedMethods";
import * as fs from 'fs';
import { KnownUser } from "../model/KnownUsers";

@Discord()
export abstract class Text {
  @Slash({ name: "hello", description: "A hello world message" })
  async hello(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Hello world!").catch((error) => {
      SharedMethods.handleError(error, interaction.guild);
    });
  }

  @Slash({ name: "heya", description: "Replies to the user" })
  async heya(interaction: CommandInteraction): Promise<void> {
    try {
      interaction.reply("Heya " + interaction.user.username)

      const data = fs.readFileSync('./src/data/known_users.json', { encoding: 'utf-8' });
      const knownUsers: Array<KnownUser> = await JSON.parse(data).known_users;

      const knownUser = knownUsers.find(u => u.userId == interaction.user.id);

      if (knownUser != undefined) {
        let msg = new EmbedBuilder();
        let info = Object.create({ name: "🤖User Recognized🤖", value: `${knownUser.message}` });

        msg.addFields(info);
        interaction.followUp({ embeds: [msg] }).catch((error) => {
          SharedMethods.handleError(error, interaction.guild);
        });
      }
    } catch (error) {
      SharedMethods.handleError(error, interaction.guild);
    }
  }

  @Slash({ name: "clear-messages", description: "Clears all messages from a bot in the text channel" })
  async clear(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();
      const server = await SharedMethods.getServer(interaction.guild);
      server.setLastChannel(interaction.channel);
      const deleting = await interaction.fetchReply();
      const messages = await SharedMethods.retrieveBotMessages(interaction.channel, [deleting.id]);

      SharedMethods.clearMessages(messages, interaction);
    } catch (error) {
      SharedMethods.handleError(error, interaction.guild);
    }
  }

  // // @Slash({name: "test-error",  description: "Throws a test error" })
  // // async testError(interaction: CommandInteraction) {
  // //   try {
  // //     await interaction.deferReply();
  // //     const server = await SharedMethods.getServer(interaction.guild);
  // //     server.setLastChannel(interaction.channel);
  // //     throw new Error("This is a test error");
  // //   } catch (error) {
  // //     SharedMethods.handleError(error, interaction.guild);
  // //   }
  // // }
}
