import { Discord, Slash } from "discordx";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import * as fs from "fs";
import * as path from "path";

@Discord()
export abstract class Help {
  @Slash({name: "help", description: "A help message" })
  async help(interaction: CommandInteraction): Promise<void> {
    const helpfile = path.join(__dirname, "..", "..", "help.txt");
    const helptext = fs.existsSync(helpfile)
      ? fs.readFileSync(helpfile, "utf-8")
      : "Help me!";

    let embed = new EmbedBuilder();

    embed.setTitle("Help Text").setDescription(helptext);

    interaction.reply({ embeds: [embed] });
  }
}
