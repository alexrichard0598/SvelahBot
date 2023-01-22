import { SharedMethods } from "../commands/SharedMethods";
import { PlayableResource } from "./YouTube";
import { createHash } from "crypto";
import { Metadata } from "./Metadata";
import { VolfbotServer } from "./VolfbotServer";

export class MediaQueue {
  private queue: Array<PlayableResource>;
  private looping: boolean = false;

  constructor() {
    this.queue = new Array<PlayableResource>();
  }

  async enqueue(url: string, enqueuedBy: string, server: VolfbotServer, meta?: Metadata): Promise<PlayableResource> {
    const video = new PlayableResource(url)
    const hash = createHash("sha256");
    hash.update(`${this.queue.length}${url}${Date.now()}`);
    const id = hash.digest("hex");
    video.id = id;
    video.meta = meta && meta.title !== "" ? meta : await SharedMethods.getMetadata(url, enqueuedBy, null);
    if (RegExp(/.*jurassic.*/, 'i').test(video.meta.title) && RegExp(/.*harmonica.*/, 'i').test(video.meta.title)) {
      server.lastChannel.send("No.");
    } else if ((RegExp(/.*titanic.*/, 'i').test(video.meta.title) || (RegExp(/.*heart.*/, 'i').test(video.meta.title))) && (RegExp(/.*flute.*/, 'i').test(video.meta.title) || RegExp(/.*recorder.*/, 'i').test(video.meta.title))) {
      server.lastChannel.send("No.");
    } else if (video.meta.title !== "") {
      this.queue.push(video);
    }

    return video;
  }

  async dequeue(index: number = 1): Promise<void> {
    const removedItems = this.queue.slice(0, index);
    const keptItems = this.queue.slice(index);
    if (this.looping) {
      removedItems.forEach(i => i.getResource = undefined);
      this.queue = keptItems.concat(removedItems);
    } else {
      this.queue = keptItems;
    }
  }

  clear(keepCurrentSong = false): void {
    if (keepCurrentSong) {
      this.queue.splice(1, this.queue.length);
    } else {
      this.queue.splice(0, this.queue.length);
      this.looping = false;
    }
  }

  getQueue(): Array<PlayableResource> {
    return Array.from(this.queue);
  }

  setQueue(newQueue: Array<PlayableResource>): void {
    this.queue = newQueue;
  }

  async getItem(id: string): Promise<PlayableResource> {
    return this.queue.find(v => v.id == id);
  }

  getItemAt(index: number): PlayableResource {
    return this.queue[index];
  }

  async getTotalLength(): Promise<number> {
    let length = 0;
    this.queue.forEach(v => length += v.meta.length);
    return length;
  }

  hasMedia(): boolean {
    return this.queue.length != 0;
  }

  async currentItem(): Promise<PlayableResource> {
    return this.queue[0];
  }

  loopQueue(): void {
    this.looping = true;
  }

  endLoop(): void {
    this.looping = false;
  }

  shuffle(): void {
    let copyQueue = this.queue.slice(1);
    let shuffledQueue = new Array<PlayableResource>();
    shuffledQueue.push(this.queue[0]);
    while (copyQueue.length > 0) {
      const j = Math.floor(Math.random() * (copyQueue.length))
      shuffledQueue.push(copyQueue[j]);
      copyQueue = copyQueue.slice(0, j).concat(copyQueue.slice(j + 1));
    }

    this.queue = shuffledQueue;
  }

  removeItemAt(i: number): void {
    const newQueue = this.queue.slice(0, i).concat(this.queue.slice(i + 1));
    this.queue = newQueue;
  }
}
