import { SharedMethods } from "../commands/sharedMethods";
import { YouTubePlaylist, YouTubeVideo } from "./youtube";
import { MediaType } from "./mediaType";
import { createHash } from "crypto";
import { Metadata } from "./metadata";

export class MediaQueue {
  private queue: Array<YouTubeVideo>;
  private looping: Boolean = false;

  constructor() {
    this.queue = new Array<YouTubeVideo>();
  }

  async enqueue(url: string, enqueuedBy: string, meta?: Metadata): Promise<YouTubeVideo> {
    const video = new YouTubeVideo(url)
    const hash = createHash("sha256");
    hash.update(`${this.queue.length}${url}${Date.now()}`);
    const id = hash.digest("hex");
    video.id = id;
    video.meta = meta? meta : await SharedMethods.getMetadata(url, enqueuedBy, null);
    if (video.meta.title !== "") {
      this.queue.push(video);
    }

    return video;
  }

  async dequeue(index: number = 1) {
    const removedItems = this.queue.slice(0, index);
    const keptItems = this.queue.slice(index);
    if (this.looping) {
      removedItems.forEach(i => i.resource = undefined);
      this.queue = keptItems.concat(removedItems);
    } else {
      this.queue = keptItems;
    }
  }

  clear() {
    this.queue.length = 0;
    this.looping = false;
  }

  getQueue(): Array<YouTubeVideo> {
    return this.queue;
  }

  getItem(id: string) {
    return this.queue.find(v => v.id == id);
  }

  hasMedia(): boolean {
    return this.queue.length != 0;
  }

  async currentItem(): Promise<YouTubeVideo> {
    if(this.queue[0] == undefined) return undefined;
    if (this.queue[0].resource == undefined || this.queue[0].resource.ended) {
      const typeUrl = await SharedMethods.determineMediaType(this.queue[0].url);
      if (typeUrl[0] == MediaType.yt_video || typeUrl[0] == MediaType.yt_search) {
        this.queue[0].resource = await SharedMethods.createYoutubeResource(typeUrl[1], this.queue[0].meta.queuedBy);
      } else if (typeUrl[0] == MediaType.yt_playlist) {
        SharedMethods.createYoutubePlaylistResource(typeUrl[1], this.queue[0].meta.queuedBy, await SharedMethods.getServerByMediaQueue(this));
        this.queue.shift();
        return await this.currentItem();
      }
    }
    return this.queue[0];
  }

  loopQueue() {
    this.looping = true;
  }

  endLoop() {
    this.looping = false;
  }

  shuffle() {
    var copyQueue = this.queue.slice(1);
    var shuffledQueue = new Array<YouTubeVideo>();
    shuffledQueue.push(this.queue[0]);
    while (copyQueue.length > 0) {
      const j = Math.floor(Math.random() * (copyQueue.length))
      shuffledQueue.push(copyQueue[j]);
      copyQueue = copyQueue.slice(0, j).concat(copyQueue.slice(j+1));
    }

    this.queue = shuffledQueue;
  }
}
