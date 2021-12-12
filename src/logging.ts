import chalk = require("chalk");
import { Logger } from "ts-log";
import * as fs from "fs";

const logFile = '../log.txt';

class Log implements Logger {
  [x: string]: any;

  trace(message?: any, ...optionalParams: any[]): void {
    console.log(chalk.bgWhite.black("TRACE: " + message));
    fs.appendFileSync(logFile, '\n' + "TRACE: " + message);
  }
  debug(message?: any, ...optionalParams: any[]): void {
    console.log(chalk.yellow("DEBUG: " + message));
    fs.appendFileSync(logFile, '\n' + "DEBUG: " + message);
  }
  info(message?: any, ...optionalParams: any[]): void {
    console.log(chalk.blue("INFO: " + message));
    fs.appendFileSync(logFile, '\n' + "INFO: " + message);
  }
  warn(message?: any, ...optionalParams: any[]): void {
    console.log(chalk.rgb(255, 165, 0)("WARNING: " + message));
    fs.appendFileSync(logFile, '\n' + "WARNING: " + message);
  }
  error(message?: any, ...optionalParams: any[]): void {
    console.log(chalk.bgRed.white("ERROR: " + message));
    fs.appendFileSync(logFile, '\n' + "ERROR: " + message);
  }
}

const log = new Log();
export { log };
