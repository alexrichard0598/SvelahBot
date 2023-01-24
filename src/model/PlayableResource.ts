import { AudioResource } from "@discordjs/voice";
import { Metadata } from "./Metadata";
import { SharedMethods } from "../commands/SharedMethods";
import { MediaType } from "./MediaType";
import { VolfbotServer } from "./VolfbotServer";
import { ISong, Song } from "../database/Queue";

export class PlayableResource {
    id: string;
    url: string;
    meta: Metadata;
    private resource: AudioResource;
    discordServerId: string;

    constructor(server: VolfbotServer | string, url = "", meta: Metadata = new Metadata()) {
        this.url = url;
        this.meta = meta;
        this.discordServerId = server instanceof VolfbotServer ? server.id : server;
        this.id = `${this.discordServerId}${Date.now()}${url.split("=")[1]}`;
    }

    async getResource(): Promise<AudioResource> {
        if (this.resource == undefined || this.resource.ended) {
            const typeUrl = await SharedMethods.determineMediaType(this.url);
            if (typeUrl[0] == MediaType.yt_video || typeUrl[0] == MediaType.yt_search || typeUrl[0] == MediaType.yt_playlist) {
                this.resource = await SharedMethods.createYoutubeResource(typeUrl[1]);
            }
        }
        return this.resource;
    }

    async setResource(resource: AudioResource): Promise<this> {
        this.resource = resource;
        return this;
    }

    toISong(): ISong {
        let song = new Song(this.id, this.url, this.meta.title, this.meta.length, this.meta.queuedBy, this.meta.playlist ? this.meta.playlist.id : null, this.discordServerId);
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
    id: string;
    name: string;
    length: number;
    playlistUrl: string;

    constructor(name: string, length: number, playlistUrl: string, server: VolfbotServer) {
        this.name = name;
        this.length = length;
        this.playlistUrl = playlistUrl;
        this.id = `${server.id}${Date.now()}${playlistUrl}`;
    }
}