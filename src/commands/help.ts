import { Discord, Slash } from "discordx";
import { CommandInteraction, MessageEmbed } from "discord.js";
import { log } from "../logging";
import * as fs from "fs";
import * as path from "path";

@Discord()
export abstract class Help {
  @Slash("help", { description: "A help message" })
  async help(interaction: CommandInteraction): Promise<void> {
    const helpfile = path.join(__dirname, "..", "..", "help.txt");
    log.debug(helpfile);
    log.debug(fs.existsSync(helpfile));
    const helptext = fs.existsSync(helpfile)
      ? fs.readFileSync(helpfile, "utf-8")
      : "Help me!";

    var embed = new MessageEmbed();

    embed.setTitle("Help Text").setDescription(helptext);

    interaction.reply({ embeds: [embed] });
  }
}
