import { AudioPlayer, AudioPlayerStatus } from "@discordjs/voice";
import { Guild, Message, MessageEmbed, TextBasedChannels } from "discord.js";
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

  constructor(guild: Guild) {
    this.guild = guild;
    this.queue = new MediaQueue();
    this.audioPlayer = new AudioPlayer();
    this.audioPlayer.on("stateChange", async (oldState, newState) => {
      if (
        newState.status === AudioPlayerStatus.Idle &&
        !this.queue.hasMedia()
      ) {
        const embed = new MessageEmbed();
        await this.queue.dequeue();
        if (this.queue.hasMedia()) {
          const currentItem = await this.queue.currentItem();
          this.audioPlayer.play(currentItem.resource);
          const meta = currentItem.meta as IMetadata;
          embed.description = "Now playing " + meta.title + " [" + meta.queuedBy + "]";
        } else {
          embed.description = "Reached end of queue, stoped playing";
          await clearTimeout(this.timer);
          this.timer = setTimeout(() => {
            if (!this.queue.hasMedia() && this.audioPlayer.state.status == AudioPlayerStatus.Idle) {
              SharedMethods.DisconnectBot(this);
              this.lastChannel.send({ embeds: [new MessageEmbed().setDescription("Automatically disconnected due to 5 minutes of inactivity")] })
            } else {
              clearTimeout(this.timer);
            }
          }, 300000);
        }

        this.updateStatusMessage(await this.lastChannel.send({ embeds: [embed] }));
      }
    });
    this.messages = new Messages();
  }

  async updateStatusMessage(msg) {
    if (this.messages.status != undefined) {
      const status: Message = await this.messages.status.channel.messages.resolve(this.messages.status.id);
      if (status.deletable) status.delete();
    }
    if (msg instanceof Message) this.messages.status = msg;
  }

  async updateQueueMessage(msg) {
    if (this.messages.queue != undefined) {
      const queue: Message = await this.messages.queue.channel.messages.resolve(this.messages.queue.id);
      if (queue.deletable) queue.delete();
    }
    if (msg instanceof Message) this.messages.queue = msg;
  }
}