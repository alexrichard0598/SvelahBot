import { AudioPlayer, AudioPlayerStatus } from "@discordjs/voice";
import { Guild, TextBasedChannel, TextBasedChannels } from "discord.js";
import { MediaQueue } from "./mediaQueue";
import { IMetadata } from "./metadata";

export class Server {
    server: Guild;
    queue: MediaQueue;
    audioPlayer: AudioPlayer;
    lastChannel: TextBasedChannels;

    constructor(server: Guild, queue?: MediaQueue, audioPlayer?: AudioPlayer, channel?: TextBasedChannels) {
        this.server = server;
        this.queue = queue !== undefined? queue : new MediaQueue();
        this.audioPlayer = audioPlayer !== undefined? audioPlayer: new AudioPlayer();
        this.audioPlayer.on("stateChange", async (oldState, newState) => {
            if (
              oldState.status === AudioPlayerStatus.Playing &&
              newState.status === AudioPlayerStatus.Idle
            ) {
              this.queue.dequeue();
              if (this.queue.hasMedia()) {
                this.audioPlayer.play(this.queue.currentItem());
                const meta = this.queue.currentItem().metadata as IMetadata;
                this.lastChannel.send(
                  "Now playing " + meta.title + " [" + meta.queuedBy + "]"
                );
              } else {
                this.lastChannel.send(
                  "Reached end of queue, stoped playing"
                );
              }
            }
          })
        this.lastChannel = channel !== undefined? channel : undefined;
    }
}