import { Discord, Slash } from "discordx";
import { CommandInteraction, Message, MessageEmbed } from "discord.js";
import { log } from "../logging";
import { SharedMethods }  from "./sharedMethods";
import * as fs from 'fs';
import { KnownUser } from "../model/knownUser";

@Discord()
export abstract class hello_world {
  @Slash("hello", { description: "A hello world message" })
  async hello(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Hello world!").catch((err) => {
      log.error(err);
    });
  }

  @Slash("heya", { description: "Replies to the user" })
  async heya(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Heya " + interaction.user.username).catch((err) => {
      log.error(err);
    });

    const data = fs.readFileSync('./src/data/known_users.json', { encoding: 'utf-8' });
    const knownUsers: Array<KnownUser> = await JSON.parse(data).known_users;
    console.log(knownUsers);

    const knownUser = knownUsers.find( u => u.userId == interaction.user.id);

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
  }

  @Slash("clearmessages", { description: "Clears all messages from a bot in the text channel" })
  async clear(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();
    const deleting = await interaction.fetchReply();
    var messages = new Array<Message>();
    await (await interaction.channel.messages.fetch({ limit: 100 }, { force: true })).forEach(msg => {
      if (msg.author.id == "698214544560095362" && msg.id != deleting.id) {
        messages.push(msg)
      }
    });

    if(deleting instanceof Message) SharedMethods.ClearMessages(messages, deleting, interaction);
  }
}
