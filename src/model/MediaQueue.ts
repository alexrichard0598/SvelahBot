import { PlayableResource } from "./PlayableResource";
import { ISong, Queue, QueueManager } from "../database/Queue";
import { VolfbotServer } from "./VolfbotServer";

export class MediaQueue {
  private looping: boolean = false;
  private currentSong: PlayableResource;
  private server: VolfbotServer;

  constructor(server: VolfbotServer) {
    this.server = server;
  }

  async enqueue(media: Array<PlayableResource>) {
    let songs: Array<ISong> = new Array<ISong>();
    media.forEach((video) => {
      if (RegExp(/.*jurassic.*/, 'i').test(video.meta.title) && RegExp(/.*harmonica.*/, 'i').test(video.meta.title)) {
        this.server.lastChannel.send("No.");
      } else if ((RegExp(/.*titanic.*/, 'i').test(video.meta.title) || (RegExp(/.*heart.*/, 'i').test(video.meta.title))) && (RegExp(/.*flute.*/, 'i').test(video.meta.title) || RegExp(/.*recorder.*/, 'i').test(video.meta.title))) {
        this.server.lastChannel.send("No.");
      } else {
        songs.push(video.toISong());
      }
    });

    QueueManager.enqueueSongs(songs);
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

  async getItem(id: number): Promise<PlayableResource> {
    let song = await QueueManager.getSong(id);
    return PlayableResource.parseFromISong(song);
  }

  async getItemAt(index: number): Promise<PlayableResource> {
    let song = await QueueManager.getSongAt(this.server.id, index);
    return PlayableResource.parseFromISong(song);
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
      if (song == null) return null;
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

  async shuffle() {
    let copyQueue = await this.getQueue();
    let shuffledQueue = await this.getQueue();
    while (copyQueue.length > 0) {
      const j = Math.floor(Math.random() * (copyQueue.length))
      shuffledQueue.push(copyQueue[j]);
      copyQueue = copyQueue.slice(0, j).concat(copyQueue.slice(j + 1));
    }
    this.setQueue(shuffledQueue);
  }

  async removeItemAt(i: number) {
    QueueManager.removeSongAt(this.server.id, i);
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
