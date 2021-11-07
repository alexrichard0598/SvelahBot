import { AudioPlayerStatus, AudioResource, createAudioResource, getVoiceConnection, StreamType } from "@discordjs/voice";
import { CommandInteraction, Guild, Message, MessageEmbed, TextChannel } from "discord.js";
import { Server } from "../model/server";
import * as fs from 'fs';
import * as youtubeSearch from "youtube-search";
const PlaylistSummary = require("youtube-playlist-summary");
const ytdlExec = require("youtube-dl-exec").raw;
import ytdl = require("ytdl-core");
import { IMetadata, Metadata } from "../model/metadata";
import { MediaQueue } from "../model/mediaQueue";
import { MediaType } from "../model/mediaType";
import { YouTubePlaylist } from "../model/youtube";
import { YouTubeSearchOptions, YouTubeSearchPageResults, YouTubeSearchResults } from "youtube-search";

export abstract class SharedMethods {
    private static servers: Server[] = new Array<Server>();


    public static async ClearMessages(messages: Array<Message>, interaction?: CommandInteraction) {
        let embed: MessageEmbed;
        const server = messages.length > 0 ? await this.getServer(messages[0].guild) : undefined;
        if (messages.length > 0) {
            if (server.lastChannel instanceof TextChannel) {
                (server.lastChannel as TextChannel).bulkDelete(messages);
                embed = new MessageEmbed().setDescription("Messages deleted");
            } else {
                embed = new MessageEmbed().setDescription("Cannot delete messages");
            }
        } else {
            embed = new MessageEmbed().setDescription("No messages to delete");
        }

        if (interaction) {
            interaction.editReply({ embeds: [embed] });
        } else if (server) {
            server.lastChannel.send({ embeds: [embed] });
        }
    }

    public static async DisconnectBot(server: Server) {
        try {
            server.queue.clear();
            var stream = fs.createReadStream('./src/assets/sounds/volfbot-disconnect.mp3');
            const sound = createAudioResource(stream);
            const connection = await getVoiceConnection(server.guild.id);

            if (connection) {
                if (!server.audioPlayer.playable.includes(connection)) {
                    await connection.subscribe(server.audioPlayer);
                }

                await server.audioPlayer.on("stateChange", (oldState, newState) => {
                    if (newState.status == AudioPlayerStatus.Idle) {
                        connection.disconnect();
                        connection.destroy();
                    }
                })

                const deleting = await server.lastChannel.send("Cleaning up after disconnect");
                server.audioPlayer.play(sound);
                if (server.lastChannel) {
                    var messages = new Array<Message>();
                    await (await server.lastChannel.messages.fetch({ limit: 100 }, { force: true })).forEach(msg => {
                        if (msg.author.id == "698214544560095362" && msg.id != deleting.id) {
                            messages.push(msg)
                        }
                    });
                    this.ClearMessages(messages);
                }
            }
        } catch (error) {
            this.handleErr(error, server.guild);
        }

    }

    public static async getServer(guild: Guild) {
        try {
            const foundServer = this.servers.find((s) => s.guild.id == guild.id);
            if (foundServer === undefined) {
                var newServer = new Server(guild);
                this.servers.push(newServer);
                return newServer;
            }
            return foundServer;
        } catch (error) {
            this.handleErr(error, guild);
        }
    }

    public static async getServerByMediaQueue(mediaQueue: MediaQueue) {
        try {
            const foundServer = this.servers.find((s) => s.queue == mediaQueue);
            if (foundServer === undefined) {
                return null;
            }
            return foundServer;
        } catch (error) {
        }
    }

    public static async handleErr(err, guild: Guild) {
        const embed = new MessageEmbed();
        const server = await this.getServer(guild);
        embed.title = "Error!";
        embed.description = `${err.message}\r\n\`\`\`${err.stack}\`\`\`\r\n**Please let the developer know**`;
        if (server.lastChannel !== undefined)
            server.lastChannel.send({ embeds: [embed] });
        console.log(err);
    }

    public static async searchYoutube(search: string): Promise<string> {
        var opts: YouTubeSearchOptions = {
            maxResults: 1,
            key: process.env.GOOGLE_API,
        };

        return new Promise<string>((resolve, reject) => {
            youtubeSearch(search, opts).then((res: {results: YouTubeSearchResults[], pageInfo: YouTubeSearchPageResults}) => {
                const id: string = res.results[0].id;
                resolve(id);
            }).catch(err => reject(err));
        });
    }

    public static async getMetadata(url: string, queuedBy: string, playlist: YouTubePlaylist): Promise<IMetadata> {
        const meta = await new Metadata();
        const details = await ytdl.getInfo(url);
        meta.title = details.videoDetails.title;
        meta.length = parseInt(details.videoDetails.lengthSeconds) * 1000;
        meta.queuedBy = queuedBy;
        meta.playlist = playlist;
        return meta;
    }

    public static async createYoutubeResource(
        url: string,
        queuedBy: string
    ): Promise<AudioResource<unknown>> {
        const stream = ytdlExec(
            url,
            {
                o: "-",
                q: "",
                f: "bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio",
                r: "100k",
            },
            { stdio: ["ignore", "pipe", "ignore"] }
        );
        var audioResource: AudioResource;
        audioResource = createAudioResource(stream.stdout, { inputType: StreamType.WebmOpus });
        return audioResource;
    }

    public static async createYoutubePlaylistResource(
        playlistId: string,
        enqueuedBy: string,
        server: Server
    ): Promise<string> {
        const ps = new PlaylistSummary({
            GOOGLE_API_KEY: process.env.GOOGLE_API,
        });

        var result = await ps
            .getPlaylistItems(playlistId)
            .then(async (result) => result);

        for (let i = 0; i < result.items.length; i++) {
            const video = result.items[i];
            const url = video.videoUrl;
            const title = video.playlistTitle;
            server.queue.enqueue(url, enqueuedBy, new YouTubePlaylist(title));
        }

        return result.playlistTitle;
    }

    public static async determineMediaType(url): Promise<[MediaType, string]> {
        var mediaType: MediaType;
        return new Promise<[MediaType, string]>(async (resolve, reject) => {
            if (new RegExp(/watch\?v=/).test(url)) {
                mediaType = MediaType.yt_video;
                url =
                    "https://www.youtube.com/watch?v=" +
                    url
                        .match(/(?:v=)([^&?]*)/)
                        .toString()
                        .slice(2, 13);
            } else if (new RegExp(/youtu.be/).test(url)) {
                mediaType = MediaType.yt_video;
                url =
                    "https://www.youtube.com/watch?v=" +
                    url
                        .match(/(?:.be\/)([^&?]*)/)
                        .toString()
                        .slice(4, 15);
            } else if (new RegExp(/^[A-Za-z0-9-_]{11}$/).test(url)) {
                mediaType = MediaType.yt_video;
                url = "https://www.youtube.com/watch?v=" + url;
            } else if (new RegExp(/list=/).test(url)) {
                mediaType = MediaType.yt_playlist;
                url = url.match(/(?:list=)([^&?]*)/)[1].toString();
            } else {
                mediaType = MediaType.yt_search;
                url = "https://www.youtube.com/watch?v=" + await this.searchYoutube(url).catch(err => {
                    return reject(err);
                });
            }
            resolve([mediaType, url]);
        });
    }
}