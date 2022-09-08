import { AudioPlayer, AudioPlayerStatus, createAudioResource, DiscordGatewayAdapterCreator, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { CommandInteraction, Guild, Message, MessageEmbed, TextBasedChannel, VoiceBasedChannel } from "discord.js";
import { SharedMethods } from "../commands/sharedMethods";
import { MediaQueue } from "./mediaQueue";
import { Messages } from "./messages";
import { IMetadata } from "./metadata";
import * as fs from 'fs';

export class DiscordServer {
  guild: Guild;
  queue: MediaQueue;
  audioPlayer: AudioPlayer;
  lastChannel: TextBasedChannel;
  messages: Messages;
  private playingSystemSound = false;
  private timer;

  constructor(guild: Guild) {
    this.guild = guild;
    this.queue = new MediaQueue();
    this.messages = new Messages();
    this.audioPlayer = new AudioPlayer();
    this.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
      const embed = new MessageEmbed();

      if (this.playingSystemSound) {
        this.playingSystemSound = false;
        if (this.queue.hasMedia()) {
          const currentItem = await this.queue.currentItem();
          this.audioPlayer.play(currentItem.resource);
          const meta = currentItem.meta as IMetadata;
          embed.description = `Now playing [${meta.title}](${currentItem.url}) [${meta.queuedBy}]`;
        } else {
          this.autoDisconnect();
        }
      } else {
        await this.queue.dequeue();

        if (this.queue.hasMedia()) {
          const currentItem = await this.queue.currentItem();
          this.audioPlayer.play(currentItem.resource);
          const meta = currentItem.meta as IMetadata;
          embed.description = `Now playing [${meta.title}](${currentItem.url}) [${meta.queuedBy}]`;
        } else {
          embed.description = "Reached end of queue, stoped playing";
          this.autoDisconnect();
        }
      }

      if (typeof (embed.description) === "string") {
        this.updateStatusMessage(await this.lastChannel.send({ embeds: [embed] }));
      }
    });
  }

  async updateStatusMessage(msg) {
    if (this.messages.status != undefined) {
      const status: Message = this.messages.status.channel.messages.resolve(this.messages.status.id);
      if (status != null) {
        if (status.deletable) status.delete().catch(err => { SharedMethods.handleErr(err, this.guild) });
      }
    }
    if (msg instanceof Message) this.messages.status = msg;
  }

  async updateQueueMessage(msg) {
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
      })

      const deleting = await this.lastChannel.send("Cleaning up after disconnect");
      this.playingSystemSound = true;
      this.audioPlayer.play(sound);

      if (this.lastChannel) {
        SharedMethods.clearMessages(await SharedMethods.retrieveBotMessages(this.lastChannel, excludedMessages.concat(deleting.id)));
      }
    }
  }

  async connectBot(interaction: CommandInteraction): Promise<MessageEmbed> {
    this.lastChannel = interaction.channel;
    const guildMember = await this.guild.members.fetch(
      interaction.user
    );
    const embed = new MessageEmbed;
    const vc: VoiceBasedChannel = guildMember.voice.channel;
    const audioPlayer = this.audioPlayer;

    if (vc === null) {
      embed.description = "You are not part of a voice chat, please join a voice chat first.";
    } else {
      joinVoiceChannel({
        channelId: vc.id,
        guildId: vc.guildId,
        adapterCreator: vc.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
      }).subscribe(audioPlayer);
      embed.description = "Joined " + vc.name;
    }

    let stream = fs.createReadStream('./src/assets/sounds/volfbot-connect.ogg');
    const sound = createAudioResource(stream);
    this.playingSystemSound = true;
    this.audioPlayer.play(sound);
    return embed;
  }

  private async autoDisconnect() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.queue.hasMedia() && this.audioPlayer.state.status == AudioPlayerStatus.Idle) {
        this.disconnectBot();
        this.lastChannel.send({ embeds: [new MessageEmbed().setDescription("Automatically disconnected due to 5 minutes of inactivity")] });
      } else {
        clearTimeout(this.timer);
      }
    }, 300000);
  }
}