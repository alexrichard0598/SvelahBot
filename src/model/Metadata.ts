import { YouTubePlaylist } from "./YouTube";

export interface IMetadata {
  title: string;
  length: number;
  queuedBy: string;
  playlist: YouTubePlaylist | null;
}

export class Metadata implements IMetadata {
  title: string;
  length: number;
  queuedBy: string;
  playlist: YouTubePlaylist | null;

  constructor() {
    this.title = "";
    this.length = 0;
    this.playlist = null;
  }
}
