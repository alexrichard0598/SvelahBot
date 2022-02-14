import path = require("path");
import { AudioPlayerStatus, AudioResource, createAudioResource, demuxProbe, getVoiceConnection, StreamType, VoiceConnectionStatus } from "@discordjs/voice";
import { CommandInteraction, Guild, Message, MessageEmbed, TextBasedChannel, TextChannel } from "discord.js";
import { Server } from "../model/server";
import * as fs from 'fs';
import * as youtubeSearch from "youtube-search";
import * as youtubeDL from "youtube-dl-exec"
const ytdl = youtubeDL.create(path.join(__dirname, "../ytdl/yt-dlp"));
import { IMetadata, Metadata } from "../model/metadata";
import { MediaQueue } from "../model/mediaQueue";
import { MediaType } from "../model/mediaType";
import { YouTubePlaylist, YouTubeVideo } from "../model/youtube";
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

    public static async DisconnectBot(server: Server, excludedMessages: string[] = []) {
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
                    if (
                        newState.status == AudioPlayerStatus.Idle
                        && connection.state.status !== VoiceConnectionStatus.Disconnected
                        && connection.state.status !== VoiceConnectionStatus.Destroyed
                    ) {
                        connection.disconnect();
                        connection.destroy();
                    }
                })

                const deleting = await server.lastChannel.send("Cleaning up after disconnect");
                server.audioPlayer.play(sound);
                if (server.lastChannel) {
                    this.ClearMessages(await this.retrieveBotMessages(server.lastChannel, excludedMessages.concat(deleting.id)));
                }
            }
        } catch (error) {
            this.handleErr(error, server.guild);
        }

    }

    public static async retrieveBotMessages(channel: TextBasedChannel, exclude: string[] = []): Promise<Array<Message>> {
        var messages = new Array<Message>();
        await (await channel.messages.fetch({ limit: 100 }, { force: true })).forEach(msg => {
            var oldestMsg = new Date();
            oldestMsg.setDate(oldestMsg.getDate() - 13);
            if (msg.author.id == "698214544560095362" && !exclude.includes(msg.id) && msg.createdAt > oldestMsg) {
                messages.push(msg)
            }
        });
        return messages;
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
            console.log(error);
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
            youtubeSearch(search, opts).then((res: { results: YouTubeSearchResults[], pageInfo: YouTubeSearchPageResults }) => {
                const id: string = res.results[0].id;
                resolve(id);
            }).catch(err => reject(err));
        });
    }

    public static async getMetadata(url: string, queuedBy: string, playlist: YouTubePlaylist): Promise<IMetadata> {
        const meta = await new Metadata();

        try {

            const raw = await ytdl.raw(url, {
                dumpSingleJson: true,
                simulate: true
            });

            const details = JSON.parse(raw.stdout);

            meta.title = details.title;
            meta.length = details.duration * 1000;
            meta.queuedBy = queuedBy;
            meta.playlist = playlist;

        } catch (error) {
            if (!(error.message as string).includes("Command failed")) {
                throw error;
            }
        }

        return meta;
    }

    public static async createYoutubeResource(
        url: string,
        queuedBy: string
    ): Promise<AudioResource<unknown>> {
        const ytStream = ytdl.raw(
            url,
            {
                output: "-",
                quiet: true,
                format: "bestaudio[ext=webm][acodec=opus][asr=48000]",
                limitRate: "100k",

            },
            { stdio: ["ignore", "pipe", "ignore"] }
        ).stdout;

        var audioResource: AudioResource;

        const { stream, type } = await demuxProbe(ytStream);
        audioResource = createAudioResource(stream, { inputType: type });

        return audioResource;
    }

    public static async createYoutubePlaylistResource(
        playlistId: string,
        enqueuedBy: string,
        server: Server
    ): Promise<YouTubeVideo> {

        // const result = JSON.parse(await youtubeDlWrap.execPromise([
        //     playlistId, "-i",
        //     "-q", "--no-warnings",
        //     "--flat-playlist", "--dump-single-json",
        // ]));

        const raw = await ytdl.raw(playlistId, {
            dumpSingleJson: true,
            simulate: true,
            flatPlaylist: true
        });

        const result = JSON.parse(raw.stdout);

        var video: YouTubeVideo;

        for (let i = 0; i < result.entries.length; i++) {
            const vid = result.entries[i];
            const url = vid.url;
            const title = result.title;
            const meta = new Metadata();
            meta.title = vid.title;
            meta.length = vid.duration * 1000;
            meta.playlist = title;
            meta.queuedBy = enqueuedBy;

            if (i == 0) {
                video = await server.queue.enqueue(url, enqueuedBy, meta);;
            } else {
                server.queue.enqueue(url, enqueuedBy, meta);
            }
        }

        return video;
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