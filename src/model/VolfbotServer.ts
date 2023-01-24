import { AudioPlayer, AudioPlayerState, AudioPlayerStatus, createAudioResource, DiscordGatewayAdapterCreator, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { CommandInteraction, Guild, Message, EmbedBuilder, TextBasedChannel, VoiceBasedChannel, channelMention } from "discord.js";
import { SharedMethods } from "../commands/SharedMethods";
import { MediaQueue } from "./MediaQueue";
import { Messages } from "./Messages";
import * as fs from 'fs';
import { PlayableResource } from "./PlayableResource";
import { log } from "../logging";
import { DiscordServer, DiscordServerManager, IDiscordServer } from "../database/DiscordServer";

export class VolfbotServer {
  guild: Guild;
  queue: MediaQueue;
  audioPlayer: AudioPlayer;
  lastChannel: TextBasedChannel;
  lastVC: VoiceBasedChannel;
  messages: Messages;
  id: string;
  private playingSystemSound = false;
  private disconnectTimer: NodeJS.Timeout;
  private nowPlayingClock: NodeJS.Timer;

  constructor(guild: Guild) {
    this.guild = guild;
    this.queue = new MediaQueue(this);
    this.messages = new Messages();
    this.id = guild ? guild.id : undefined;
    this.audioPlayer = new AudioPlayer();

    this.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
      this.playerIdle();
    });

    this.audioPlayer.on(AudioPlayerStatus.Playing, async (oldState: AudioPlayerState) => {
      this.playerPlaying(oldState);
    });

    this.serverInit();
  }

  async playSong(media: PlayableResource) {
    try {
      let resource = await media.getResource();
      this.audioPlayer.play(resource);
      if (!this.nowPlayingClock) {
        this.setNowPlayingClock();
      }
    } catch (error) {
      SharedMethods.handleError(error, this.guild);
    }
  }

  async updateStatusMessage(msg: Message) {
    try {
      if (this.messages.status != undefined && SharedMethods.messageExist(msg)) {
        const status: Message = await this.messages.status.fetch();
        if (status != null) {
          if (status.deletable) status.delete();
        }
      }

      this.messages.status = msg;
    } catch (error) {
      SharedMethods.handleError(error, this.guild);
    }
  }

  async updateNowPlayingMessage(msg: Message) {
    try {
      if (this.messages.nowPlaying != undefined && SharedMethods.messageExist(msg)) {
        const nowPlaying: Message = await this.messages.nowPlaying.fetch();
        if (nowPlaying != null) {
          if (nowPlaying.deletable) nowPlaying.delete();
        }
      }
      this.messages.nowPlaying = msg;
    } catch (error) {
      log.warn(`Failed to delete now playing message on server with id of ${this.guild.id}`);
    }
  }

  async updateQueueMessage(msg: Message) {
    try {
      if (this.messages.queue != undefined && SharedMethods.messageExist(msg)) {
        const queue: Message = await this.messages.queue.fetch();
        if (queue != null) {
          if (queue.deletable) queue.delete();
        }
      }
      this.messages.queue = msg;
    } catch (error) {
      log.warn(`Failed to delete queue message on server with id of ${this.guild.id}`);
    }
  }

  async disconnectBot(excludedMessages: string[] = []) {
    try {
      this.queue.clear();
      clearInterval(this.nowPlayingClock);
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
        this.playSong(await playableResource.setResource(sound));

        if (this.lastChannel) {
          SharedMethods.clearMessages(await SharedMethods.retrieveBotMessages(this.lastChannel, excludedMessages.concat(deleting.id)));
        }
      }
    } catch (error) {
      SharedMethods.handleError(error, this.guild);
    }
  }

  async connectBot(interaction: CommandInteraction): Promise<EmbedBuilder> {
    try {
      this.setLastChannel(interaction.channel);
      const guildMember = await this.guild.members.fetch(
        interaction.user
      );
      const embed = new EmbedBuilder;
      const vc: VoiceBasedChannel = guildMember.voice.channel;
      const audioPlayer = this.audioPlayer;

      if (vc === null) {
        embed.setDescription("You are not part of a voice chat, please join a voice chat first.");
      } else {
        joinVoiceChannel({
          channelId: vc.id,
          guildId: vc.guildId,
          adapterCreator: vc.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
        }).subscribe(audioPlayer);
        embed.setDescription(`Joined ${channelMention(vc.id)}`);

        this.setLastVC(vc);
      }

      let stream = fs.createReadStream('./src/assets/sounds/volfbot-connect.ogg');
      const sound = createAudioResource(stream);
      this.playingSystemSound = true;
      let playableResource = new PlayableResource(this);
      this.playSong(await playableResource.setResource(sound));
      return embed;
    } catch (error) {
      SharedMethods.handleError(error, this.guild);
    }
  }

  async setLastChannel(channel: TextBasedChannel) {
    try {
      let lastVCId = this.lastVC ? this.lastVC.id : null;
      let discordServer = new DiscordServer(this.id, channel.id, lastVCId);
      DiscordServerManager.updateServer(discordServer);
      this.lastChannel = channel;
    } catch (error) {
      SharedMethods.handleError(error, this.guild);
    }

  }

  async setLastVC(channel: VoiceBasedChannel) {
    try {
      let lastChannelId = this.lastChannel ? this.lastChannel.id : null;
      let discordServer = new DiscordServer(this.id, lastChannelId, channel.id);
      DiscordServerManager.updateServer(discordServer);
      this.lastVC = channel;
    } catch (error) {
      SharedMethods.handleError(error, this.guild);
    }

  }

  private async serverInit() {
    let server = await DiscordServerManager.getServer(this.id);
    if (server == null) {
      let lastChannelId = this.lastChannel ? this.lastChannel.id : null;
      let lastVCId = this.lastVC ? this.lastVC.id : null;
      server = new DiscordServer(this.id, lastChannelId, lastVCId);
      DiscordServerManager.addServer(server);
    } else {
      this.getLastChannel(server);
      this.getLastVC(server);
      this.botReconnect();
    }
  }

  private async getLastChannel(server: IDiscordServer) {
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

  private async getLastVC(server: IDiscordServer) {
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

  private async botReconnect() {
    let hasMedia = await this.queue.hasMedia();
    if (hasMedia && this.lastVC) {
      if (this.lastVC.members.filter(member => member.id != '698214544560095362').size > 0 && this.lastVC.joinable) {
        joinVoiceChannel({
          channelId: this.lastVC.id,
          guildId: this.lastVC.guildId,
          adapterCreator: this.lastVC.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator,
        }).subscribe(this.audioPlayer);

        this.queue.resumePlayback();
      } else {
        this.queue.clear();
      }
    }
  }

  private async playerIdle() {
    try {
      const embed = new EmbedBuilder();
      let wasPlayingSystemSound = this.playingSystemSound.valueOf();

      if (this.playingSystemSound) {
        this.playingSystemSound = false;
      } else {
        await this.queue.dequeue();
      }

      if (await this.queue.hasMedia()) {
        const currentItem = await this.queue.currentItem();
        if (currentItem) {
          this.playSong(currentItem);
        }
      } else {
        if (!wasPlayingSystemSound) embed.setDescription("Reached end of queue, stopped playing");
        clearInterval(this.nowPlayingClock);
        this.autoDisconnect();
      }

      if (typeof (embed.data.description) === "string") {
        this.updateNowPlayingMessage(await this.lastChannel.send({ embeds: [embed] }));
      }
    } catch (error) {
      SharedMethods.handleError(error, this.guild);
    }

  }

  private async playerPlaying(oldState: AudioPlayerState) {
    try {
      if (oldState.status == AudioPlayerStatus.Playing || this.playingSystemSound) return;
      if (this.messages.nowPlaying === undefined) {
        const embed = await SharedMethods.nowPlayingEmbed(this);
        this.createNowPlayingMessage(embed);
      }
      this.setNowPlayingClock();
    } catch (error) {
      SharedMethods.handleError(error, this.guild);
    }
  }

  private async autoDisconnect() {
    clearTimeout(this.disconnectTimer);
    this.disconnectTimer = setTimeout(() => {
      if (getVoiceConnection(this.guild.id) != undefined && !this.queue.hasMedia() && this.audioPlayer.state.status == AudioPlayerStatus.Idle) {
        this.disconnectBot();
        this.lastChannel.send({ embeds: [new EmbedBuilder().setDescription("Automatically disconnected due to 5 minutes of inactivity")] });
      } else {
        clearTimeout(this.disconnectTimer);
      }
    }, 300000);
  }

  private async setNowPlayingClock() {
    this.updateNowPlayingStatus()

    if (this.nowPlayingClock !== undefined) {
      clearInterval(this.nowPlayingClock);
    }
    this.nowPlayingClock = setInterval(async () => this.updateNowPlayingStatus(), 5000); // Discord Rate Limits mean it is better to limit this to prevent API banning
  }

  private async updateNowPlayingStatus() {
    const embed = await SharedMethods.nowPlayingEmbed(this);
    try {
      if (this.messages.nowPlaying && SharedMethods.messageExist(this.messages.nowPlaying)) {
        const nowPlayingMessage = await this.messages.nowPlaying.fetch();
        if (nowPlayingMessage.editable) {
          this.messages.nowPlaying = await nowPlayingMessage.edit({ embeds: [embed] });
        } else {
          this.createNowPlayingMessage(embed, nowPlayingMessage);
        }
      }
    } catch (error) {
      SharedMethods.handleError(error, this.guild);
    }
  }

  private async createNowPlayingMessage(embed: EmbedBuilder, nowPlayingMessage?: Message) {
    if (nowPlayingMessage instanceof Message && nowPlayingMessage.deletable) {
      this.updateNowPlayingMessage(await this.lastChannel.send({ embeds: [embed] }))
    } else {
      this.messages.nowPlaying = await this.lastChannel.send({ embeds: [embed] });
    }
  }
}
