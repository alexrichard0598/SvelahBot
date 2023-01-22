import { Discord, Slash } from "discordx";
import { CommandInteraction, EmbedBuilder } from "discord.js";
import * as fs from "fs";
import * as path from "path";

@Discord()
export abstract class Help {
  @Slash({name: "help", description: "A help message" })
  async help(interaction: CommandInteraction): Promise<void> {
    const helpFile = path.join(__dirname, "..", "..", "help.txt");
    const helpText = fs.existsSync(helpFile)
      ? fs.readFileSync(helpFile, "utf-8")
      : "Help me!";

    let embed = new EmbedBuilder();

    embed.setTitle("Help Text").setDescription(helpText);

    interaction.reply({ embeds: [embed] });
  }
}
