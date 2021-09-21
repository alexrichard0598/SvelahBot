import { Guild, TextBasedChannels } from "discord.js";

export class ServerChannel {
    server: Guild;
    channel: TextBasedChannels;

    constructor(serv: Guild, channel: TextBasedChannels) {
        this.server = serv;
        this.channel = channel;
    }
}