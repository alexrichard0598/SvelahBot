import { User } from "discord.js";

export interface IMetadata {
  title: string;
  length: number;
  url: string;
  queuedBy: string;
}

export class Metadata implements IMetadata {
  title: string;
  length: number;
  url: string;
  queuedBy: string;

  constructor() {
    this.title = "";
    this.length = 0;
    this.url = "";
  }
}
