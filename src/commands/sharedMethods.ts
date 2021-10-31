import Collection from "@discordjs/collection";
import { Message } from "discord.js";

export abstract class SharedMethods {
    public static async ClearMessages(messages: Array<Message>, statusMessage: Message) {
        var deletedCount = 0;
        var etas = new Array<number>();
        const startTime = Date.now();

        messages = messages.filter(msg => msg.id != statusMessage.id);

        messages.forEach(async (msg) => {
            await msg.delete();
            await deletedCount++;
            etas.push(((Date.now() - startTime) / deletedCount * (messages.length - deletedCount)) / 1000);
            await statusMessage.edit(`${deletedCount}/${messages.length} mesages deleted. ETA: ${Math.round(etas.reduce((a, b) => a + b) / etas.length)} seconds`);
            if (messages.indexOf(msg) == messages.length - 1) {
                await statusMessage.delete();
            }
        });

        
    }


}