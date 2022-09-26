import path = require("path");
import { AudioPlayerStatus, AudioResource, createAudioResource, demuxProbe, getVoiceConnection } from "@discordjs/voice";
import { CommandInteraction, Guild, Message, MessageEmbed, TextBasedChannel, TextChannel } from "discord.js";
import { DiscordServer } from "../model/discordServer";
import * as youtubeSearch from "youtube-search";
import * as youtubeDL from "youtube-dl-exec"
const ytdl = youtubeDL.create("/bin/ytdlp");
import { IMetadata, Metadata } from "../model/metadata";
import { MediaQueue } from "../model/mediaQueue";
import { MediaType } from "../model/mediaType";
import { BotStatus } from "../model/botStatus";
import { YouTubePlaylist, PlayableResource } from "../model/youtube";
import { YouTubeSearchOptions, YouTubeSearchPageResults, YouTubeSearchResults } from "youtube-search";
import moment = require("moment");
let spotifyUri = require("spotify-uri");


export abstract class SharedMethods {
    private static servers: DiscordServer[] = new Array<DiscordServer>();

    public static async clearMessages(messages: Array<Message>, interaction?: CommandInteraction) {
        let embed: MessageEmbed;
        const server = messages.length > 0 ? await this.getServer(messages[0].guild) : undefined;
        if (messages.length > 0) {
            if (server.lastChannel instanceof TextChannel) {
                server.lastChannel.bulkDelete(messages);
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

    public static async retrieveBotMessages(channel: TextBasedChannel, exclude: string[] = []): Promise<Array<Message>> {
        let messages = new Array<Message>();
        (await channel.messages.fetch({ limit: 100 }, { force: true })).forEach(msg => {
            let oldestMsg = new Date();
            oldestMsg.setDate(oldestMsg.getDate() - 13);
            if (msg.author.id == "698214544560095362" && !exclude.includes(msg.id) && msg.createdAt > oldestMsg) {
                messages.push(msg);
            }
        });
        return messages;
    }

    public static async getServer(guild: Guild) {
        try {
            const foundServer = this.servers.find((s) => s.guild.id == guild.id);
            if (foundServer === undefined) {
                let newServer = new DiscordServer(guild);
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

    public static async searchYoutube(search: string, server: DiscordServer): Promise<string> {
        let opts: YouTubeSearchOptions = {
            maxResults: 1,
            key: process.env.GOOGLE_API,
        };

        server.updateStatusMessage(await server.lastChannel.send({ embeds: [new MessageEmbed().setDescription(`Searching youtube for "${search}"`)] }));

        return new Promise<string>((resolve, reject) => {
            youtubeSearch(search, opts).then((res: { results: YouTubeSearchResults[], pageInfo: YouTubeSearchPageResults }) => {
                const id: string = res.results[0].id;
                resolve(id);
            }).catch(err => {
                if (err) console.log(err);
                if (err.response.data.error.errors[0].reason == 'quotaExceeded') {
                    const time = this.getQuotaResetTime();
                    reject(new MessageEmbed().setTitle("Daily YouTube Search Limit Reached!").setDescription(`Limit will reset ${time.fromNow()}`));
                } else {
                    reject(err);
                }
            });
        });
    }

    public static async getMetadata(url: string, queuedBy: string, playlist: YouTubePlaylist): Promise<IMetadata> {
        const meta = new Metadata();

        try {
            const raw = await ytdl.raw(url, {
                dumpSingleJson: true,
                simulate: true,
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
        _queuedBy: string
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

        let audioResource: AudioResource;

        const { stream, type } = await demuxProbe(ytStream);
        audioResource = createAudioResource(stream, { inputType: type });

        return audioResource;
    }

    public static async createYoutubePlaylistResource(
        playlistId: string,
        enqueuedBy: string,
        server: DiscordServer
    ): Promise<Array<PlayableResource>> {

        const raw = await ytdl.raw(playlistId, {
            dumpSingleJson: true,
            simulate: true,
            flatPlaylist: true
        });

        const result = JSON.parse(raw.stdout);

        let playlist = new Array<PlayableResource>();

        for (const vid of result.entries) {
            const url = vid.url;
            const title = result.title;
            const meta = new Metadata();
            meta.title = vid.title;
            meta.length = vid.duration * 1000;
            meta.playlist = new YouTubePlaylist(title, result.entries.length) ;
            meta.queuedBy = enqueuedBy;

            playlist.push(new PlayableResource(url, meta));
        }

        return playlist;
    }

    public static async createSpotifyResource(_uri: string, _enqueuedBy: string, _server: DiscordServer): Promise<PlayableResource> {
        throw new Error("Method not implemented.");
    }

    public static async determineMediaType(url: string, server?: DiscordServer): Promise<[MediaType, string]> {
        let mediaType: MediaType;

        return new Promise<[MediaType, string]>(async (resolve, reject) => {
            if (new RegExp(/watch\?v=/).test(url)) {
                mediaType = MediaType.yt_video;
                url =
                    "https://www.youtube.com/watch?v=" +
                    url
                        .match(/(?:v=)([^&?]*)/)
                        .toString()
                        .slice(2, 13);
            } else if (new RegExp(/list=/).test(url)) {
                mediaType = MediaType.yt_playlist;
                url = url.match(/(?:list=)([^&?]*)/)[1].toString();
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
            } else if (new RegExp(/^[A-Za-z0-9-_]{34}$/).test(url)) {
                mediaType = MediaType.yt_playlist;
                url = "https://www.youtube.com/playlist?list=" + url;
            } else if (new RegExp(/spotify/).test(url)) {
                url = spotifyUri.formatURI(spotifyUri.parse(url));
                switch (url.split(":")[1]) {
                    case "track":
                        mediaType = MediaType.spotify_track;
                        break;
                    case "playlist":
                        mediaType = MediaType.spotify_playlist;
                        break;
                    default:
                        mediaType = MediaType.unknown;
                        break;
                }
            } else if (server != undefined) {
                mediaType = MediaType.yt_search;
                let id = await this.searchYoutube(url, server).catch(err => {
                    return reject(err);
                });
                url = "https://www.youtube.com/watch?v=" + id;
            }
            resolve([mediaType, url]);
        });
    }

    public static getQuotaResetTime() {
        let time = moment().hour(0).minute(0);
        if (time.isDST()) {
            time = time.add(1, 'day');
            time = time.utcOffset(-480);
        } else {
            time = time.add(1, 'day');
            time = time.utcOffset(-420);
        }
        return time;
    }

    public static getStatus(server: DiscordServer): BotStatus {
        if (server.audioPlayer.state.status == AudioPlayerStatus.Playing) {
            return BotStatus.PlayingMusic;
        } else if (getVoiceConnection(server.guild.id) !== undefined) {
            return BotStatus.InVC;
        } else {
            return BotStatus.Idle;
        }
    }
}