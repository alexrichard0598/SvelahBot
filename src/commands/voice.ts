import { Discord, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  Message,
  MessageEmbed,
  TextBasedChannels,
} from "discord.js";
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";
//const YoutubeDlWrap = require("youtube-dl-wrap");
const ytdlExec = require("youtube-dl-exec").raw;
import { MediaQueue } from "../model/mediaQueue";
import { IMetadata, Metadata } from "../model/metadata";
import path = require("path");
import ytdl = require("ytdl-core");
import { Readable } from "stream";

@Discord()
export abstract class voice {
  player: AudioPlayer;
  queue: MediaQueue;
  lastChannel: TextBasedChannels;
  statusMsg: Message;

  @Slash("join", {
    description: "Join the voice channel you are currently connected to",
  })
  async join(interaction: CommandInteraction): Promise<void> {
    try {
      interaction.reply(await this.joinVC(interaction));
      this.lastChannel = interaction.channel;
    } catch (error) {
      this.handleErr(error);
    }
  }

  @Slash("disconect", { description: "Disconnect from the voice chanel" })
  @Slash("dc", { description: "Disconnect from the voice chanel" })
  async disconnect(interaction: CommandInteraction): Promise<void> {
    try {
      this.lastChannel = interaction.channel;
      const connection = getVoiceConnection(interaction.guildId);
      if (connection === null) {
        interaction.reply("I'm not in any voice chats right now");
      } else {
        connection.disconnect();
        connection.destroy();
        interaction.reply("Disconnected 👋");
      }
    } catch (error) {
      this.handleErr(error);
    }
  }

  @Slash("play", { description: "Plays music" })
  async play(
    @SlashOption("media", { description: "The media to play", required: true })
    url: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      this.lastChannel = interaction.channel;
      var audioResource: AudioResource;
      var youtubeId: string;
      const embed = new MessageEmbed();

      if (this.player === undefined) {
        this.player = createAudioPlayer();
        this.player.on("stateChange", async (oldState, newState) => {
          if (
            oldState.status === AudioPlayerStatus.Playing &&
            newState.status === AudioPlayerStatus.Idle
          ) {
            this.queue.dequeue();
            if (this.queue.hasMedia()) {
              this.player.play(this.queue.currentItem());
              const meta = this.queue.currentItem().metadata as IMetadata;
              if (this.statusMsg !== undefined) this.statusMsg.delete();
              this.statusMsg = await this.lastChannel.send(
                "Now playing " + meta.title + " [" + meta.queuedBy + "]"
              );
            } else {
              if (this.statusMsg !== undefined) this.statusMsg.delete();
              this.statusMsg = await this.lastChannel.send(
                "Reached end of queue, stoped playing"
              );
            }
          }
        });
      }
      var connection = getVoiceConnection(interaction.guildId);

      if (connection === undefined) {
        interaction.channel.send(await this.joinVC(interaction));
        connection = getVoiceConnection(interaction.guildId);
      }

      await interaction.deferReply();

      if (new RegExp(/watch\?v=/).test(url)) {
        youtubeId = url
          .match(/(?:v=)([^&?]*)/)
          .toString()
          .slice(2, 13);
      } else if (new RegExp(/youtu.be/).test(url)) {
        youtubeId = url
          .match(/(?:.be\/)([^&?]*)/)
          .toString()
          .slice(4, 15);
      } else if (new RegExp(/^[A-Za-z0-9-_]{11}$/).test(url)) {
        youtubeId = url;
      } else {
        embed.description = "No valid youtube video was found";
        interaction.editReply({ embeds: [embed] });
        return;
      }

      if (youtubeId !== undefined) {
        const url = `https://www.youtube.com/watch?v=${youtubeId}`;
        const stream = ytdlExec(
          url,
          {
            o: "-",
            q: "",
            f: "bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio",
            r: "100k",
          },
          { stdio: ["ignore", "pipe", "ignore"] }
        );
        // const stream = ytdl(url, {
        //   filter: "audioonly",
        //   quality: "highestaudio",
        // });
        audioResource = createAudioResource(stream.stdout);
        const metadata: IMetadata = new Metadata();
        const details = await ytdl.getInfo(url);
        //const details = await ytDlWrap.getVideoInfo(url);
        metadata.title = details.videoDetails.title;
        metadata.length = parseInt(details.videoDetails.lengthSeconds);
        metadata.url = url;
        metadata.queuedBy = (
          await interaction.guild.members.fetch(interaction.user.id)
        ).displayName;
        audioResource.metadata = metadata;
      }

      if (!this.player.playable.includes(connection)) {
        connection.subscribe(this.player);
      }

      if (this.queue === undefined) {
        this.queue = new MediaQueue();
      }

      this.queue.enqueue(audioResource);

      if (this.player.state.status !== AudioPlayerStatus.Playing) {
        const media = this.queue.currentItem();
        this.player.play(media);
        var meta = media.metadata as IMetadata;
        embed.description =
          "Now playing " + meta.title + " [" + meta.queuedBy + "]";
      } else {
        embed.description =
          (audioResource.metadata as IMetadata).title + " queued";
      }

      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.handleErr(error);
    }
  }

  @Slash("stop", { description: "Stops playback and clears queue" })
  @Slash("clear", { description: "Stops playback and clears queue" })
  async stop(interaction: CommandInteraction) {
    try {
      this.lastChannel = interaction.channel;
      var connection = getVoiceConnection(interaction.guildId);

      if (connection === undefined) {
        interaction.reply("Not currently connected to any Voice Channels");
      } else if (this.player.state.status === AudioPlayerStatus.Idle) {
        interaction.reply("Nothing is currently queued");
      } else {
        this.player.stop();
        interaction.reply("Playback stopped");
        this.queue.clear();
      }
    } catch (error) {
      this.handleErr(error);
    }
  }

  @Slash("resume", { description: "Plays music" })
  async resume(interaction: CommandInteraction): Promise<void> {
    try {
      const embed = new MessageEmbed();
      await interaction.deferReply();
      this.lastChannel = interaction.channel;
      if (this.player.state.status === AudioPlayerStatus.Paused) {
        this.player.unpause();
        embed.description = "Resumed queue";
      } else if (this.player.state.status === AudioPlayerStatus.Idle) {
        embed.description = "No audio queued up";
      } else {
        embed.description = "Cannot resume queue";
      }
      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.handleErr(error);
    }
  }

  @Slash("pause", { description: "Plays music" })
  async pause(interaction: CommandInteraction): Promise<void> {
    try {
      const embed = new MessageEmbed();
      await interaction.deferReply();
      this.lastChannel = interaction.channel;
      if (this.player.state.status === AudioPlayerStatus.Playing) {
        this.player.pause();
        embed.description = "Paused playback";
      } else if (this.player.state.status === AudioPlayerStatus.Idle) {
        embed.description = "No audio queued up";
      } else {
        embed.description = "Cannot pause";
      }
      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.handleErr(error);
    }
  }

  @Slash("ping", {
    description: "Returns the ping of the current voice connection",
  })
  async ping(interaction: CommandInteraction): Promise<void> {
    try {
      this.lastChannel = interaction.channel;
      if (getVoiceConnection(interaction.guildId) === undefined) {
        interaction.reply("I'm not currently in an voice channels");
      } else {
        interaction.reply(
          "My ping is " +
            getVoiceConnection(interaction.guildId).ping.udp +
            "ms"
        );
      }
    } catch (error) {
      this.handleErr(error);
    }
  }

  @Slash("queue", { description: "View the current queue" })
  async viewQueue(interaction?: CommandInteraction): Promise<void> {
    try {
      const userCalled = interaction !== undefined;
      if (userCalled) {
        this.lastChannel == interaction.channel;
        await interaction.deferReply();
      }

      const embed = new MessageEmbed();
      const title =
        this.player.state.status == AudioPlayerStatus.Playing
          ? "Now Playing"
          : "Current Queue";

      var description = "";

      if (this.queue.hasMedia()) {
        const queuedSongs = this.queue.getQueue();
        for (let i = 0; i < queuedSongs.length; i++) {
          const element = queuedSongs[i];
          const meta = element.metadata as IMetadata;

          description +=
            "\n" +
            (i + 1).toString() +
            ". " +
            meta.title +
            " [" +
            meta.queuedBy +
            "]";
        }
      } else {
        description = "No songs currently in queue";
      }

      embed.setTitle(title);
      embed.setDescription(description);

      if (userCalled) {
        interaction.editReply({ embeds: [embed] });
      } else {
        this.lastChannel.send({ embeds: [embed] });
      }
    } catch (error) {
      this.handleErr(error);
    }
  }

  @Slash("skip", { description: "Skip the currently playing song(s)" })
  async skip(
    @SlashOption("index", { description: "The index of the song to skip to" })
    skip: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      await interaction.deferReply();
      var i = parseInt(skip);
      const embed = new MessageEmbed();

      if (!this.queue.hasMedia()) {
        embed.description = "No songs to skip";
      } else if (!isNaN(i)) {
        this.queue.dequeue(i);
        this.player.stop();
        embed.description = "Skipped " + (i - 1).toString() + " songs";
      } else {
        this.player.stop();
        embed.description = "Song skipped";
      }

      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.handleErr(error);
    }
  }

  private async joinVC(interaction: CommandInteraction): Promise<string> {
    try {
      this.lastChannel = interaction.channel;
      const guildMember = await interaction.guild.members.fetch(
        interaction.user
      );
      const vc = guildMember.voice.channel;
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
    } catch (error) {
      this.handleErr(error);
    }
  }

  private async handleErr(err: Error) {
    const embed = new MessageEmbed();
    embed.title = "An error has occurred";
    embed.description = err.message.toString();
    this.lastChannel.send({ embeds: [embed] });
    console.log(err);
  }
}
