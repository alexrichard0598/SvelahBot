import * as mysql from "mysql";
import { config as configDotenv } from "dotenv";
import { resolve } from "path/posix";

export class DataBase {
  public readonly connection = mysql.createConnection({
    host: 'localhost',
    user: 'volfbot',
    password: process.env.DATABASE_PSWD,
    database: 'volfbot'
  });

  constructor() {
    configDotenv({
      path: resolve(__dirname, "../../env/env.variables"),
    });
  }
}