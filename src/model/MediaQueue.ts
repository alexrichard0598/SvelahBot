import { PlayableResource } from "./PlayableResource";
import { ISong, Queue, QueueManager } from "../database/Queue";
import { VolfbotServer } from "./VolfbotServer";
import { SharedMethods } from "../commands/SharedMethods";

export class MediaQueue {
  private looping: boolean = false;
  private currentSong: PlayableResource;
  private server: VolfbotServer;

  constructor(server: VolfbotServer) {
    this.server = server;
  }

  async enqueue(media: Array<PlayableResource>) {
    try {
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
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }

  }

  async dequeue(index: number = 1): Promise<void> {
    try {
      for (let i = 0; i < index; i++) {
        let song = await QueueManager.dequeueSong(this.server.id);
        if (this.looping) await QueueManager.enqueueSongs([song]);
        this.currentSong = undefined;
      }
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }

  }

  async clear(keepCurrentSong = false) {
    try {
      let currentSong = await this.currentItem();
      await QueueManager.clearQueue(this.server.id);
      if (keepCurrentSong) {
        QueueManager.enqueueSongs([currentSong.toISong()]);
      } else {
        this.looping = false;
      }
    }
    catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  async getQueueCount(): Promise<number> {
    try {
      return await QueueManager.getQueueCount(this.server.id);
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  async getQueue(): Promise<PlayableResource[]> {
    try {
      let queue = await QueueManager.getServerQueue(this.server.id);
      return this.mediaQueueFromQueue(queue);
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  async setQueue(newQueue: Array<PlayableResource>) {
    try {
      await this.clear();
      let queue = new Array<ISong>();
      newQueue.forEach(item => {
        queue.push(item.toISong());
      })
      QueueManager.enqueueSongs(queue);
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  async getItem(id: number): Promise<PlayableResource> {
    try {
      let song = await QueueManager.getSong(id);
      return PlayableResource.parseFromISong(song);
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  async getItemAt(index: number): Promise<PlayableResource> {
    try {
      let song = await QueueManager.getSongAt(this.server.id, index);
      return PlayableResource.parseFromISong(song);
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  async getTotalLength(): Promise<number> {
    try {
      let length = 0;
      (await this.getQueue()).forEach(v => length += v.meta.length);
      return length;
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }

  }

  async hasMedia(): Promise<boolean> {
    try {
      return (await QueueManager.getQueueCount(this.server.id)) != 0;
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  async currentItem(): Promise<PlayableResource | null> {
    try {
      if (this.currentSong == undefined) {
        let song = await QueueManager.getCurrentSong(this.server.id);
        if (song == null) return null;
        this.currentSong = await PlayableResource.parseFromISong(song);
      }
      return this.currentSong;
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  async resumePlayback(): Promise<PlayableResource | null> {
    try {
      let song = null;

      if (this.hasMedia()) {
        song = await this.currentItem();
        this.server.playSong(song);
      }

      return song;
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  loopQueue(): void {
    this.looping = true;
  }

  endLoop(): void {
    this.looping = false;
  }

  async shuffle() {
    try {
      let copyQueue = await this.getQueue();
      let shuffledQueue = await this.getQueue();
      while (copyQueue.length > 0) {
        const j = Math.floor(Math.random() * (copyQueue.length))
        shuffledQueue.push(copyQueue[j]);
        copyQueue = copyQueue.slice(0, j).concat(copyQueue.slice(j + 1));
      }
      this.setQueue(shuffledQueue);
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  async removeItemAt(i: number): Promise<ISong> {
    try {
      return await QueueManager.removeSongAt(this.server.id, i);
    } catch (error) {
      SharedMethods.handleError(error, this.server.guild);
    }
  }

  private mediaQueueFromQueue(queue: Queue): PlayableResource[] {
    let mediaQueue = new Array<PlayableResource>();
    queue.forEach(async (song) => {
      let media = await PlayableResource.parseFromISong(song);
      mediaQueue.push(media);
    });

    return mediaQueue;
  }
}
