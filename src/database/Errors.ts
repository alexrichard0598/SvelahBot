import { DataBase } from "./DataBase";

export interface IDiscordError {
  id: string;
  dateTime: Date;
  errorMessage: string;
}

export class DiscordError implements IDiscordError {
  id: string;
  dateTime: Date;
  errorMessage: string;

  constructor(dateTime, errorMessage) {
    this.dateTime = dateTime;
    this.errorMessage = errorMessage;
  }
}

export abstract class ErrorManager {
  public static async getLastError(): Promise<IDiscordError> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query('SELECT TOP 1 * FROM Errors', function (error, results, fields) {
          results.forEach(result => {
            resolve(new DiscordError(result.dateTime, result.errorMessage));
          });
        }).on("end", () => {
          db.connection.end();
        });
      });
  }

  public static async addError(error: IDiscordError): Promise<void> {
    return new Promise(
      function (resolve, reject) {
        let db = new DataBase();
        db.connection.connect();

        db.connection.query('INSERT INTO DiscordServers SET ?', error, function (error, results, fields) {
          results.forEach(result => {
            if (error) reject(error);
          }).on("end", () => {
            db.connection.end();
            resolve();
          });
        });
      });
  }
}