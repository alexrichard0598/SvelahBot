import { SharedMethods } from "../commands/sharedMethods";
import { YouTubeVideo } from "./youtube";
import { MediaType } from "./mediaType";
import { createHash } from "crypto";
import { Metadata } from "./metadata";

export class MediaQueue {
  private queue: Array<YouTubeVideo>;
  private looping: boolean = false;

  constructor() {
    this.queue = new Array<YouTubeVideo>();
  }

  async enqueue(url: string, enqueuedBy: string, meta?: Metadata): Promise<YouTubeVideo> {
    const video = new YouTubeVideo(url)
    const hash = createHash("sha256");
    hash.update(`${this.queue.length}${url}${Date.now()}`);
    const id = hash.digest("hex");
    video.id = id;
    video.meta = meta ? meta : await SharedMethods.getMetadata(url, enqueuedBy, null);
    if (video.meta.title !== "") {
      this.queue.push(video);
    }

    return video;
  }

  async dequeue(index: number = 1): Promise<void> {
    const removedItems = this.queue.slice(0, index);
    const keptItems = this.queue.slice(index);
    if (this.looping) {
      removedItems.forEach(i => i.resource = undefined);
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

  getQueue(): Array<YouTubeVideo> {
    return this.queue;
  }

  async getItem(id: string): Promise<YouTubeVideo> {
    return this.queue.find(v => v.id == id);
  }

  getItemAt(index: number): YouTubeVideo {
    return this.queue[index];
  }

  async getTotalLength(): Promise<number> {
    var length = 0;
    this.queue.forEach(v => length += v.meta.length);
    return length;
  }

  hasMedia(): boolean {
    return this.queue.length != 0;
  }

  async currentItem(): Promise<YouTubeVideo> {
    if (this.queue[0] == undefined) return undefined;
    if (this.queue[0].resource == undefined || this.queue[0].resource.ended) {
      const typeUrl = await SharedMethods.determineMediaType(this.queue[0].url);
      if (typeUrl[0] == MediaType.yt_video || typeUrl[0] == MediaType.yt_search) {
        this.queue[0].resource = await SharedMethods.createYoutubeResource(typeUrl[1], this.queue[0].meta.queuedBy);
      } else if (typeUrl[0] == MediaType.yt_playlist) {
        SharedMethods.createYoutubePlaylistResource(typeUrl[1], this.queue[0].meta.queuedBy, await SharedMethods.getServerByMediaQueue(this));
        this.queue.shift();
        return this.currentItem();
      }
    }
    return this.queue[0];
  }

  loopQueue(): void {
    this.looping = true;
  }

  endLoop(): void {
    this.looping = false;
  }

  shuffle(): void {
    var copyQueue = this.queue.slice(1);
    var shuffledQueue = new Array<YouTubeVideo>();
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
