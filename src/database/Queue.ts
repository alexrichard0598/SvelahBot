import { DataBase } from "./DataBase";

export interface ISong {
  id: number;
  url: string;
  title: string;
  length: number;
  queuedBy: string;
  youtubePlaylistId: number | null;
  discordServerId: number;
  queueOrder: number;
}

export class Song implements ISong {
  id: number = 0;
  url: string;
  title: string;
  length: number;
  queuedBy: string;
  youtubePlaylistId: number | null;
  discordServerId: number;
  queueOrder: number = 0;

  constructor(
    url: string,
    title: string,
    length: number,
    queuedBy: string,
    youtubePlaylistId: number | null,
    discordServerId: number
  ) {
    this.url = url;
    this.title = title;
    this.length = length;
    this.queuedBy = queuedBy;
    this.youtubePlaylistId = youtubePlaylistId;
    this.discordServerId = discordServerId;
  }
}

export class Queue extends Array<ISong>{ }

export abstract class QueueManager {
  public static async getServerQueue(serverId: number): Promise<Queue> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let queue: Queue = new Queue();

        db.connection.query(`SELECT * FROM Songs WHERE discordServerId = ${serverId}`, (error, results: [ISong], fields) => {
          queue = results;
        }).on("end", () => {
          db.connection.end();
          resolve(queue);
        });
      }
    );
  }

  public static async dequeueSong(serverId: number): Promise<Song> {
    let song = await QueueManager.getCurrentSong(serverId);

    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query(`DELETE FROM Songs WHERE discordServerId = ${serverId} AND queueOrder = 1`);
        db.connection.query(`UPDATE Songs SET queueOrder = queueOrder - 1 WHERE discordServerId = ${serverId}`);

        db.connection.end();

        resolve(song);
      }
    );
  }

  public static async getQueueCount(serverId: number): Promise<number> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let count: number = 0;

        db.connection.query(`SELECT COUNT(*) AS count FROM Songs WHERE discordServerId = ${serverId}`, (error, results, fields) => {
          if (error) {
            reject(error)
          } else if (results) {
            count = results[0].count as number;
          }
        }).on("end", () => {
          db.connection.end();
          resolve(count);
        });
      }
    );
  }

  public static async enqueueSongs(songs: ISong[]): Promise<Queue> {
    if (songs[0] == undefined) throw new Error("Must provide a song to queue");

    let count = (await QueueManager.getQueueCount(songs[0].discordServerId)) + 1;
    for (let i = 0; i < songs.length; i++) {
      songs[i].queueOrder = count + i;
    }

    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query(
          'INSERT INTO Songs SET ?', songs, (err, res, fields) => {
            if (err) reject(err);
            resolve(res);
          });

        db.connection.end();
      }
    );
  }

  public static async getCurrentSong(serverId: number): Promise<Song> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let song: ISong;

        db.connection.query(`SELECT * FROM Songs WHERE discordServerId = ${serverId} AND queueOrder = 1`, (error, results: [ISong], fields) => {
          if (error) reject(error);
          const result = results[0];
          if (result) {
            song = new Song(result.url, result.title, result.length, result.queuedBy, result.youtubePlaylistId, result.discordServerId);
            song.id = result.id;
            song.queueOrder = result.queueOrder;
          } else {
            song = null;
          }
        }).on("end", () => {
          db.connection.end();
          resolve(song);
        });
      }
    );
  }

  public static async clearQueue(serverId: number) {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query(`DELETE FROM Songs WHERE discordServerId = ${serverId}`, (err, results, fields) => {
          resolve(results);
        });

        db.connection.end();
      }
    );
  }
}