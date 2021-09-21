import { Discord, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  Guild,
  Message,
  MessageEmbed,
  TextBasedChannels,
} from "discord.js";
import {
  AudioPlayerStatus,
  AudioResource,
  createAudioResource,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";
const ytdlExec = require("youtube-dl-exec").raw;
import { MediaQueue } from "../model/mediaQueue";
import { IMetadata, Metadata } from "../model/metadata";
import ytdl = require("ytdl-core");
import { ServerAudioPlayer } from "../model/serverAudioPlayer";
import { ServerChannel } from "../model/serverChannel";

@Discord()
export abstract class voice {
  players: ServerAudioPlayer[] = new Array<ServerAudioPlayer>();
  queues: MediaQueue[] = new Array<MediaQueue>();
  textChannels: ServerChannel[] = new Array<ServerChannel>();

  @Slash("join", {
    description: "Join the voice channel you are currently connected to",
  })
  async join(interaction: CommandInteraction): Promise<void> {
    try {
      interaction.reply(await this.joinVC(interaction));
      this.lastTextChannel(interaction.guild, interaction.channel);
    } catch (error) {
      this.handleErr(error, interaction.guild);
    }
  }

  @Slash("disconect", { description: "Disconnect from the voice chanel" })
  @Slash("dc", { description: "Disconnect from the voice chanel" })
  async disconnect(interaction: CommandInteraction): Promise<void> {
    try {
      this.lastTextChannel(interaction.guild, interaction.channel);
      const connection = getVoiceConnection(interaction.guildId);
      if (connection === null) {
        interaction.reply("I'm not in any voice chats right now");
      } else {
        connection.disconnect();
        connection.destroy();
        interaction.reply("Disconnected 👋");
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
      this.lastTextChannel(interaction.guild, interaction.channel);
      var audioResource: AudioResource;
      var youtubeId: string;
      const embed = new MessageEmbed();
      const queue = await this.getQueue(interaction.guild);
      const audioPlayer = await this.getAudioPlayer(interaction.guild);
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
      this.lastTextChannel(interaction.guild, interaction.channel);
      var connection = getVoiceConnection(interaction.guildId);
      const queue = await this.getQueue(interaction.guild);
      const audioPlayer = await this.getAudioPlayer(interaction.guild);

      if (connection === undefined) {
        interaction.reply("Not currently connected to any Voice Channels");
      } else if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        interaction.reply("Nothing is currently queued");
      } else {
        audioPlayer.stop();
        interaction.reply("Playback stopped");
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
      const audioPlayer = await this.getAudioPlayer(interaction.guild);
      this.lastTextChannel(interaction.guild, interaction.channel);
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
      const embed = new MessageEmbed();
      await interaction.deferReply();
      const audioPlayer = await this.getAudioPlayer(interaction.guild);
      this.lastTextChannel(interaction.guild, interaction.channel);
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
      this.lastTextChannel(interaction.guild, interaction.channel);
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
      this.handleErr(error, interaction.guild);
    }
  }

  @Slash("queue", { description: "View the current queue" })
  async viewQueue(interaction?: CommandInteraction): Promise<void> {
    try {
      const userCalled = interaction !== undefined;
      const queue = await this.getQueue(interaction.guild);
      const audioPlayer = await this.getAudioPlayer(interaction.guild);
      if (userCalled) {
        this.lastTextChannel(interaction.guild, interaction.channel);
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
        (await this.lastTextChannel(interaction.guild)).send({ embeds: [embed] });
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
      const queue = await this.getQueue(interaction.guild);
      await interaction.deferReply();
      var i = parseInt(skip);
      const embed = new MessageEmbed();
      const audioPlayer = await this.getAudioPlayer(interaction.guild);

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
      this.lastTextChannel(interaction.guild, interaction.channel);
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
    embed.title = "An error has occurred";
    embed.description = err.message.toString();
    (await this.lastTextChannel(guild)).send({ embeds: [embed] });
    console.log(err);
  }

  private async getQueue(server: Guild) {
    var queue: MediaQueue;
    if (
      this.queues.find((q) => {
        q.getServer() === server;
      }) === undefined
    ) {
      queue = new MediaQueue(server);
      this.queues.push(queue);
    } else {
      queue = this.queues.find((q) => {
        q.getServer() === server;
      });
    }

    return queue;
  }

  private async getAudioPlayer(server: Guild) {
    var audioPlayer: ServerAudioPlayer;
    const queue = await this.getQueue(server);
    if (
      this.players.find((q) => {
        q.server === server;
      }) === undefined
    ) {
      audioPlayer = new ServerAudioPlayer(server);
      audioPlayer.on("stateChange", async (oldState, newState) => {
        const embed = new MessageEmbed();
        if (
          oldState.status === AudioPlayerStatus.Playing &&
          newState.status === AudioPlayerStatus.Idle
        ) {
          queue.dequeue();
          if (queue.hasMedia()) {
            audioPlayer.play(queue.currentItem());
            const meta = queue.currentItem().metadata as IMetadata;
            embed.description = `Now playing [${meta.title}](${meta.url}) [${meta.queuedBy}]`;
            (await this.lastTextChannel(queue.getServer())).send({ embeds: [embed] });
          } else {
            await (await this.lastTextChannel(queue.getServer())).send(
              "Reached end of queue, stoped playing"
            );
          }
        }
      });
      this.players.push(audioPlayer);
    } else {
      audioPlayer = this.players.find((q) => {
        q.server === server;
      });
    }

    return audioPlayer;
  }

  private async lastTextChannel(
    server: Guild,
    textChannel?: TextBasedChannels
  ) {
    if (
      this.textChannels.find((c) => {
        c.server === server;
      }) !== undefined
    ) {
      const serverLastChannel: TextBasedChannels = this.textChannels.find(
        (c) => {
          c.server === server;
        }
      ).channel;
      if (textChannel === undefined) {
        return serverLastChannel;
      } else if (textChannel === serverLastChannel) {
        return textChannel;
      } else {
        this.textChannels = this.textChannels.filter((c) => {
          c.channel !== serverLastChannel;
        });
        this.textChannels.push(new ServerChannel(server, textChannel));
      }
    } else {
      this.textChannels.push(new ServerChannel(server, textChannel));
    }
  }
}
