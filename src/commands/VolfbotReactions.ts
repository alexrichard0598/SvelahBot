import { ArgsOf, Client, Discord, On } from "discordx";

@Discord()
abstract class VolfbotReactions {
  @On({event: "messageReactionAdd"})
  private async reactionAdded([reaction, user]: ArgsOf<"messageReactionAdd">, client: Client) {
    //TODO: Figure this shit out
  }
}