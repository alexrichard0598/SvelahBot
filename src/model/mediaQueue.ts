import { SharedMethods } from "../commands/sharedMethods";
import { YouTubePlaylist, YouTubeVideo } from "./youtube";
import { MediaType } from "./mediaType";
import { createHash } from "crypto";

export class MediaQueue {
  private queue: Array<YouTubeVideo>; //TODO: Convert to list of URLs and fetch audio as needed
  private looping: Boolean = false;

  constructor() {
    this.queue = new Array<YouTubeVideo>();
  }

  async enqueue(url: string, enqueuedBy: string, playlist?: YouTubePlaylist): Promise<YouTubeVideo> {
    const video = await new YouTubeVideo(url)
    const hash = await createHash("sha256");
    await hash.update(`${this.queue.length}${url}${Date.now()}`);
    const id = await hash.digest("hex");
    video.id = await id;
    video.meta = await SharedMethods.getMetadata(url, enqueuedBy, playlist);
    this.queue.push(video);

    return video;
  }

  async dequeue(index: number = 1) {
    while (index > 0) {
      const removedItem = this.queue.shift();
      if (this.looping) {
        this.queue.push(removedItem);
      }
      index--;
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
    if (this.queue[0].resource == undefined) {
      const typeUrl = await SharedMethods.determineMediaType(this.queue[0].url);
      if (typeUrl[0] == MediaType.yt_video) {
        this.queue[0].resource = await SharedMethods.createYoutubeResource(typeUrl[1], this.queue[0].meta.queuedBy);
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
}
