import { Discord, Slash } from "discordx";
import {
  CommandInteraction,
  Message,
  MessageEmbed,
  MessagePayload,
} from "discord.js";
import { log } from "../logging";

@Discord()
export abstract class hello_world {
  @Slash("hello", { description: "A hello world message" })
  async hello(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Hello world!").catch((err) => {
      log.error(err);
    });
  }

  @Slash("heya", { description: "Replies to the user" })
  async heya(interaction: CommandInteraction): Promise<void> {
    interaction.reply("Heya " + interaction.user.username).catch((err) => {
      log.error(err);
    });

    const knownUsers = new Map<string, string>([
      [
        "134131441175887872",
        "Hi master, what can I do for you? :service_dog: ",
      ], //Me
      [
        "295383341656440844",
        "I heard you tried to have me burned. Every wonder what that must be like? :fire: :fire: :fire: ",
      ], //Josh
      [
        "121801675647221762",
        "Hello Mister Bear~ Would you like some honey roasted salmon? :bear: ",
      ], //Kyle
      [
        "247155941164843021",
        `:flag_fr: :flag_fr: :flag_fr:
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
            Felix Caeli Porta`,
      ], // Tobasco
      ["191896494209499137", "Have a frog in this trying times :frog: "], //Jackson
      [
        "599300158215421972",
        "Talon Silverwing is the greatest adventurer of all time :duck: ",
      ], //Korey
      [
        "222870538849222656",
        "Thicc thighs goth girls are all the rage now :black_heart: ",
      ], //Kendra
      [
        "224022759292796928",
        "Long live President Eden, long live the Enclave! :military_helmet: ",
      ], //Hetzer
    ]);

    if (knownUsers.has(interaction.user.id)) {
      var msg = new MessageEmbed();
      msg.addField(
        "🤖User Recognized🤖",
        `
            
            ${knownUsers.get(interaction.user.id)}`
      );
      interaction.followUp({ embeds: [msg] }).catch((err) => {
        log.error(err);
      });
    }
  }
}
