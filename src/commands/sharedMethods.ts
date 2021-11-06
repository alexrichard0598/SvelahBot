import Collection from "@discordjs/collection";
import { AudioPlayerStatus, AudioResource, createAudioResource, getVoiceConnection, StreamType, VoiceConnection } from "@discordjs/voice";
import { CommandInteraction, Guild, Interaction, Message, MessageEmbed, TextChannel } from "discord.js";
import { Server } from "../model/server";
import * as fs from 'fs';
import youtubeSearch = require("youtube-search");
const PlaylistSummary = require("youtube-playlist-summary");
const ytdlExec = require("youtube-dl-exec").raw;
import ytdl = require("ytdl-core");
import { IMetadata, Metadata } from "../model/metadata";
import { MediaQueue } from "../model/mediaQueue";

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

            if (!server.audioPlayer.playable.includes(connection)) {
                await connection.subscribe(server.audioPlayer);
            }

            await server.audioPlayer.on("stateChange", (oldState, newState) => {
                if (newState.status == AudioPlayerStatus.Idle) {
                    connection.disconnect();
                    connection.destroy();
                }
            })

            server.audioPlayer.play(sound);
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
        embed.title = "An error has occurred";
        embed.description = err.message.toString();
        if (server.lastChannel !== undefined)
            server.lastChannel.send({ embeds: [embed] });
        console.log(err);
    }

    public static async searchYoutube(search: string, guild: Guild): Promise<string> {
        var opts: youtubeSearch.YouTubeSearchOptions = {
            maxResults: 1,
            key: process.env.GOOGLE_API,
        };
        var res = await youtubeSearch(search, opts).then((results) => results).catch(err => { SharedMethods.handleErr(err, guild); return null; });
        if (res != null) {
            return res.results[0].id;
        }
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
        const metadata: IMetadata = new Metadata();
        const details = await ytdl.getInfo(url);
        metadata.title = details.videoDetails.title;
        metadata.length = parseInt(details.videoDetails.lengthSeconds) * 1000;
        metadata.url = url;
        metadata.queuedBy = queuedBy;
        audioResource.metadata = metadata;
        return audioResource;
    }

    public static async createYoutubePlaylistResource(
        playlistId: string,
        queuedBy: string,
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
            var audioResource: AudioResource;
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
            audioResource = createAudioResource(stream.stdout, { inputType: StreamType.WebmOpus });
            const metadata: IMetadata = new Metadata();
            const details = await ytdl.getInfo(url);
            metadata.title = details.videoDetails.title;
            metadata.length = parseInt(details.videoDetails.lengthSeconds) * 1000;
            metadata.url = url;
            metadata.queuedBy = queuedBy;
            audioResource.metadata = metadata;
            server.queue.enqueue(audioResource);
        }

        return result.playlistTitle;
    }


}