import { Discord, Slash } from "discordx";
import { CommandInteraction, GuildMember, Message, MessageEmbed, MessagePayload } from "discord.js";
import { log } from "../logging";
import { AudioResource, createAudioPlayer, createAudioResource, getVoiceConnection, joinVoiceChannel } from "@discordjs/voice";
import path = require("path");


@Discord()
export abstract class voice {

    @Slash("join", { description: "Join the voice channel you are currently connected to" })
    async join(interaction: CommandInteraction): Promise<void> {
        this.joinVC(interaction);
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
    async play(interaction: CommandInteraction): Promise<void> {
        const player = createAudioPlayer();
        var connection = getVoiceConnection(interaction.guildId);

        if (connection === undefined) {
            await this.joinVC(interaction);
            connection = getVoiceConnection(interaction.guildId);
        }

        var sampleSong = createAudioResource(path.join(__dirname, '..', 'sample', 'Southern Nights.mp3'));

        connection.subscribe(player);
        player.play(sampleSong);
    }

    private async joinVC(interaction: CommandInteraction) {
        const guildMember = await interaction.guild.members.fetch(interaction.user);
        const vc = guildMember.voice.channel
        if (vc === null) {
            interaction.reply("You are not part of a voice chat, please join a voice chat first.");
        } else {
            joinVoiceChannel({
                channelId: vc.id,
                guildId: vc.guildId,
                adapterCreator: vc.guild.voiceAdapterCreator,
            });
            interaction.reply("Joined " + vc.name);
        }
    }
}