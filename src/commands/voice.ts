import { Discord, Guard, GuardFunction, Slash, SlashOption } from "discordx";
import { CommandInteraction, GuildMember, Message, MessageEmbed, MessagePayload } from "discord.js";
import { log } from "../logging";
import { AudioPlayer, AudioResource, createAudioPlayer, createAudioResource, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import path = require("path");
import ytdl = require("ytdl-core");
import { title } from "process";
import { IsAdmin } from "../guards/isAdmin";


@Discord()
export abstract class voice {

    player: AudioPlayer;

    @Slash("join", { description: "Join the voice channel you are currently connected to" })
    async join(interaction: CommandInteraction): Promise<void> {
        interaction.reply(await this.joinVC(interaction));
    }

    @Slash("disconect", { description: "Disconnect from the voice chanel" })
    @Slash("dc", { description: "Disconnect from the voice chanel" })
    async disconnect(interaction: CommandInteraction): Promise<void> {
        const connection = getVoiceConnection(interaction.guildId);
        if (connection === null) {
            interaction.reply("I'm not in any voice chats right now");
        } else {
            connection.disconnect();
            connection.destroy();
            interaction.reply("Disconnected 👋");
        }
    }

    @Slash("play", { description: "Plays music" })
    async play(@SlashOption("media", { description: "The media to play", required: true }) url: string,
        interaction: CommandInteraction): Promise<void> {

        var audioResource: AudioResource;
        var youtubeId: string;
        var title: String
        this.player = this.player === undefined ? createAudioPlayer() : this.player;
        var connection = getVoiceConnection(interaction.guildId);

        if (connection === undefined) {
            interaction.channel.send(await this.joinVC(interaction));
            connection = getVoiceConnection(interaction.guildId);
        }

        await interaction.deferReply()


        if (url === "$test") {
            audioResource = createAudioResource(path.join(__dirname, '..', 'sample', 'Southern Nights.mp3'));
            title = "Southern Nights";
        } else if (new RegExp(/watch\?v=/).test(url)) {
            youtubeId = url.match(/(?:v=)([^&?]*)/).toString().slice(2, 13);
        } else if (new RegExp(/youtu.be/).test(url)) {
            youtubeId = url.match(/(?:.be\/)([^&?]*)/).toString().slice(4, 15);
        } else if (new RegExp(/^[A-Za-z0-9-_]{11}$/).test(url)) {
            youtubeId = url;
        } else {
            interaction.editReply("No valid youtube video was found");
            return;
        }

        if (youtubeId !== undefined) {
            const stream = ytdl(`https://www.youtube.com/watch?v=${youtubeId}`, { filter: 'audioonly', quality: 'highestaudio' });
            audioResource = createAudioResource(stream);
            title = (await ytdl.getInfo(`https://www.youtube.com/watch?v=${youtubeId}`)).videoDetails.title;

        }

        if (!this.player.playable.includes(connection)) {
            connection.subscribe(this.player);
        }

        this.player.play(audioResource);

        interaction.editReply("Now playing " + title)
    }

    @Slash('stop', { description: 'Stops any currently playing track' })
    async stop(interaction: CommandInteraction) {
        var connection = getVoiceConnection(interaction.guildId);

        if (connection === undefined) {
            interaction.reply('Not currently connected to any Voice Channels');
        } else if (connection.state.status === VoiceConnectionStatus.Disconnected) {
            interaction.reply('Not currently playing anything');
        } else {
            this.player.stop;
        }

    }

    @Slash('ping', {description: "Returns the ping of the current voice connection"})
    async ping(interaction: CommandInteraction): Promise<void> {
        if(getVoiceConnection(interaction.guildId) === undefined) {
            interaction.reply("I'm not currently in an voice channels");
        } else {
            interaction.reply("My ping is " + getVoiceConnection(interaction.guildId).ping.udp + 'ms')
        }
    }
    
    private async joinVC(interaction: CommandInteraction): Promise<string> {
        const guildMember = await interaction.guild.members.fetch(interaction.user);
        const vc = guildMember.voice.channel
        if (vc === null) {
            return "You are not part of a voice chat, please join a voice chat first.";
        } else {
            await joinVoiceChannel({
                channelId: vc.id,
                guildId: vc.guildId,
                adapterCreator: vc.guild.voiceAdapterCreator,
            });
            return "Joined " + vc.name;
        }
    }
}