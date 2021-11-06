import { YouTubePlaylist } from "./youtube";

export interface IMetadata {
  title: string;
  length: number;
  queuedBy: string;
  playlist: YouTubePlaylist;
}

export class Metadata implements IMetadata {
  title: string;
  length: number;
  queuedBy: string;
  playlist: YouTubePlaylist;

  constructor() {
    this.title = "";
    this.length = 0;
    this.playlist = new YouTubePlaylist();
  }
}
