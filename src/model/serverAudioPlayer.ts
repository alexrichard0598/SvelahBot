import { AudioPlayer } from "@discordjs/voice"
import { Guild } from "discord.js";

export class ServerAudioPlayer extends AudioPlayer {
    server: Guild;

    constructor(serv: Guild) {
        super();
        this.server = serv;
    }
}