import { Discord, Slash } from "discordx";
import { CommandInteraction, Message } from "discord.js";
import { log } from "../logging";
import { MessageEmbed } from "discordx/node_modules/discord.js";
import * as fs from "fs";
import * as path from "path";

@Discord()
export abstract class help {
  @Slash("help", { description: "A help message" })
  async help(interaction: CommandInteraction): Promise<void> {
    const helpfile = path.join(__dirname, "..", "..", "help.txt");
    log.debug(helpfile);
    log.debug(fs.existsSync(helpfile));
    const helptext = fs.existsSync(helpfile)
      ? fs.readFileSync(helpfile, "utf-8")
      : "Help me!";

    var embed = new MessageEmbed();

    embed.addFields([{ name: "Help Message", value: helptext }]);

    interaction.reply({ embeds: [embed] });
  }
}
