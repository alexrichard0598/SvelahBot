import { SharedMethods } from "../commands/SharedMethods";
import { PlayableResource } from "./YouTube";
import { Metadata } from "./Metadata";
import { ISong, Queue, QueueManager, Song } from "../database/Queue";
import { VolfbotServer } from "./VolfbotServer";
import { it } from "node:test";

export class MediaQueue {
  private looping: boolean = false;
  private currentSong: PlayableResource;
  private server: VolfbotServer;

  constructor(server: VolfbotServer) {
    this.server = server;
  }

  async enqueue(url: string, enqueuedBy: string, meta?: Metadata): Promise<PlayableResource> {
    const video = new PlayableResource(this.server, url)
    video.meta = meta && meta.title !== "" ? meta : await SharedMethods.getMetadata(url, enqueuedBy, null);
    if (RegExp(/.*jurassic.*/, 'i').test(video.meta.title) && RegExp(/.*harmonica.*/, 'i').test(video.meta.title)) {
      this.server.lastChannel.send("No.");
    } else if ((RegExp(/.*titanic.*/, 'i').test(video.meta.title) || (RegExp(/.*heart.*/, 'i').test(video.meta.title))) && (RegExp(/.*flute.*/, 'i').test(video.meta.title) || RegExp(/.*recorder.*/, 'i').test(video.meta.title))) {
      this.server.lastChannel.send("No.");
    } else if (video.meta.title !== "") {
      const song = video.toISong();
      QueueManager.enqueueSongs([song]);
    }

    return video;
  }

  async dequeue(index: number = 1): Promise<void> {
    for (let i = 0; i < index; i++) {
      let song = await QueueManager.dequeueSong(this.server.id);
      if (this.looping) await QueueManager.enqueueSongs([song]);
      this.currentSong = undefined;
    }
  }

  async clear(keepCurrentSong = false) {
    let currentSong = await this.currentItem();
    await QueueManager.clearQueue(this.server.id);
    if (keepCurrentSong) {
      QueueManager.enqueueSongs([currentSong.toISong()]);
    } else {
      this.looping = false;
    }
  }

  async getQueueCount(): Promise<number> {
    return QueueManager.getQueueCount(this.server.id);
  }

  async getQueue(): Promise<PlayableResource[]> {
    let queue = await QueueManager.getServerQueue(this.server.id);
    return this.mediaQueueFromQueue(queue);
  }

  async setQueue(newQueue: Array<PlayableResource>) {
    await this.clear();
    let queue = new Array<ISong>();
    newQueue.forEach(item => {
      queue.push(item.toISong());
    })
    QueueManager.enqueueSongs(queue);
  }

  async getItem(id: string): Promise<PlayableResource> {
    throw new Error();
    //return this.queue.find(v => v.id == id);
  }

  getItemAt(index: number): PlayableResource {
    throw new Error();
    //return this.queue[index];
  }

  async getTotalLength(): Promise<number> {
    let length = 0;
    (await this.getQueue()).forEach(v => length += v.meta.length);
    return length;
  }

  async hasMedia(): Promise<boolean> {
    return (await QueueManager.getQueueCount(this.server.id)) != 0;
  }

  async currentItem(): Promise<PlayableResource | null> {
    if (this.currentSong == undefined) {
      let song = await QueueManager.getCurrentSong(this.server.id);
      if(song == null) return null;
      this.currentSong = await PlayableResource.parseFromISong(song);
    }
    return this.currentSong;
  }

  loopQueue(): void {
    this.looping = true;
  }

  endLoop(): void {
    this.looping = false;
  }

  shuffle(): void {
    throw new Error();
    // let copyQueue = this.queue.slice(1);
    // let shuffledQueue = new Array<PlayableResource>();
    // shuffledQueue.push(this.queue[0]);
    // while (copyQueue.length > 0) {
    //   const j = Math.floor(Math.random() * (copyQueue.length))
    //   shuffledQueue.push(copyQueue[j]);
    //   copyQueue = copyQueue.slice(0, j).concat(copyQueue.slice(j + 1));
    // }

    // this.queue = shuffledQueue;
  }

  removeItemAt(i: number): void {
    throw new Error();
    // const newQueue = this.queue.slice(0, i).concat(this.queue.slice(i + 1));
    // this.queue = newQueue;
  }

  private mediaQueueFromQueue(queue: Queue) {
    let mediaQueue = new Array<PlayableResource>();
    queue.forEach(async (song) => {
      let media = await PlayableResource.parseFromISong(song);
      mediaQueue.push(media);
    });

    return mediaQueue;
  }
}
