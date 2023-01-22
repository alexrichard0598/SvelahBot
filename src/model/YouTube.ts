import { AudioResource } from "@discordjs/voice";
import { Metadata } from "./Metadata";
import { SharedMethods } from "../commands/SharedMethods";
import { MediaType } from "./MediaType";
import { VolfbotServer } from "./VolfbotServer";
import { ISong, Song } from "../database/Queue";
import { url } from "inspector";

export class PlayableResource {
    id: number;
    url: string;
    meta: Metadata;
    private resource: AudioResource;
    discordServerId: number;

    constructor(server: VolfbotServer | number, url = "", meta: Metadata = new Metadata()) {
        this.url = url;
        this.meta = meta;
        this.discordServerId = server instanceof VolfbotServer ? server.id : server;
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

    toISong(): ISong {
        let song = new Song(this.url, this.meta.title, this.meta.length, this.meta.queuedBy, this.meta.playlist.id, this.discordServerId);

        return song;
    }

    static async parseFromISong(song: ISong): Promise<PlayableResource> {
        if (song == null) return null;
        let media = new PlayableResource(song.discordServerId);
        media.resource = undefined;
        media.id = song.id;
        media.url = song.url;
        media.meta.title = song.title;
        media.meta.length = song.length;
        media.meta.queuedBy = song.queuedBy;
        media.meta.playlist = null;

        return media;
    }
}

export class YouTubePlaylist {
    id: number;
    name: string;
    length: number;

    constructor(name: string, length: number, server: VolfbotServer) {
        this.name = name;
        this.length = length;
        this.id = server.id - Date.now() + encodeString(name ? name : "");
    }
}

function encodeString(str: string): number {
    let number = 0;
    str.toLowerCase().split("").forEach((value, index) => {
        number += value.charCodeAt(0);
    });
    return number;
}