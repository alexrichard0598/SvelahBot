import path = require("path");
import { AudioPlayerStatus, AudioResource, createAudioResource, demuxProbe, getVoiceConnection } from "@discordjs/voice";
import { CommandInteraction, Guild, Message, EmbedBuilder, TextBasedChannel, TextChannel, userMention } from "discord.js";
import { VolfbotServer } from "../model/VolfbotServer";
import { log } from "../logging"
import * as youtubeSearch from "youtube-search";
import * as youtubeDL from "youtube-dl-exec"
const youtubeDownloader = youtubeDL.create("/bin/ytdlp");
import { IMetadata, Metadata } from "../model/Metadata";
import { MediaQueue } from "../model/MediaQueue";
import { MediaType } from "../model/MediaType";
import { BotStatus } from "../model/BotStatus";
import { YouTubePlaylist, PlayableResource } from "../model/PlayableResource";
import { YouTubeSearchOptions, YouTubeSearchPageResults, YouTubeSearchResults } from "youtube-search";
import moment = require("moment");
import { getClient } from "../app";


export abstract class SharedMethods {
    private static servers: VolfbotServer[] = new Array<VolfbotServer>();

    public static async clearMessages(messages: Array<Message>, interaction?: CommandInteraction) {
        let embed: EmbedBuilder;
        const server = messages.length > 0 ? await this.getServer(messages[0].guild) : undefined;
        if (messages.length > 0) {
            if (server.lastChannel instanceof TextChannel) {
                server.lastChannel.bulkDelete(messages);
                embed = new EmbedBuilder().setDescription("Messages deleted");
            } else {
                embed = new EmbedBuilder().setDescription("Cannot delete messages");
            }
        } else {
            embed = new EmbedBuilder().setDescription("No messages to delete");
        }

        if (interaction) {
            interaction.editReply({ embeds: [embed] });
        } else if (server) {
            server.lastChannel.send({ embeds: [embed] });
        }
    }

    public static async retrieveBotMessages(channel: TextBasedChannel, exclude: string[] = []): Promise<Array<Message>> {
        let messages = new Array<Message>();
        (await channel.messages.fetch({ limit: 100, cache: false })).forEach(msg => {
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
                let newServer = new VolfbotServer(guild);
                this.servers.push(newServer);
                return newServer;
            }
            return foundServer;
        } catch (error) {
            this.handleError(error, guild);
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

    public static async handleError(error: Error, guild: Guild) {
        const embed = new EmbedBuilder();
        const server = await this.getServer(guild);
        embed.setTitle("Error!");
        embed.setDescription(`${error.message}\r\n\`\`\`${error.stack}\`\`\`\r\n**Please let the developer know**`);
        if (server.lastChannel !== undefined) server.lastChannel.send({ embeds: [embed] });
        log.error(error);

        embed.setDescription(embed.data.description);

        const botDevChannel = (await (await getClient().guilds.fetch('664999986974687242')).channels.fetch('888174462011342848')) as TextBasedChannel;
        botDevChannel.send({embeds: [embed], content: userMention('134131441175887872')});
    }

    public static async searchYoutube(search: string, server: VolfbotServer): Promise<string> {
        let opts: YouTubeSearchOptions = {
            maxResults: 1,
            key: process.env.GOOGLE_API,
        };

        server.updateStatusMessage(await server.lastChannel.send({ embeds: [new EmbedBuilder().setDescription(`Searching youtube for "${search}"`)] }));

        return new Promise<string>((resolve, reject) => {
            youtubeSearch(search, opts).then((res: { results: YouTubeSearchResults[], pageInfo: YouTubeSearchPageResults }) => {
                const id: string = res.results[0].id;
                resolve(id);
            }).catch(error => {
                if (error) console.log(error);
                if (error.response.data.error.errors[0].reason == 'quotaExceeded') {
                    const time = this.getQuotaResetTime();
                    reject(new EmbedBuilder().setTitle("Daily YouTube Search Limit Reached!").setDescription(`Limit will reset ${time.fromNow()}`));
                } else {
                    reject(error);
                }
            });
        });
    }

    public static async getMetadata(url: string, queuedBy: string, server: VolfbotServer, playlist?: YouTubePlaylist): Promise<IMetadata> {
        const meta = new Metadata();
        try {
            const exec = await youtubeDownloader.exec(url, {
                output: "./tmp",
                dumpSingleJson: true,
                simulate: true,
            });

            const details = JSON.parse(exec.stdout);

            meta.title = details.title;
            meta.length = details.duration * 1000;
            meta.queuedBy = queuedBy;
            meta.playlist = playlist ? playlist : null;
        } catch (error) {
            this.handleError(error, server.guild);
        }

        return meta;
    }

    public static async createYoutubeResource(
        url: string,
        _queuedBy: string
    ): Promise<AudioResource<unknown>> {
        const exec = youtubeDownloader.exec(
            url,
            {
                output: "-",
                quiet: true,
                format: "bestaudio[ext=webm][acodec=opus][asr=48000]",
                limitRate: "100k",
            },
            { stdio: ["ignore", "pipe", "ignore"] }
        );
        const ytStream = exec.stdout;

        let audioResource: AudioResource;

        const { stream, type } = await demuxProbe(ytStream);
        audioResource = createAudioResource(stream, { inputType: type });

        return audioResource;
    }

    public static async createYoutubePlaylistResource(
        playlistId: string,
        enqueuedBy: string,
        server: VolfbotServer
    ): Promise<Array<PlayableResource>> {

        const exec = await youtubeDownloader.exec(playlistId, {
            dumpSingleJson: true,
            simulate: true,
            flatPlaylist: true
        });

        const result = JSON.parse(exec.stdout);

        let playlist = new Array<PlayableResource>();

        for (let i = 0; i < result.entries.length; i++) {
            const vid = result.entries[i];

            const url = vid.url;
            const title = result.title;
            const meta = new Metadata();
            meta.title = vid.title;
            meta.length = vid.duration * 1000;
            meta.playlist = new YouTubePlaylist(title, result.entries.length, playlistId, server);
            meta.queuedBy = enqueuedBy;

            let media = new PlayableResource(server, url, meta);
            media.id = media.id + `${i}`;
            playlist.push(media);
        }

        return playlist;
    }

    public static async determineMediaType(url: string, server?: VolfbotServer): Promise<[MediaType, string]> {
        let mediaType: MediaType;

        return new Promise<[MediaType, string]>(async (resolve, reject) => {
            if (new RegExp(/list=/).test(url)) {
                mediaType = MediaType.yt_playlist;
                url = url.match(/(?:list=)([^&?]*)/)[1].toString();
            } else if (new RegExp(/watch\?v=/).test(url)) {
                mediaType = MediaType.yt_video;
                url = "https://www.youtube.com/watch?v=" + url.match(/(?:v=)([^&?]*)/).toString().slice(2, 13);
            } else if (new RegExp(/youtu\.be/).test(url)) {
                mediaType = MediaType.yt_video;
                url = "https://www.youtube.com/watch?v=" + url.match(/(?:.be\/)([^&?]*)/).toString().slice(4, 15);
            } else if (new RegExp(/^[A-Za-z0-9-_]{11}$/).test(url)) {
                mediaType = MediaType.yt_video;
                url = "https://www.youtube.com/watch?v=" + url;
            } else if (new RegExp(/^[A-Za-z0-9-_]{34}$/).test(url)) {
                mediaType = MediaType.yt_playlist;
                url = "https://www.youtube.com/playlist?list=" + url;
            } else if (server != undefined) {
                mediaType = MediaType.yt_search;
                let id = await this.searchYoutube(url, server).catch(error => {
                    return reject(error);
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

    public static getStatus(server: VolfbotServer): BotStatus {
        if (server.audioPlayer.state.status == AudioPlayerStatus.Playing) {
            return BotStatus.PlayingMusic;
        } else if (getVoiceConnection(server.guild.id) !== undefined) {
            return BotStatus.InVC;
        } else {
            return BotStatus.Idle;
        }
    }

    public static async nowPlayingEmbed(server: VolfbotServer): Promise<EmbedBuilder> {
        const nowPlaying: PlayableResource = await server.queue.currentItem();
        let embed: EmbedBuilder;
        if (server.audioPlayer.state.status !== AudioPlayerStatus.Playing) {
            embed = new EmbedBuilder().setTitle("Now Playing").setDescription(" ");
        }
        else if (nowPlaying == undefined) {
            embed = new EmbedBuilder().setTitle("Now Playing").setDescription(" ");
        } else {
            const metadata: Metadata = nowPlaying.meta;
            let playbackDuration = server.audioPlayer.state.playbackDuration;
            const playbackDurationDate = new Date(playbackDuration);
            let durationString;
            if (playbackDurationDate.getUTCHours() > 0) {
                durationString = `${playbackDurationDate.getUTCHours()}:${('0' + playbackDurationDate.getUTCMinutes()).slice(-2)}:${('0' + playbackDurationDate.getUTCSeconds()).slice(-2)}`;
            } else {
                durationString = `${playbackDurationDate.getUTCMinutes()}:${('0' + playbackDurationDate.getUTCSeconds()).slice(-2)}`;
            }

            const length = metadata.length;
            const lengthDate = new Date(length);
            let lengthString;
            if (playbackDurationDate.getUTCHours() > 0) {
                lengthString = `${lengthDate.getUTCHours()}:${('0' + lengthDate.getUTCMinutes()).slice(-2)}:${('0' + lengthDate.getUTCSeconds()).slice(-2)}`;
            } else {
                lengthString = `${lengthDate.getUTCMinutes()}:${('0' + lengthDate.getUTCSeconds()).slice(-2)}`;
            }
            const percentPlayed: number = Math.ceil((playbackDuration / length) * 100);
            let msg = `[${metadata.title}](${nowPlaying.url}) [${metadata.queuedBy}]\n\n`;
            for (let i = 0; i < 33; i++) {
                if (percentPlayed / 3 >= i) {
                    msg += '█';
                } else {
                    msg += '░';
                }
            }
            msg += ` [${durationString}/${lengthString}]`;
            embed = new EmbedBuilder().setTitle("Now Playing").setDescription(msg);
        }
        return embed;
    }
}
