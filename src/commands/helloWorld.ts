import { Discord, Slash } from "discordx";
import { CommandInteraction, Message, MessageEmbed, MessagePayload } from "discord.js";
import { log } from "../logging";


@Discord()
export abstract class hello_world {

    @Slash("hello", { description: "A hello world message" })
    async hello(interaction: CommandInteraction): Promise<void> {
        interaction.reply('Hello world!').catch(err => {
            log.error(err);
        });
    }


    @Slash('heya', { description: "Replies to the user" })
    async heya(interaction: CommandInteraction): Promise<void> {
        interaction.reply('Heya ' + interaction.user.username).catch(err => {
            log.error(err);
        });

        const knownUsers = new Map<string, string>([
            ['134131441175887872', "Hi master, what can I do for you? 🐶"], //Me
            ['295383341656440844', "Gaze into the abyss which are my eyes and see as all you love burns 🔥🔥🔥"], //Josh
            ['121801675647221762', "Hello Mister Bear~ Would you like some honed salmon? 🍯🐟"], //Kyle
            ['247155941164843021', // Tobasco
            `
            :flag_fr: :flag_fr: :flag_fr:
            Ave, maris stella
            Dei mater alma
            atque semper virgo
            felix Caeli porta

            Acadie ma patrie
            À ton nom je me lie
            Ma vie, ma foi sont à toi
            Tu me protégeras
            
            Acadie ma patrie
            Ma terre et mon défi
            De près, de loin tu me tiens
            Mon cœur est acadien
            
            Acadie ma patrie
            Ton histoire je la vis
            La fierté je te la dois
            En l’avenir je crois
            
            Ave Maris Stella
            Dei Mater Alma
            Atque Semper Virgo
            Felix Caeli Porta`]
        ]);

        if (knownUsers.has(interaction.user.id)) {
            var msg = new MessageEmbed;
            msg.addField('🤖User Recognized🤖', `
            
            ${knownUsers.get(interaction.user.id)}`);
            interaction.followUp({ embeds: [msg] }).catch(err => {
                log.error(err);
            });
        }
    }
}