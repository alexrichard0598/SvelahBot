import chalk = require("chalk");
import { Logger } from "ts-log";

class Log implements Logger {
    [x: string]: any;

    trace(message?: any, ...optionalParams: any[]): void {
        console.log(chalk.bgWhite.black('TRACE: ' + message));
    }
    debug(message?: any, ...optionalParams: any[]): void {
        console.log(chalk.yellow("DEBUG: " + message));
    }
    info(message?: any, ...optionalParams: any[]): void {
        console.log(chalk.blue("INFO: " + message));
    }
    warn(message?: any, ...optionalParams: any[]): void {
        console.log(chalk.rgb(255, 165, 0)("WARNING: " + message));
    }
    error(message?: any, ...optionalParams: any[]): void {
        console.log(chalk.bgRed.white("ERROR: " + message));
    }
}

const log = new Log();
export { log };