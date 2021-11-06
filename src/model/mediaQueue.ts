import { AudioResource } from "@discordjs/voice";
import { SharedMethods } from "../commands/sharedMethods";
import { Metadata } from "./metadata";

export class MediaQueue {
  private queue: Array<AudioResource>;
  private looping: Boolean = false;

  constructor() {
    this.queue = new Array<AudioResource>();
  }

  enqueue(item: AudioResource) {
    this.queue.push(item);
  }

  async dequeue(index: number = 1) {
    const server = this.looping ? await SharedMethods.getServerByMediaQueue(this) : null;
    while (index > 0) {
      const removedItem = this.queue.shift();
      if (this.looping) {
        var audioResource: AudioResource;
        const meta = (removedItem.metadata as Metadata);
        if (new RegExp(/watch/).test(meta.url)) {
          audioResource = await SharedMethods.createYoutubeResource(meta.url, meta.queuedBy);
          this.queue.push(audioResource);
        } else {
          SharedMethods.createYoutubePlaylistResource(meta.url, meta.queuedBy, server);
        }
      }
      index--;
    }
  }

  clear() {
    this.queue.length = 0;
    this.looping = false;
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

  loopQueue() {
    this.looping = true;
  }

  endLoop() {
    this.looping = false;
  }
}
