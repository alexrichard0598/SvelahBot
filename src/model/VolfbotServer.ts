import { AudioPlayer, AudioPlayerState, AudioPlayerStatus, createAudioResource, DiscordGatewayAdapterCreator, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { CommandInteraction, Guild, Message, EmbedBuilder, VoiceBasedChannel, channelMention, Snowflake, GuildTextBasedChannel } from "discord.js";
import { MediaQueue } from "./MediaQueue";
import { ServerMessages } from "./Messages";
import * as fs from 'fs';
import { PlayableResource } from "./PlayableResource";
import { log } from "../logging";
import { DiscordServer, DiscordServerManager, IDiscordServer } from "../database/DiscordServer";
import { MessageHandling } from "../functions/MessageHandling";
import { BotStatus } from "./BotStatus";
import { getClient } from "../app";

export class VolfbotServer {
  guild: Guild;
  queue: MediaQueue;
  audioPlayer: AudioPlayer;
  lastChannel: GuildTextBasedChannel;
  lastVC: VoiceBasedChannel;
  messages: ServerMessages;
  id: Snowflake;
  private static servers: VolfbotServer[] = new Array<VolfbotServer>();
  private playingSystemSound = false;
  private disconnectTimer: NodeJS.Timeout;
  private nowPlayingClock: NodeJS.Timer;

  constructor(guild: Guild) {
    this.guild = guild;
    this.queue = new MediaQueue(this);
    this.messages = new ServerMessages();
    this.id = guild ? guild.id : undefined;
    this.audioPlayer = new AudioPlayer();

    this.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
      this.PlayerIdle();
    });

    this.audioPlayer.on(AudioPlayerStatus.Playing, async (oldState: AudioPlayerState) => {
      this.PlayerPlaying(oldState);
    });

    this.ServerInit();
  }

  public static async GetServerFromGuild(guild: Guild) {
    try {
      const foundServer = this.servers.find((s) => s.guild.id == guild.id);
      if (foundServer === undefined) {
        let newServer = new VolfbotServer(guild);
        this.servers.push(newServer);
        return newServer;
      }
      return foundServer;
    } catch (error) {
      MessageHandling.LogError("GetServerFromGuild", error, guild);
    }
  }

  public GetStatus(): BotStatus {
    try {
      if (this.audioPlayer.state.status == AudioPlayerStatus.Playing) {
        return BotStatus.PlayingMusic;
      } else if (getVoiceConnection(this.guild.id) !== undefined) {
        return BotStatus.InVC;
      } else {
        return BotStatus.Idle;
      }
    } catch (error) {
      MessageHandling.LogError("GetStatus", error, this);
    }
  }

  public async GetCurrentVC(): Promise<VoiceBasedChannel | null> {
    try {
      const botId = getClient().user.id;
      const bot = await this.guild.members.fetch(botId);
      const voiceConnection = getVoiceConnection(this.guild.id);
      const currentVC = voiceConnection !== undefined ? bot.voice.channel : null;

      if (currentVC) {
        if (this.lastVC.id !== currentVC.id) {
          this.SetLastVC(currentVC);
        }
      }

      return currentVC;
    } catch (error) {
      MessageHandling.LogError("GetCurrentVC", error, this);
    }
  }

  public async PlaySong(media: PlayableResource) {
    try {
      let resource = await media.GetResource();
      this.audioPlayer.play(resource);
      if (this.nowPlayingClock === undefined || this.nowPlayingClock === null) {
        this.SetNowPlayingClock();
      }
    } catch (error) {
      MessageHandling.LogError("PlaySong", error, this);
    }
  }

  public UpdateStatusMessage(newMsg: Message) {
    try {
      if (newMsg !== null) {
        const oldMsg = this.messages.status;

        MessageHandling.MessageExist(oldMsg).then(exists => {
          if (exists) {
            oldMsg.fetch().then((msg => {
              if (msg != null) {
                if (msg.deletable) msg.delete();
              }
            }))
          }
        });
      }

      this.messages.status = newMsg;
    } catch (error) {
      MessageHandling.LogError("UpdateStatusMessage", error, this);
    }
  }

  public UpdateNowPlayingMessage(newMsg: Message) {
    try {
      if (newMsg !== null) {
        const oldMsg = this.messages.nowPlaying;

        MessageHandling.MessageExist(oldMsg).then(exists => {
          if (exists) {
            oldMsg.fetch().then((msg => {
              if (msg != null) {
                if (msg.deletable) msg.delete();
              }
            }))
          }
        });

        this.messages.nowPlaying = newMsg;
      }
    } catch (error) {
      MessageHandling.LogError("UpdateNowPlayingMessage", error, this);
    }
  }

  public UpdateQueueMessage(newMsg: Message) {
    try {
      if (newMsg !== null) {
        const oldMsg = this.messages.queue;

        MessageHandling.MessageExist(oldMsg).then(exists => {
          if (exists) {
            oldMsg.fetch().then((msg => {
              if (msg != null) {
                if (msg.deletable) msg.delete();
              }
            }))
          }
        });
      }

      this.messages.queue = newMsg;
    } catch (error) {
      MessageHandling.LogError("UpdateQueueMessage", error, this);
    }


  }

  public async DisconnectBot(excludedMessages: string[] = []) {
    try {
      await this.queue.Clear();
      clearInterval(this.nowPlayingClock);
      this.nowPlayingClock = null;
      clearTimeout(this.disconnectTimer);
      let stream = fs.createReadStream('./src/assets/sounds/volfbot-disconnect.ogg');
      const sound = createAudioResource(stream);
      const connection = getVoiceConnection(this.guild.id);

      if (connection) {
        if (!this.audioPlayer.playable.includes(connection)) {
          connection.subscribe(this.audioPlayer);
        }

        this.audioPlayer.on("stateChange", (_oldState, newState) => {
          if (newState.status == AudioPlayerStatus.Idle
            && connection.state.status !== VoiceConnectionStatus.Disconnected
            && connection.state.status !== VoiceConnectionStatus.Destroyed) {
            connection.disconnect();
            connection.destroy();
          }
        });

        const deleting = await this.lastChannel.send("Cleaning up after disconnect");
        this.playingSystemSound = true;
        let playableResource = new PlayableResource(this);
        this.PlaySong(await playableResource.SetResource(sound));

        if (this.lastChannel) {
          MessageHandling.ClearMessages(await MessageHandling.RetrieveBotMessages(this.lastChannel, excludedMessages.concat(deleting.id)));
        }
      }
    } catch (error) {
      MessageHandling.LogError("DisconnectBot", error, this);
    }
  }

  public async ConnectBot(interaction: CommandInteraction): Promise<EmbedBuilder> {
    try {
      this.SetLastChannel(interaction.channel);
      const guildMember = await this.guild.members.fetch(
        interaction.user
      );
      const embed = new EmbedBuilder().setDescription("Failed to connect bot");
      const vc: VoiceBasedChannel = guildMember.voice.channel;
      const audioPlayer = this.audioPlayer;
      const currentBotVC = await this.GetCurrentVC();

      if (currentBotVC === null && vc !== null) {
        joinVoiceChannel({
          channelId: vc.id,
          guildId: vc.guildId,
          adapterCreator: vc.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
        }).subscribe(audioPlayer);
        embed.setDescription(`Joined ${channelMention(vc.id)}`);

        this.SetLastVC(vc);

        let stream = fs.createReadStream('./src/assets/sounds/volfbot-connect.ogg');
        const sound = createAudioResource(stream);
        this.playingSystemSound = true;
        let playableResource = new PlayableResource(this);
        this.PlaySong(await playableResource.SetResource(sound));
      }
      else if (vc === null) {
        embed.setDescription("You are not part of a voice chat, please join a voice chat first.");
      } else if (currentBotVC === vc) {
        embed.setDescription("I'm already in the VC");
      }

      return embed;
    } catch (error) {
      MessageHandling.LogError("ConnectBot", error, this);
    }
  }

  public async SetLastChannel(channel: GuildTextBasedChannel) {
    try {
      let lastVCId = this.lastVC ? this.lastVC.id : null;
      let discordServer = new DiscordServer(this.id, channel.id, lastVCId);
      DiscordServerManager.UpdateServer(discordServer);
      this.lastChannel = channel;
    } catch (error) {
      MessageHandling.LogError("SetLastChannel", error, this);
    }

  }

  public async SetLastVC(channel: VoiceBasedChannel) {
    try {
      let lastChannelId = this.lastChannel ? this.lastChannel.id : null;
      let discordServer = new DiscordServer(this.id, lastChannelId, channel.id);
      DiscordServerManager.UpdateServer(discordServer);
      this.lastVC = channel;
    } catch (error) {
      MessageHandling.LogError("SetLastVC", error, this);
    }

  }

  private async ServerInit() {
    let server = await DiscordServerManager.GetServer(this.id);
    if (server == null) {
      let lastChannelId = this.lastChannel ? this.lastChannel.id : null;
      let lastVCId = this.lastVC ? this.lastVC.id : null;
      server = new DiscordServer(this.id, lastChannelId, lastVCId);
      DiscordServerManager.AddServer(server);
    } else {
      this.GetLastChannel(server);
      this.GetLastVC(server);
      this.BotReconnect();
    }
  }

  private async GetLastChannel(server: IDiscordServer) {
    try {
      let lastChannel = server.lastChannelId ? await this.guild.channels.fetch(server.lastChannelId.toString()) : null;
      if (lastChannel && lastChannel.isTextBased()) this.lastChannel = lastChannel;
    } catch (error) {
      if (error.code != 10003) {
        throw error;
      } else {
        log.warn(`Failed to load last channel with id of ${server.lastChannelId} for server id = ${server.id}`);
      }
    }
  }

  private async GetLastVC(server: IDiscordServer) {
    try {
      let lastVC = server.lastVCId ? await this.guild.channels.fetch(server.lastVCId.toString()) : null;
      if (lastVC && lastVC.isVoiceBased()) this.lastVC = lastVC;
    } catch (error) {
      if (error.name != 10003) {
        throw error;
      } else {
        log.warn(`Failed to load last vc with id of ${server.lastVCId} for server id = ${server.id}`);
      }
    }
  }

  private async BotReconnect() {
    let hasMedia = await this.queue.HasMedia();
    if (hasMedia && this.lastVC) {
      if (this.lastVC.members.filter(member => member.id != getClient().user.id).size > 0 && this.lastVC.joinable) {
        joinVoiceChannel({
          channelId: this.lastVC.id,
          guildId: this.lastVC.guildId,
          adapterCreator: this.lastVC.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
        }).subscribe(this.audioPlayer);

        this.queue.ResumePlayback();
      } else {
        this.queue.Clear();
      }
    }
  }

  private async PlayerIdle() {
    try {
      const embed = new EmbedBuilder().setDescription("Failed to switch player to idle");
      let wasPlayingSystemSound = this.playingSystemSound.valueOf();

      if (this.playingSystemSound) {
        this.playingSystemSound = false;
      } else {
        await this.queue.Dequeue();
      }

      if (await this.queue.HasMedia()) {
        const currentItem = await this.queue.CurrentItem();
        if (currentItem) {
          this.PlaySong(currentItem);
        }
      } else {
        if (!wasPlayingSystemSound) {
          embed.setDescription("Reached end of queue, stopped playing");
          this.UpdateNowPlayingMessage(await this.lastChannel.send({ embeds: [embed] }));
        }
        clearInterval(this.nowPlayingClock);
        this.nowPlayingClock = null;
        this.AutoDisconnect();
      }
    } catch (error) {
      MessageHandling.LogError("PlayerIdle", error, this);
    }

  }

  private async PlayerPlaying(oldState: AudioPlayerState) {
    try {
      if (oldState.status == AudioPlayerStatus.Playing || this.playingSystemSound) return;
      if (this.messages.nowPlaying === undefined) {
        const embed = await MessageHandling.NowPlayingEmbed(this);
        this.CreateNowPlayingMessage(embed);
      }
      this.SetNowPlayingClock();
    } catch (error) {
      MessageHandling.LogError("PlayerPlaying", error, this);
    }
  }

  private async AutoDisconnect() {
    clearTimeout(this.disconnectTimer);
    this.disconnectTimer = setTimeout(async () => {
      const currentVC = await this.GetCurrentVC();
      if (
        currentVC !== null
        && !(await this.queue.HasMedia())
        && this.audioPlayer.state.status == AudioPlayerStatus.Idle
      ) {
        this.DisconnectBot();
        this.lastChannel.send({ embeds: [new EmbedBuilder().setDescription("Automatically disconnected due to 5 minutes of inactivity")] });
      } else {
        clearTimeout(this.disconnectTimer);
      }
    }, 5 * 60 * 1000);
  }

  private async SetNowPlayingClock() {
    this.UpdateNowPlayingStatus().then(() => {
      if (this.nowPlayingClock !== undefined) {
        clearInterval(this.nowPlayingClock);
        this.nowPlayingClock = null;
      }

      this.nowPlayingClock = setInterval(async () => this.UpdateNowPlayingStatus(), 5000); // Discord Rate Limits mean it is better to limit this to prevent API banning
    });
  }

  private async UpdateNowPlayingStatus() {
    const embed = await MessageHandling.NowPlayingEmbed(this);
    try {
      let MessageExists = await MessageHandling.MessageExist(this.messages.nowPlaying);
      if (MessageExists) {
        const nowPlayingMessage = await this.messages.nowPlaying.fetch();
        if (nowPlayingMessage.editable) {
          this.messages.nowPlaying = await nowPlayingMessage.edit({ embeds: [embed] });
        } else {
          this.CreateNowPlayingMessage(embed, nowPlayingMessage);
        }
      } else {
        this.CreateNowPlayingMessage(embed);
      }
    } catch (error) {
      MessageHandling.LogError("UpdateNowPlayingStatus", error, this);
    }
  }

  private async CreateNowPlayingMessage(embed: EmbedBuilder, nowPlayingMessage?: Message) {
    try {
      if (embed === undefined) {
        embed = new EmbedBuilder().setDescription("Not currently playing a song");
      }

      if (nowPlayingMessage instanceof Message && nowPlayingMessage.deletable) {
        this.UpdateNowPlayingMessage(await this.lastChannel.send({ embeds: [embed] }))
      } else {
        this.messages.nowPlaying = await this.lastChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      MessageHandling.LogError("CreateNowPlayingMessage", error, this);
    }
  }
}
