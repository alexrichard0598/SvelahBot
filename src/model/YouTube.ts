import { AudioResource } from "@discordjs/voice";
import { Metadata } from "./Metadata";
import { SharedMethods } from "../commands/SharedMethods";
import { MediaType } from "./MediaType";

export class PlayableResource {
    url: string;
    meta: Metadata;
    private resource: AudioResource;
    id: string;

    constructor(url = "", meta: Metadata = new Metadata()) {
        this.url = url;
        this.meta = meta;
    }

    async getResource(): Promise<AudioResource> {
        if (this.resource == undefined || this.resource.ended) {
            const typeUrl = await SharedMethods.determineMediaType(this.url);
            if (typeUrl[0] == MediaType.yt_video || typeUrl[0] == MediaType.yt_search || typeUrl[0] == MediaType.yt_playlist) {
                this.resource = await SharedMethods.createYoutubeResource(typeUrl[1], this.meta.queuedBy);
            }
        }
        return this.resource;
    }

    async setResource(resource: AudioResource): Promise<this> {
        this.resource = resource;
        return this;
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