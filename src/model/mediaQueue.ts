import { AudioResource } from "@discordjs/voice";
import { Guild } from "discord.js";

export class MediaQueue {
  private queue: Array<AudioResource>;
  private server: Guild;

  constructor(serv: Guild) {
    this.queue = new Array<AudioResource>();
    this.server = serv;
  }

  enqueue(item: AudioResource) {
    this.queue.push(item);
  }

  dequeue(index?: number) {
    if (index) {
      index -= 2;
      if (index < this.queue.length) {
        this.queue.splice(index);
      } else {
        this.clear();
      }
    }
    this.queue.shift();
  }

  clear() {
    this.queue.length = 0;
  }

  getQueue(): Array<AudioResource> {
    return this.queue;
  }

  hasMedia(): boolean {
    return this.queue.length != 0;
  }

  currentItem(): AudioResource {
    return this.queue[0];
  }

  getServer(): Guild {
    return this.server;
  }
}
