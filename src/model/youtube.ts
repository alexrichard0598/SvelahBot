import { AudioResource } from "@discordjs/voice";
import { Metadata } from "./metadata";

export class YouTubeVideo {
    url: string;
    meta: Metadata;
    resource: AudioResource;
    id: string;

    constructor(url = "", meta: Metadata = new Metadata()) {
        this.url = url;
        this.meta = meta;
    }
}

export class YouTubePlaylist {
    name: string;
    length: number;

    constructor(name?: string, length?: number) {
        this.name = name;
        this.length = length;
    }
}