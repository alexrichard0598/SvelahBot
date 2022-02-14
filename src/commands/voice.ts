import { Client, Discord, On, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  MessageEmbed,
  VoiceState,
} from "discord.js";
import {
  AudioPlayerStatus,
  DiscordGatewayAdapterCreator,
  getVoiceConnection,
  joinVoiceChannel,
} from "@discordjs/voice";
import { IMetadata, Metadata } from "../model/metadata";
import { SharedMethods } from "./sharedMethods";
import { MediaType } from "../model/mediaType";
import { YouTubeVideo } from "../model/youtube";
import moment = require("moment");


@Discord()
export abstract class Voice {
  @Slash("join", {
    description: "Join the voice channel you are currently connected to",
  })
  async join(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true });

      interaction.editReply({ embeds: [await this.joinVC(interaction)] }); // Join the vc
      server.lastChannel = interaction.channel; // set the last replied channel
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("disconect", { description: "Disconnect from the voice chanel" })
  @Slash("dc", { description: "Disconnect from the voice chanel" })
  async disconnect(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true });
      const connection = getVoiceConnection(interaction.guildId); // get the current voice connection
      server.lastChannel = interaction.channel; // set the last replied channel

      /* Checks if the bot is in a voice channel
       * if yes disconnect and then reply
       * if no just reply
       */
      if (connection === null) {
        interaction.editReply("I'm not in any voice chats right now");
      } else {
        SharedMethods.disconnectBot(server, [(await interaction.fetchReply()).id]);
        interaction.editReply("Disconnected 👋");
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("play", { description: "Plays music" })
  async play(
    @SlashOption("media", { description: "The media to play", required: true })
    url: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction });

      const embed = new MessageEmbed(); // create message embed
      const queue = server.queue; // get the server's queue
      const audioPlayer = server.audioPlayer; // get the server's audioPlayer
      var connection = getVoiceConnection(interaction.guildId); // get the current voice connection

      /* if the voice connection is undefined create a voice connection */
      if (connection === undefined) {
        server.updateStatusMessage(server.lastChannel.send({ embeds: [await this.joinVC(interaction)] }));
        connection = getVoiceConnection(interaction.guildId);
      }

      const mediaType = await SharedMethods.determineMediaType(url, server).catch(err => {
        if (err instanceof MessageEmbed) {
          interaction.editReply({ embeds: [err] });
        } else {
          throw err;
        }
      });

      if (mediaType == undefined) return;

      var media: YouTubeVideo;

      if (mediaType[0] == MediaType.yt_playlist) {
        media = await SharedMethods.createYoutubePlaylistResource(mediaType[1], interaction.user.username, server);
      } else {
        media = await queue.enqueue(mediaType[1], interaction.user.username);
      }

      var mediaStatus = this.checkMediaStatus(media, mediaType[0] == MediaType.yt_playlist, interaction.user.username);


      server.updateQueueMessage(await server.lastChannel.send({ embeds: [mediaStatus[1]] }));
      if (mediaStatus[0]) return;

      if (!audioPlayer.playable.includes(connection)) {
        connection.subscribe(audioPlayer);
      }

      if (audioPlayer.state.status !== AudioPlayerStatus.Playing) {
        media = await queue.currentItem();
        while (media.resource.ended) {
          await queue.dequeue();
          media = await queue.currentItem()
        }

        audioPlayer.play(media.resource);
        const meta = media.meta;
        embed.title = "Now Playing";
        embed.description = `[${meta.title}](${media.url}) [${meta.queuedBy}]`;
        server.updateStatusMessage(await interaction.fetchReply());
      }

      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("stop", { description: "Stops playback and clears queue" })
  async stop(interaction: CommandInteraction) {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true });

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
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("clear", { description: "Clears the queue" })
  async clear(interaction: CommandInteraction) {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true });

      if (server.audioPlayer.state.status === AudioPlayerStatus.Idle) {
        interaction.editReply("Nothing is currently queued");
      } else {
        server.queue.clear(true);
        interaction.editReply("Queue cleared");
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("resume", { description: "Plays music" })
  async resume(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true });

      const embed = new MessageEmbed();
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
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("pause", { description: "Pauses any currently playing music" })
  async pause(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true });

      const embed = new MessageEmbed();
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
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("ping", {
    description: "Returns the ping of the current voice connection",
  })
  async ping(interaction: CommandInteraction): Promise<void> {
    try {
      await this.initCommand({ interaction: interaction, statusMessage: true });

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
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("queue", { description: "View the current queue" })
  async viewQueue(
    @SlashOption("page", { description: "The page of the queue to display", required: false }) page: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, queueMessage: true });

      const queue = server.queue;
      const audioPlayer = server.audioPlayer;
      server.lastChannel = interaction.channel;

      const embed = new MessageEmbed();
      var title =
        audioPlayer.state.status == AudioPlayerStatus.Playing
          ? "Now Playing"
          : "Current Queue";

      var description = "";

      if (queue.hasMedia()) {
        const queuedSongs = queue.getQueue();

        const parsedInt = parseInt(page);
        var pageInt = 1;
        if (!isNaN(parsedInt) && (parsedInt - 1) * 10 < queuedSongs.length && parsedInt > 1) {
          pageInt = parsedInt;
        }

        if (queuedSongs.length > 9) {
          title += ` — Page ${pageInt} of ${Math.ceil(queuedSongs.length / 10)}`
        }

        for (let i = Math.max((pageInt - 1) * 10 - 1, 0); i < queuedSongs.length; i++) {
          const media = queuedSongs[i];
          const meta = media.meta as IMetadata;
          description += `\n${i + 1}. [${meta.title.slice(0, 256)}](${media.url}) [${meta.queuedBy}]`;
          if (i == pageInt * 10 - 1) {
            const j = queuedSongs.length;
            const endMedia = queuedSongs[j - 1];
            const endMeta = endMedia.meta as IMetadata;
            description += '\n...';
            description += `\n${j}. [${endMeta.title}](${endMedia.url}) [${endMeta.queuedBy}]`;
            break;
          }
        }
      } else {
        description = "No songs currently in queue";
      }

      embed.setTitle(title);
      embed.setDescription(description);


      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("skip", { description: "Skip the currently playing song(s)" })
  async skip(
    @SlashOption("index", { description: "The index of the song to skip to" })
    skip: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true, queueMessage: true });

      const queue = server.queue;
      var i = parseInt(skip);
      const embed = new MessageEmbed();
      const audioPlayer = server.audioPlayer;

      if (!queue.hasMedia()) {
        embed.description = "No songs to skip";
      } else if (!isNaN(i)) {
        const queueLength = queue.getQueue().length;
        if (queueLength < i) {
          embed.description = `Only ${queueLength} songs in queue, cannot skip to song #${i} as no such song exists`;
        } else if (i == 1) {
          embed.description = `Song #1 is the currently playing song`;
        } else {
          await queue.dequeue(i - 2);
          audioPlayer.stop();
          embed.description = "Skipped " + (i - 1).toString() + " songs";
        }
      } else {
        audioPlayer.stop();
        embed.description = "Song skipped";
      }

      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("loop", { description: "Loops the current queue until looping is stoped" })
  async loop(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true });

      server.queue.loopQueue();
      interaction.editReply({ embeds: [new MessageEmbed().setDescription("Queue will loop until stoped\n(use /end-loop to stop looping)")] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("end-looping", { description: "Loops the current queue until looping is stoped" })
  async EndLoop(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true });

      server.queue.endLoop();
      interaction.editReply({ embeds: [new MessageEmbed().setDescription("Queue will no longer loop")] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("now-playing", { description: "Loops the current queue until looping is stoped" })
  @Slash("np", { description: "Loops the current queue until looping is stoped" })
  async nowPlaying(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, queueMessage: true });

      const nowPlaying: YouTubeVideo = await server.queue.currentItem();
      if (!server.queue.hasMedia()) {
        interaction.editReply({ embeds: [new MessageEmbed().setDescription("No songs are currently queued")] })
      } else if (nowPlaying.meta instanceof Metadata) {
        const metadata: Metadata = nowPlaying.meta;
        const playbackDuration = nowPlaying.resource.playbackDuration;
        const durationString = `${new Date(playbackDuration).getMinutes()}:${('0' + new Date(playbackDuration).getSeconds()).slice(-2)}`;
        const length = metadata.length;
        const lengthString = `${new Date(length).getMinutes()}:${('0' + new Date(length).getSeconds()).slice(-2)}`;
        const percPlayed: number = Math.ceil((playbackDuration / length) * 100);
        let msg = `[${metadata.title}](${nowPlaying.url}) [${metadata.queuedBy}]\n\n`;
        for (let i = 0; i < 35; i++) {
          if (percPlayed / 3 >= i) {
            msg += '█';
          } else {
            msg += '▁';
          }
        }
        msg += ` [${durationString}/${lengthString}]`;
        interaction.editReply({ embeds: [new MessageEmbed().setTitle("Now Playing").setDescription(msg)] });
      } else {
        interaction.editReply({ embeds: [new MessageEmbed().setDescription("Could not get currently playing song")] });
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("shuffle", { description: "Shuffle the current queue" })
  async shuffle(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true, queueMessage: true });

      server.queue.shuffle();
      interaction.editReply({ embeds: [new MessageEmbed().setDescription("Queue shuffled")] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash("remove", { description: "Remove an item at the index" })
  async removeItem(
    @SlashOption("index", { description: "The index of the song to remove" })
    indexString: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, statusMessage: true, queueMessage: true });

      const index = parseInt(indexString);
      if (!server.queue.hasMedia()) {
        interaction.editReply({ embeds: [new MessageEmbed().setDescription(`No songs are currently queued`)] });
      } else if (isNaN(index)) {
        interaction.editReply({ embeds: [new MessageEmbed().setDescription(`Could not parse ${indexString}, please enter a whole number`)] });
      } else if (index == 1) {
        server.queue.removeItemAt(index - 1);
        server.audioPlayer.stop();
        interaction.editReply({ embeds: [new MessageEmbed().setDescription(`Currently playing song removed`)] });
      } else if (index > server.queue.getQueue().length) {
        interaction.editReply({ embeds: [new MessageEmbed().setDescription(`You entered a number larger than the number of queued songs`)] });
      } else {
        const song = server.queue.getItemAt(index - 1);
        server.queue.removeItemAt(index - 1);
        interaction.editReply({ embeds: [new MessageEmbed().setDescription(`${song.meta.title} at queue position ${index} removed`)] });
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @On("voiceStateUpdate")
  async voiceStatusUpdate(voiceStates: [oldState: VoiceState, newState: VoiceState], client: Client) {
    const user = voiceStates[0].member.user;
    const server = await SharedMethods.getServer(voiceStates[0].guild);

    if (user.id != "698214544560095362") {
      const channel = voiceStates[0].channel;
      if (channel != null) {
        if (channel.members.filter(m => !m.user.bot).size == 0) {
          SharedMethods.disconnectBot(server);
        }
      }
    }
  }

  private async initCommand({ interaction, statusMessage, queueMessage }: InitCommandParams) {
    const reply = interaction.deferReply({ fetchReply: true });
    const server = await SharedMethods.getServer(interaction.guild);
    if (statusMessage) server.updateStatusMessage(reply);
    if (queueMessage) server.updateQueueMessage(reply);
    server.lastChannel = interaction.channel;
    return server
  }

  private checkMediaStatus(media: YouTubeVideo, isPlaylist: boolean, username: string): [boolean, MessageEmbed] {
    var embed = new MessageEmbed();
    var mediaSucces = true;

    if (media == undefined) {
      embed.title = "Unknown Error"
      embed.description = "Could not get queued item info, please let the developer know what happened.";
      mediaSucces = false;
    } else if (media.meta.title == "") {
      embed.title = "Failed to queue video"
      embed.description = "This video is unavailable to be queued. Sorry about that."
      mediaSucces = false;
    } else if (isPlaylist) {
      embed.title = "Playlist Queued"
      embed.description = `[${media.meta.playlist.name}](https://www.youtube.com/playlist?list=${media.url}) [${username}]`;
    } else {
      const meta = media.meta as IMetadata;
      embed.title = "Song Queued"
      embed.description = `[${meta.title}](${media.url}) [${meta.queuedBy}]`;
    }

    return [mediaSucces, embed];
  }

  /**
   * 
   * @param interaction the discord interaction
   * @returns "Joined " + voiceChannelName
   */
  private async joinVC(interaction: CommandInteraction): Promise<MessageEmbed> {
    try {
      const server = await SharedMethods.getServer(interaction.guild);
      server.lastChannel = interaction.channel;
      const guildMember = await interaction.guild.members.fetch(
        interaction.user
      );
      const embed = new MessageEmbed;
      const vc = guildMember.voice.channel;
      if (vc === null) {
        embed.description = "You are not part of a voice chat, please join a voice chat first.";
      } else {
        joinVoiceChannel({
          channelId: vc.id,
          guildId: vc.guildId,
          adapterCreator: vc.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator,
        });
        embed.description = "Joined " + vc.name;
      }
      return embed;
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }
}

interface InitCommandParams {
  interaction: CommandInteraction;
  statusMessage?: boolean;
  queueMessage?: boolean;
}