import { Discord, Slash } from "@typeit/discord";

@Discord()
abstract class SvelahBot {
    
    @Slash("Hello Svelah")
    private hello() {
        console.log("Hello world!")
    }
}