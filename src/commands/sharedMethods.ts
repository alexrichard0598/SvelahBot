import Collection from "@discordjs/collection";
import { AudioPlayerStatus, AudioResource, createAudioResource, getVoiceConnection, VoiceConnection } from "@discordjs/voice";
import { CommandInteraction, Guild, Interaction, Message } from "discord.js";
import { Server } from "../model/server";
import * as fs from 'fs';

export abstract class SharedMethods {
    public static async ClearMessages(messages: Array<Message>, statusMessage: Message, interaction?: CommandInteraction) {
        var deletedCount = 0;
        var etas = new Array<number>();
        const startTime = Date.now();

        messages = messages.filter(msg => msg.id != statusMessage.id);

        messages.forEach((msg) => {
            msg.delete();
            deletedCount++;
            etas.push(((Date.now() - startTime) / deletedCount * (messages.length - deletedCount)) / 1000);
            if (interaction) {
                interaction.editReply(`${deletedCount}/${messages.length} mesages deleted. ETA: ${Math.round(etas.reduce((a, b) => a + b) / etas.length)} seconds`);
            } else {
                statusMessage.edit(`${deletedCount}/${messages.length} mesages deleted. ETA: ${Math.round(etas.reduce((a, b) => a + b) / etas.length)} seconds`);
            }

            if (messages.indexOf(msg) == messages.length - 1) {
                statusMessage.delete();
            }
        });
    }

    public static async DisconnectBot(server: Server) {
        await server.queue.clear();
        var stream = await fs.createReadStream('./src/assets/sounds/volfbot-disconnect.mp3');
        const sound = await createAudioResource(stream);
        await server.audioPlayer.play(sound);
        const connection = getVoiceConnection(server.guild.id);

        if (!server.audioPlayer.playable.includes(connection)) {
            connection.subscribe(server.audioPlayer);
        }
        
        server.audioPlayer.on("stateChange", (oldState, newState) => {
            if (newState.status == AudioPlayerStatus.Idle) {
                connection.disconnect();
                connection.destroy();
            }
        })

    }


}