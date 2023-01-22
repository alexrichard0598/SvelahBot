import { AudioPlayer, AudioPlayerState, AudioPlayerStatus, createAudioResource, DiscordGatewayAdapterCreator, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { CommandInteraction, Guild, Message, EmbedBuilder, TextBasedChannel, VoiceBasedChannel } from "discord.js";
import { SharedMethods } from "../commands/SharedMethods";
import { MediaQueue } from "./MediaQueue";
import { Messages } from "./Messages";
import * as fs from 'fs';
import { PlayableResource } from "./PlayableResource";
import { log } from "../logging";

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

  // // @On({ event: "messageDelete" })
  // // async trackDeletedMessages(message) {
  // //   const messageID = message.id;
  // //   if (this.messages.status !== undefined && messageID == this.messages.status.id) {
  // //     this.messages.status = undefined;
  // //   }
  // //   if (this.messages.nowplaying !== undefined && messageID == this.messages.nowplaying.id) {
  // //     this.messages.nowplaying = undefined;
  // //   }
  // //   if (this.messages.queue !== undefined && messageID == this.messages.queue.id) {
  // //     this.messages.queue = undefined;
  // //   }
  // // }

  async updateStatusMessage(msg: Message) {
    try {
      if (msg instanceof Message) msg.fetch(true);
      if (this.messages.status != undefined) {
        const status: Message = await this.messages.status.fetch(true);
        if (status != null) {
          if (status.deletable) status.delete();
        }
      }
      if (msg instanceof Message) this.messages.status = msg;
    } catch (error) {
      if (error.name !== "DiscordAPIError[10008]") {
        throw error;
      } else {
        log.warn("Failed to delete status message");
      }
    }

  }

  async updateNowPlayingMessage(msg: Message) {
    try {
      msg.fetch(true);
      if (this.messages.nowplaying != undefined) {
        const nowplaying: Message = await this.messages.nowplaying.fetch(true);
        if (nowplaying != null) {
          if (nowplaying.deletable) nowplaying.delete();
        }
      }

      if (msg instanceof Message) this.messages.nowplaying = msg;
    } catch (error) {
      if (error.name !== "DiscordAPIError[10008]") {
        throw error;
      } else {
        log.warn("Failed to delete now playing message");
      }
    }
  }

  async updateQueueMessage(msg: Message) {
    try {
      msg.fetch(true);
      if (this.messages.queue != undefined) {
        const queue: Message = await this.messages.queue.fetch(true);
        if (queue != null) {
          if (queue.deletable) queue.delete();
        }
      }
      if (msg instanceof Message) this.messages.queue = msg;
    } catch (error) {
      if (error.name !== "DiscordAPIError[10008]") {
        throw error;
      } else {
        log.warn("Failed to delete queue message");
      }
    }

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
        if (!wasPlayingSystemSound) embed.setDescription("Reached end of queue, stoped playing");
        clearInterval(this.nowPlayingClock);
        this.autoDisconnect();
      }

    if (typeof (embed.data.description) === "string") {
      this.updateNowPlayingMessage(await this.lastChannel.send({ embeds: [embed] }));
    }
  }

  private async playerPlaying(oldState: AudioPlayerState) {
    if (oldState.status == AudioPlayerStatus.Playing || this.playingSystemSound) return;
    if (this.messages.nowplaying === undefined) {
      const embed = await SharedMethods.nowPlayingEmbed(this);
      this.createNowPlayingMessage(embed);
    }
    this.nowPlayingClockFunction();
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

  private async nowPlayingClockFunction() {
    if (this.nowPlayingClock !== undefined) {
      clearInterval(this.nowPlayingClock);
    }
    this.nowPlayingClock = setInterval(async () => {
      const embed = await SharedMethods.nowPlayingEmbed(this);
      try {
        if (this.messages.nowplaying) {
          const nowPlayingMessage = await this.messages.nowplaying.fetch();
          if (nowPlayingMessage.editable) {
            this.messages.nowplaying = await nowPlayingMessage.edit({ embeds: [embed] });
          } else {
            this.createNowPlayingMessage(embed, nowPlayingMessage);
          }
        }
      } catch (error) {
        // Check if it's a message not found error
        if (error.name !== "DiscordAPIError[10008]") {
          throw error;
        } else {
          this.createNowPlayingMessage(embed);
        }
      }
    }, 1000);
  }

  private async createNowPlayingMessage(embed: EmbedBuilder, nowPlayingMessage?: Message) {
    if (nowPlayingMessage instanceof Message && nowPlayingMessage.deletable) {
      this.updateNowPlayingMessage(await this.lastChannel.send({ embeds: [embed] }))
    } else {
      this.messages.nowplaying = await this.lastChannel.send({ embeds: [embed] });
    }

    // TODO: Figure out how to respond to reactions
    // // try {
    // //   let nowPlayingMessage = await this.messages.nowplaying.fetch();
    // //   nowPlayingMessage.react("⏹️");
    // // } catch (error) {
    // //   // Check if it's a message not found error
    // //   if (error.name !== "DiscordAPIError[10008]") {
    // //     throw error;
    // //   }
    // // }
  }
}
