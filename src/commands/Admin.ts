import { CommandInteraction } from "discord.js";
import { Discord, Slash, Guard } from "discordx";
import { getClient } from "../app";
import { IsAdmin } from "../guards/isAdmin";

@Discord()
export abstract class Voice {
  @Slash({
    name: "shutdown",
    description: "Shutdowns the bot, can only be accessed by bot admins",
  })
  @Guard(IsAdmin)
  async shutdown(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Shutting Down").then(() => {
      getClient().destroy();
    });
  }
}
