import { Discord, Slash } from "discordx";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import * as fs from 'fs';
import { KnownUser } from "../model/KnownUsers";
import { MessageHandling } from "../functions/MessageHandling";
import { VolfbotServer } from "../model/VolfbotServer";

@Discord()
export abstract class Text {
  @Slash({ name: "hello", description: "A hello world message" })
  public async Hello(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Hello world!").catch((error) => {
      MessageHandling.LogError("Hello", error, interaction.guild);
    });
  }

  @Slash({ name: "heya", description: "Replies to the user" })
  public async Heya(interaction: CommandInteraction): Promise<void> {
    try {
      interaction.reply("Heya " + interaction.user.username)

      const data = fs.readFileSync('./src/data/known_users.json', { encoding: 'utf-8' });
      const knownUsers: Array<KnownUser> = await JSON.parse(data).known_users;

      const knownUser = knownUsers.find(u => u.userId == interaction.user.id);

      if (knownUser != undefined) {
        let msg = new EmbedBuilder().setDescription("Failed to recognize user");
        let info = Object.create({ name: "🤖User Recognized🤖", value: `${knownUser.message}` });

        msg.addFields(info);
        interaction.followUp({ embeds: [msg] });
      }
    } catch (error) {
      MessageHandling.LogError("Heya", error, interaction.guild);
    }
  }

  @Slash({name: "test-error",  description: "Throws a test error" })
  async TestError(interaction: CommandInteraction) {
    try {
      await interaction.deferReply();
      const server = await VolfbotServer.GetServerFromGuild(interaction.guild);
      server.SetLastChannel(interaction.channel);
      throw new Error("This is a test error");
    } catch (error) {
      MessageHandling.LogError("TestError", error, interaction.guild);
    }
  }
}
