import { Discord, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  Guild,
  MessageEmbed,
} from "discord.js";
import {
  AudioPlayerStatus,
  AudioResource,
  createAudioResource,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";
const ytdlExec = require("youtube-dl-exec").raw;
import { IMetadata, Metadata } from "../model/metadata";
import ytdl = require("ytdl-core");
import { Server } from "../model/server";

@Discord()
export abstract class voice {
  servers: Server[] = new Array<Server>();

  @Slash("join", {
    description: "Join the voice channel you are currently connected to",
  })
  async join(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();
      interaction.editReply(await this.joinVC(interaction));
      const server = await this.getServer(interaction.guild);
      server.lastChannel = interaction.channel;
    } catch (error) {
      this.handleErr(error, interaction.guild);
    }
  }

  @Slash("disconect", { description: "Disconnect from the voice chanel" })
  @Slash("dc", { description: "Disconnect from the voice chanel" })
  async disconnect(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();
      const server = await this.getServer(interaction.guild);
      const connection = getVoiceConnection(interaction.guildId);
      server.lastChannel = interaction.channel;
      if (connection === null) {
        interaction.editReply("I'm not in any voice chats right now");
      } else {
        connection.disconnect();
        connection.destroy();
        interaction.editReply("Disconnected 👋");
      }
    } catch (error) {
      this.handleErr(error, interaction.guild);
    }
  }

  @Slash("play", { description: "Plays music" })
  async play(
    @SlashOption("media", { description: "The media to play", required: true })
    url: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.getServer(interaction.guild);
      server.lastChannel = interaction.channel;
      var audioResource: AudioResource;
      var youtubeId: string;
      const embed = new MessageEmbed();
      const queue = server.queue;
      const audioPlayer = server.audioPlayer;
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
        audioResource = createAudioResource(stream.stdout);
        const metadata: IMetadata = new Metadata();
        const details = await ytdl.getInfo(url);
        metadata.title = details.videoDetails.title;
        metadata.length = parseInt(details.videoDetails.lengthSeconds);
        metadata.url = url;
        metadata.queuedBy = (
          await interaction.guild.members.fetch(interaction.user.id)
        ).displayName;
        audioResource.metadata = metadata;
      }

      if (!audioPlayer.playable.includes(connection)) {
        connection.subscribe(audioPlayer);
      }

      queue.enqueue(audioResource);

      if (audioPlayer.state.status !== AudioPlayerStatus.Playing) {
        const media = queue.currentItem();
        audioPlayer.play(media);
        var meta = media.metadata as IMetadata;
        embed.description = `Now playing [${meta.title}](${meta.url}) [${meta.queuedBy}]`;
      } else {
        var meta = audioResource.metadata as IMetadata;
        embed.description = `[${meta.title}](${meta.url}) [${meta.queuedBy}] queued`;
      }

      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.handleErr(error, interaction.guild);
    }
  }

  @Slash("stop", { description: "Stops playback and clears queue" })
  @Slash("clear", { description: "Stops playback and clears queue" })
  async stop(interaction: CommandInteraction) {
    try {
      await interaction.deferReply();
      const server = await this.getServer(interaction.guild);
      server.lastChannel = interaction.channel;
      var connection = getVoiceConnection(interaction.guildId);
      const queue = server.queue;
      const audioPlayer = server.audioPlayer;

      if (connection === undefined) {
        interaction.editReply("Not currently connected to any Voice Channels");
      } else if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        interaction.editReply("Nothing is currently queued");
      } else {
        audioPlayer.stop();
        interaction.editReply("Playback stopped");
        queue.clear();
      }
    } catch (error) {
      this.handleErr(error, interaction.guild);
    }
  }

  @Slash("resume", { description: "Plays music" })
  async resume(interaction: CommandInteraction): Promise<void> {
    try {
      const embed = new MessageEmbed();
      await interaction.deferReply();
      const server = await this.getServer(interaction.guild);
      const audioPlayer = server.audioPlayer;
      server.lastChannel = interaction.channel;
      if (audioPlayer.state.status === AudioPlayerStatus.Paused) {
        audioPlayer.unpause();
        embed.description = "Resumed queue";
      } else if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        embed.description = "No audio queued up";
      } else {
        embed.description = "Cannot resume queue";
      }
      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.handleErr(error, interaction.guild);
    }
  }

  @Slash("pause", { description: "Plays music" })
  async pause(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();
      const embed = new MessageEmbed();
      const server = await this.getServer(interaction.guild);
      const audioPlayer = server.audioPlayer;
      server.lastChannel = interaction.channel;
      if (audioPlayer.state.status === AudioPlayerStatus.Playing) {
        audioPlayer.pause();
        embed.description = "Paused playback";
      } else if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        embed.description = "No audio queued up";
      } else {
        embed.description = "Cannot pause";
      }
      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.handleErr(error, interaction.guild);
    }
  }

  @Slash("ping", {
    description: "Returns the ping of the current voice connection",
  })
  async ping(interaction: CommandInteraction): Promise<void> {
    try {
      await interaction.deferReply();
      const server = await this.getServer(interaction.guild);
      server.lastChannel = interaction.channel;
      if (getVoiceConnection(interaction.guildId) === undefined) {
        interaction.editReply("I'm not currently in an voice channels");
      } else {
        interaction.editReply(
          "My ping is " +
            getVoiceConnection(interaction.guildId).ping.udp +
            "ms"
        );
      }
    } catch (error) {
      this.handleErr(error, interaction.guild);
    }
  }

  @Slash("queue", { description: "View the current queue" })
  async viewQueue(interaction?: CommandInteraction): Promise<void> {
    try {
      const userCalled = interaction !== undefined;
      const server = await this.getServer(interaction.guild);
      const queue = server.queue;
      const audioPlayer = server.audioPlayer;
      if (userCalled) {
        server.lastChannel = interaction.channel;
        await interaction.deferReply();
      }

      const embed = new MessageEmbed();
      const title =
        audioPlayer.state.status == AudioPlayerStatus.Playing
          ? "Now Playing"
          : "Current Queue";

      var description = "";

      if (queue.hasMedia()) {
        const queuedSongs = queue.getQueue();
        for (let i = 0; i < queuedSongs.length; i++) {
          const element = queuedSongs[i];
          const meta = element.metadata as IMetadata;
          description += `\n${i + 1}. ${meta.title} [${meta.queuedBy}]`;
        }
      } else {
        description = "No songs currently in queue";
      }

      embed.setTitle(title);
      embed.setDescription(description);

      if (userCalled) {
        interaction.editReply({ embeds: [embed] });
      } else {
        if(server.lastChannel !== undefined) server.lastChannel.send({
          embeds: [embed],
        });
      }
    } catch (error) {
      this.handleErr(error, interaction.guild);
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
      const server = await this.getServer(interaction.guild);
      const queue = server.queue;
      var i = parseInt(skip);
      const embed = new MessageEmbed();
      const audioPlayer = server.audioPlayer;

      if (!queue.hasMedia()) {
        embed.description = "No songs to skip";
      } else if (!isNaN(i)) {
        queue.dequeue(i);
        audioPlayer.stop();
        embed.description = "Skipped " + (i - 1).toString() + " songs";
      } else {
        audioPlayer.stop();
        embed.description = "Song skipped";
      }

      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      this.handleErr(error, interaction.guild);
    }
  }

  private async joinVC(interaction: CommandInteraction): Promise<string> {
    try {
      const server = await this.getServer(interaction.guild);
      server.lastChannel = interaction.channel;
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
      this.handleErr(error, interaction.guild);
    }
  }

  private async handleErr(err: Error, guild: Guild) {
    const embed = new MessageEmbed();
    const server = await this.getServer(guild);
    embed.title = "An error has occurred";
    embed.description = err.message.toString();
    if(server.lastChannel !== undefined) server.lastChannel.send({ embeds: [embed] });
    console.log(err);
  }

  private async getServer(server: Guild) {
    const foundServer = this.servers.find((s) => (s.server.id == server.id));
    if(foundServer === undefined) {
      var newServer = new Server(server);
      this.servers.push(newServer);
      return newServer;  
    }
    return foundServer;
  }
}
