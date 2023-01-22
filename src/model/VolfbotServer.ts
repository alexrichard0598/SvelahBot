import { AudioPlayer, AudioPlayerState, AudioPlayerStatus, createAudioResource, DiscordGatewayAdapterCreator, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { CommandInteraction, Guild, Message, EmbedBuilder, TextBasedChannel, VoiceBasedChannel } from "discord.js";
import { SharedMethods } from "../commands/SharedMethods";
import { MediaQueue } from "./MediaQueue";
import { Messages } from "./Messages";
import * as fs from 'fs';
import { PlayableResource } from "./PlayableResource";
import { Discord, On } from "discordx";

@Discord()
export class VolfbotServer {
  guild: Guild;
  queue: MediaQueue;
  audioPlayer: AudioPlayer;
  lastChannel: TextBasedChannel;
  messages: Messages;
  id: number;
  private playingSystemSound = false;
  private disconnectTimer;
  private nowPlayingClock;

  constructor(guild: Guild) {
    this.guild = guild;
    this.queue = new MediaQueue(this);
    this.messages = new Messages();
    this.id = guild ? Number.parseInt(guild.id) : undefined;
    this.audioPlayer = new AudioPlayer();

    this.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
      this.playerIdle();
    });

    this.audioPlayer.on(AudioPlayerStatus.Playing, async (oldState: AudioPlayerState) => {
      this.playerPlaying(oldState);
    });
  }

  async playSong(media: PlayableResource) {
    let resource = await media.getResource();
    this.audioPlayer.play(resource);
  }

  @On({ event: "messageDelete" })
  async trackDeletedMessages(message) {
    const messageID = message.id;
    if (this.messages.status !== undefined && messageID == this.messages.status.id) {
      this.messages.status = undefined;
    }
    if (this.messages.nowplaying !== undefined && messageID == this.messages.nowplaying.id) {
      this.messages.nowplaying = undefined;
    }
    if (this.messages.queue !== undefined && messageID == this.messages.queue.id) {
      this.messages.queue = undefined;
    }
  }

  async updateStatusMessage(msg) {
    if (msg instanceof Message) msg.fetch();
    if (this.messages.status != undefined) {
      const status: Message = this.messages.status.channel.messages.resolve(this.messages.status.id);
      if (status != null) {
        if (status.deletable) status.delete().catch(err => { SharedMethods.handleErr(err, this.guild) });
      }
    }
    if (msg instanceof Message) this.messages.status = msg;
  }

  async updateNowPlayingMessage(msg) {
    if (this.messages.nowplaying != undefined) {
      const nowplaying: Message = this.messages.nowplaying.channel.messages.resolve(this.messages.status.id);
      if (nowplaying != null) {
        if (nowplaying.deletable) nowplaying.delete().catch(err => { SharedMethods.handleErr(err, this.guild) });
      }
    }

    if (msg instanceof Message) this.messages.nowplaying = msg;
  }

  async updateQueueMessage(msg) {
    if (msg instanceof Message) msg.fetch();
    if (this.messages.queue != undefined) {
      const queue: Message = this.messages.queue.channel.messages.resolve(this.messages.queue.id);
      if (queue != null) {
        if (queue.deletable) queue.delete().catch(err => { SharedMethods.handleErr(err, this.guild) });
      }
    }
    if (msg instanceof Message) this.messages.queue = msg;
  }

  async disconnectBot(excludedMessages: string[] = []) {
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
  }

  async connectBot(interaction: CommandInteraction): Promise<EmbedBuilder> {
    this.lastChannel = interaction.channel;
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
        adapterCreator: vc.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      }).subscribe(audioPlayer);
      embed.setDescription("Joined " + vc.name);
    }

    let stream = fs.createReadStream('./src/assets/sounds/volfbot-connect.ogg');
    const sound = createAudioResource(stream);
    this.playingSystemSound = true;
    let playableResource = new PlayableResource(this);
    this.playSong(await playableResource.setResource(sound));
    return embed;
  }

  private async playerIdle() {
    const embed = new EmbedBuilder();

    if (this.playingSystemSound) {
      this.playingSystemSound = false;
      if (await this.queue.hasMedia()) {
        const currentItem = await this.queue.currentItem();
        if (currentItem) {
          this.playSong(currentItem);
        }
      } else {
        this.autoDisconnect();
      }
    } else {
      await this.queue.dequeue();

      if (await this.queue.hasMedia()) {
        const currentItem = await this.queue.currentItem();
        if (currentItem) {
          this.playSong(currentItem);
        }
      } else {
        embed.setDescription("Reached end of queue, stoped playing");
        clearInterval(this.nowPlayingClock);
        this.autoDisconnect();
      }
    }

    if (typeof (embed.data.description) === "string") {
      this.updateNowPlayingMessage(await this.lastChannel.send({ embeds: [embed] }));
    }
  }

  private async playerPlaying(oldState: AudioPlayerState) {
    if (oldState.status == AudioPlayerStatus.Playing || this.playingSystemSound) return;
    if (this.messages.nowplaying === undefined) {
      const embed = await SharedMethods.nowPlayingMessage(this);
      let message = await this.lastChannel.send({ embeds: [embed] });
      this.updateNowPlayingMessage(message);
    }
    this.updatingNowPlayingMessage();
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

  private async updatingNowPlayingMessage() {
    if (this.nowPlayingClock !== undefined) {
      clearInterval(this.nowPlayingClock);
    }
    this.nowPlayingClock = setInterval(async () => {
      if (this.messages.nowplaying !== undefined) {
        const channel = await this.guild.channels.fetch(this.messages.nowplaying.channelId);
        if (channel.isTextBased()) {
          const embed = await SharedMethods.nowPlayingMessage(this);
          try {
            const nowPlayingMessage = await this.messages.nowplaying.fetch();
            if (nowPlayingMessage.editable) {
              this.messages.nowplaying = await nowPlayingMessage.edit({ embeds: [embed] });
            } else if (nowPlayingMessage.deletable) {
              this.updateNowPlayingMessage(await this.lastChannel.send({ embeds: [embed] }))
            } else {
              this.messages.nowplaying = await this.lastChannel.send({ embeds: [embed] });
            }
          } catch (error) {
            if (error.name !== "DiscordAPIError[10008]") {
              throw error;
            } else {
              this.messages.nowplaying = await this.lastChannel.send({ embeds: [embed] });
            }
          }
        }
      }
    }, 1000);
  }
}
