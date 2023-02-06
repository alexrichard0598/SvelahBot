import { AudioPlayerStatus } from "@discordjs/voice";
import { CommandInteraction, EmbedBuilder, Guild, Message, Snowflake, GuildTextBasedChannel, TextChannel, channelMention, userMention } from "discord.js";
import { Metadata } from "../model/Metadata";
import { PlayableResource } from "../model/PlayableResource";
import { VolfbotServer } from "../model/VolfbotServer";
import { getClient } from "../app";
import { log } from "../logging";
import { DiscordError, ErrorManager } from "../database/Errors";

export abstract class MessageHandling {
  public static async RetrieveBotMessages(channel: GuildTextBasedChannel, exclude: string[] = []): Promise<Array<Message>> {
    try {
      let messages = new Array<Message>();
      (await channel.messages.fetch({ limit: 100, cache: false })).forEach(msg => {
        let oldestMsg = new Date();
        oldestMsg.setDate(oldestMsg.getDate() - 13);
        if (msg.author.id == getClient().user.id && !exclude.includes(msg.id) && msg.createdAt > oldestMsg) {
          messages.push(msg);
        }
      });
      return messages;
    } catch (error) {
      this.LogError("RetrieveBotMessages", error, channel.guild)
    }
  }

  public static async ClearMessages(messages: Array<Message>, interaction?: CommandInteraction) {
    const server = messages.length > 0 ? await VolfbotServer.GetServerFromGuild(messages[0].guild) : undefined;
    try {
      let embed: EmbedBuilder;
      if (messages.length > 0) {
        if (server.lastChannel instanceof TextChannel) {
          server.lastChannel.bulkDelete(messages);
          embed = new EmbedBuilder().setDescription("Messages deleted");
        } else {
          embed = new EmbedBuilder().setDescription("Cannot delete messages");
        }
      } else {
        embed = new EmbedBuilder().setDescription("No messages to delete");
      }

      if (interaction) {
        interaction.editReply({ embeds: [embed] });
      } else if (server) {
        server.lastChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      this.LogError("clearMessages", error, server)
    }
  }

  public static async LogError(caller: string, error: Error, guild?: Guild | VolfbotServer) {
    let lastError = await ErrorManager.getLastError();
    let currentDate = new Date();
    if (lastError == null || currentDate.getTime() - lastError.errorTime.getTime() > 30000) {
      const embed = new EmbedBuilder();
      embed.setTitle("Error!");
      embed.setDescription(`${error.message}\r\n\`\`\`${error.stack}\`\`\`\r\n**The developer has been notified**`);
      if (guild) {
        let server: VolfbotServer;
        if (guild instanceof VolfbotServer) {
          server = guild;
        } else {
          server = await VolfbotServer.GetServerFromGuild(guild);
        }

        if (server.lastChannel !== undefined) server.lastChannel.send({ embeds: [embed] });
      }

      log.error(error);
      const botDevChannel = (await (await getClient().guilds.fetch('664999986974687242')).channels.fetch('888174462011342848')) as GuildTextBasedChannel;
      botDevChannel.send({ embeds: [embed], content: userMention('134131441175887872') + " An error has occurred in " + caller });

      let newError = new DiscordError(currentDate, error.message + ' ' + error.stack);
      ErrorManager.addError(newError);
    }
  }

  public static async MessageExist(message: Message | Snowflake, channel?: GuildTextBasedChannel): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        if (message instanceof Message) {
          message.fetch();
        } else if (channel !== null && channel !== undefined && channel.isTextBased) {
          channel.messages.fetch(message);
        } else {
          resolve(false);
        }

        resolve(true);
      } catch (error) {
        if (error.code != 10008) {
          reject(error);
        } else {
          resolve(false);
        }
      }
    });
  }

  public static async InitCommand({ interaction, isStatusMessage: isStatusMessage, isQueueMessage: isQueueMessage, isNowPlayingMessage: isNowPlayingMessage }: InitCommandParams): Promise<VolfbotServer> {
    try {
      if (!interaction.deferred) {
        const reply = await interaction.deferReply({ fetchReply: true });
        const server = await VolfbotServer.GetServerFromGuild(interaction.guild);
        if (isStatusMessage) server.UpdateStatusMessage(reply);
        if (isQueueMessage) server.UpdateQueueMessage(reply);
        if (isNowPlayingMessage) server.UpdateNowPlayingMessage(reply);
        server.SetLastChannel(interaction.channel);
        return server;
      } else {
        return VolfbotServer.GetServerFromGuild(interaction.guild);
      }
    } catch (error) {
      MessageHandling.LogError("InitCommand", error, interaction.guild);
    }
  }

  public static async NowPlayingEmbed(server: VolfbotServer): Promise<EmbedBuilder> {
    try {
      const nowPlaying: PlayableResource = await server.queue.CurrentItem();
      const currentVC = await server.GetCurrentVC();
      if (!currentVC) return;
      let embed: EmbedBuilder = new EmbedBuilder().setTitle("Now Playing").setDescription("Nothing.");
      let nowPlayingTitle = `Now Playing`;
      let nowPlayingDescription = `Playing in ${channelMention(currentVC.id)}\r\n\r\n`;

      if (server.audioPlayer.state.status === AudioPlayerStatus.Playing && nowPlaying !== undefined) {
        const metadata: Metadata = nowPlaying.meta;
        const length = metadata.length;
        let lengthString = this.GetTimestamp(length);
        let maxUnit: TimeUnit = TimeUnit.second;

        if (lengthString.split(":").length > 2) {
          maxUnit = TimeUnit.hour;
        } else if (lengthString.split(":").length > 1) {
          maxUnit = TimeUnit.minute;
        }

        let playbackDuration = server.audioPlayer.state.playbackDuration;
        let playbackString = this.GetTimestamp(playbackDuration, maxUnit);

        const percentPlayed: number = Math.ceil((playbackDuration / length) * 100);
        let msg = `[${metadata.title}](${nowPlaying.url}) [${userMention(metadata.queuedBy)}]\n\n`;
        for (let i = 0; i < 33; i++) {
          if (percentPlayed / 3 >= i) {
            msg += '█';
          } else {
            msg += '░';
          }
        }
        msg += ` [${playbackString}/${lengthString}]`;
        embed = new EmbedBuilder().setTitle(nowPlayingTitle).setDescription(nowPlayingDescription + msg);
      }


      return embed;
    } catch (error) {
      this.LogError("nowPlayingEmbed", error, server);
    }
  }

  public static GetTimestamp(durationMs: number, largestUnit?: TimeUnit): string {
    let timestamp = "";
    let durationSec = durationMs / 1000;
    let hours = Math.floor(durationSec / 3600);
    let minutes = Math.floor(durationSec % 3600 / 60);
    let seconds = Math.floor(durationSec % 3600 % 60);
    if (hours > 0 || largestUnit == TimeUnit.hour) {
      timestamp = `${hours}:${('0' + minutes).slice(-2)}:${('0' + seconds).slice(-2)}`;
    } else if (minutes > 0 || largestUnit == TimeUnit.minute) {
      timestamp = `${minutes}:${('0' + seconds).slice(-2)}`;
    } else {
      timestamp = `${seconds}`;
    }

    return timestamp;
  }
}

export enum TimeUnit {
  hour,
  minute,
  second
}

export interface InitCommandParams {
  interaction: CommandInteraction;
  isStatusMessage?: boolean;
  isQueueMessage?: boolean;
  isNowPlayingMessage?: boolean;
}