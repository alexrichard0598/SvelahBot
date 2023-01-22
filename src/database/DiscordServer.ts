import { DataBase } from "./DataBase";

export interface IDiscordServer {
  id: number;
  lastChannelId: number;
}

export abstract class DiscordServerManager {
  public static async getAllServers(): Promise<Array<IDiscordServer>> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let servers: Array<IDiscordServer> = new Array<IDiscordServer>;

        db.connection.query('SELECT * FROM DiscordServers', function (error, results: [IDiscordServer], fields) {
          results.forEach(result => {
            servers.push(result);
          });
        }).on("end", () => {
          db.connection.end();
          resolve(servers);
        });
      });
  }

  public static async getServer(id: number): Promise<IDiscordServer> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();
        let server: IDiscordServer;

        db.connection.query(`SELECT * FROM DiscordServers WHERE id = ${id}`, function (error, results: [IDiscordServer], fields) {
          server = results[0];
        }).on("end", () => {
          db.connection.end();
          resolve(server);
        });
      });
  }
}