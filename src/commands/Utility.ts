import { getVoiceConnection } from "@discordjs/voice";
import { CommandInteraction, VoiceBasedChannel, EmbedBuilder, channelMention } from "discord.js";
import { Discord, Slash } from "discordx";
import { MessageHandling, TimeUnit } from "../functions/MessageHandling";
import { BotStatus } from "../model/BotStatus";
import { VolfbotServer } from "../model/VolfbotServer";
import { getClient } from "../app";

@Discord()
export abstract class Utility {
  @Slash({
    name: "ping",
    description: "Returns the ping of the current voice connection",
  })
  public async Ping(interaction: CommandInteraction): Promise<void> {
    try {
      await MessageHandling.InitCommand({ interaction: interaction, isStatusMessage: true });

      if (getVoiceConnection(interaction.guildId) === undefined) {
        interaction.editReply("I'm not currently in an voice channels");
      } else {
        interaction.editReply(
          "My ping is " +
          getVoiceConnection(interaction.guildId).ping.udp +
          "ms"
        );
      }
    } catch (error) {
      MessageHandling.LogError("Ping", error, interaction.guild);
    }
  }

  @Slash({ name: "status", description: "Returns the current status of the bot" })
  public async Status(interaction: CommandInteraction) {
    try {
      const server = await MessageHandling.InitCommand({ interaction: interaction, isStatusMessage: true });
      let status: BotStatus;
      let vc: VoiceBasedChannel;

      if (server != undefined) {
        status = server.GetStatus();
        vc = await server.GetCurrentVC();
      }

      let msg = "";

      switch (status) {
        case BotStatus.Idle:
          msg = "I'm ready and waiting for your commands";
          break;
        case BotStatus.InVC:
          msg = `I'm sitting in the *${channelMention(vc.id)}* voice chat, and waiting for your commands`
          break;
        case BotStatus.PlayingMusic:
          msg = `I'm currently playing [${(await server.queue.CurrentItem()).meta.title}](${(await server.queue.CurrentItem()).url}) in "${channelMention(vc.id)}"`
          break;
        default:
          msg = "I'm not sure what I'm up to";
          break;
      }

      interaction.editReply({ embeds: [new EmbedBuilder().setDescription(msg).setTitle("Current Status")] });
    } catch (error) {
      MessageHandling.LogError("Status", error, interaction.guild);
    }
  }

  @Slash({ name: "clear-messages", description: "Clears all messages from a bot in the text channel" })
  public async ClearMessages(interaction: CommandInteraction): Promise<void> {
    try {
      await MessageHandling.InitCommand({ interaction: interaction});
      const deleting = await interaction.fetchReply();
      const messages = await MessageHandling.RetrieveBotMessages(interaction.channel, [deleting.id]);

      MessageHandling.ClearMessages(messages, interaction);
    } catch (error) {
      MessageHandling.LogError("Clear", error, interaction.guild);
    }
  }

  @Slash({ name: "uptime", description: "Gives the current uptime of the bot" })
  public async Uptime(interaction: CommandInteraction) {
    try {
      await MessageHandling.InitCommand({ interaction: interaction, isStatusMessage: true });
      const client = getClient();
      const uptime = client.uptime;
      const readyAt = client.readyAt;
      const embed = new EmbedBuilder().setDescription("Unable to retrieve bot uptime");
      let uptimeString = MessageHandling.GetTimestamp(uptime, TimeUnit.hour);
      if (uptimeString.length <= 7) uptimeString = '0' + uptimeString;
      embed.setDescription(`I have currently been online for ${uptimeString} [hh:mm:ss]`);
      embed.setDescription(embed.data.description + "\r\n" + 'I went online on ' + `${readyAt.getUTCFullYear()}-${('0' + (readyAt.getUTCMonth() + 1)).slice(-2)}-${('0' + readyAt.getUTCDay()).slice(-2)}`
        + ` at ${('0' + readyAt.getUTCHours()).slice(-2)}:${('0' + readyAt.getUTCMinutes()).slice(-2)}:${('0' + readyAt.getUTCSeconds()).slice(-2)} UTC`);
      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      MessageHandling.LogError("Clear", error, interaction.guild);
    }
  }
}