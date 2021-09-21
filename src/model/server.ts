import { AudioPlayer } from "@discordjs/voice";
import { Guild, TextBasedChannel, TextBasedChannels } from "discord.js";
import { MediaQueue } from "./mediaQueue";

export class Server {
    server: Guild;
    queue: MediaQueue;
    audioPlayer: AudioPlayer;
    lastChannel: TextBasedChannels;

    constructor(server: Guild, queue?: MediaQueue, audioPlayer?: AudioPlayer, channel?: TextBasedChannels) {
        this.server = server;
        this.queue = queue === undefined? queue : new MediaQueue();
        this.audioPlayer = audioPlayer === undefined? audioPlayer: new AudioPlayer();
        this.lastChannel = channel === undefined? channel : undefined;
    }
}