import { AudioPlayer, AudioPlayerStatus, getVoiceConnection } from "@discordjs/voice";
import { Guild, Message, MessageEmbed, TextBasedChannel, TextBasedChannels } from "discord.js";
import { SharedMethods } from "../commands/sharedMethods";
import { MediaQueue } from "./mediaQueue";
import { Messages } from "./messages";
import { IMetadata } from "./metadata";

export class Server {
  guild: Guild;
  queue: MediaQueue;
  audioPlayer: AudioPlayer;
  lastChannel: TextBasedChannels;
  messages: Messages;
  private timer;

  constructor(guild: Guild, queue?: MediaQueue, audioPlayer?: AudioPlayer, channel?: TextBasedChannels) {
    this.guild = guild;
    this.queue = queue !== undefined ? queue : new MediaQueue();
    this.audioPlayer = audioPlayer !== undefined ? audioPlayer : new AudioPlayer();
    this.audioPlayer.on("stateChange", async (oldState, newState) => {
      if (
        oldState.status === AudioPlayerStatus.Playing &&
        newState.status === AudioPlayerStatus.Idle
      ) {
        const embed = new MessageEmbed();
        this.queue.dequeue();
        if (this.queue.hasMedia()) {
          this.audioPlayer.play(this.queue.currentItem());
          const meta = this.queue.currentItem().metadata as IMetadata;
          embed.description = "Now playing " + meta.title + " [" + meta.queuedBy + "]";
        } else {
          embed.description = "Reached end of queue, stoped playing";
          this.timer = setTimeout(() => {
            SharedMethods.DisconnectBot(this);
            this.lastChannel.send({embeds: [new MessageEmbed().setDescription("Automatically disconnected due to 5 minutes of inactivity")]})
          }, 300000);
        }

        this.updateStatusMessage(await this.lastChannel.send({ embeds: [embed] }));
      } else if (newState.status == AudioPlayerStatus.Playing) {
        clearTimeout(this.timer);
      }
    })
    this.lastChannel = channel !== undefined ? channel : undefined;
    this.messages = new Messages();
  }

  updateStatusMessage(msg) {
    if (this.messages.status != undefined) this.messages.status.delete();
    if (msg instanceof Message) this.messages.status = msg;
  }

  updateQueueMessage(msg) {
    if (this.messages.queue != undefined) this.messages.queue.delete();
    if (msg instanceof Message) this.messages.queue = msg;
  }
}