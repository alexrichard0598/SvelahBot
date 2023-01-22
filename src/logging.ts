import { Logger } from "ts-log";
import * as fs from "fs";
import * as path from "path";
import chalk = require("chalk");


class Log implements Logger {
  [x: string]: any;
  public readonly logFile = path.join(__dirname, '..', 'log.txt');

  trace(message?: any, ...optionalParams: any[]): void {
    console.log(chalk.black("[" + new Date().toISOString() + "] " + "TRACE: " + message));
    fs.appendFileSync(this.logFile, "[" + new Date().toISOString() + "] " + "TRACE: " + message + '\n');
  }
  debug(message?: any, ...optionalParams: any[]): void {
    console.log(chalk.yellow("DEBUG: " + "[" + new Date().toISOString() + "] " + message));
    fs.appendFileSync(this.logFile, "[" + new Date().toISOString() + "] " + "DEBUG: " + message + '\n');
  }
  info(message?: any, ...optionalParams: any[]): void {
    console.log(chalk.blue("INFO: " + "[" + new Date().toISOString() + "] " + message));
    fs.appendFileSync(this.logFile, "[" + new Date().toISOString() + "] " + "INFO: " + message + '\n');
  }
  warn(message?: any, ...optionalParams: any[]): void {
    console.log(chalk.rgb(255, 165, 0)("[" + new Date().toISOString() + "] " + "WARNING: " + message));
    fs.appendFileSync(this.logFile, "[" + new Date().toISOString() + "] " + "WARNING: " + message + '\n');
  }
  error(message?: any, ...optionalParams: any[]): void {
    console.log(chalk.bgRed.white("[" + new Date().toISOString() + "] " + "ERROR: " + message));
    fs.appendFileSync(this.logFile, "[" + new Date().toISOString() + "] " + "ERROR: " + message + '\n');
  }
}

const log = new Log();
export { log };
