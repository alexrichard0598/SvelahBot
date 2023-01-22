import { Client, Discord, On, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  EmbedBuilder,
  VoiceBasedChannel,
  VoiceState,
  ApplicationCommandOptionType,
} from "discord.js";
import {
  AudioPlayerStatus,
  getVoiceConnection,
} from "@discordjs/voice";
import { IMetadata, Metadata } from "../model/Metadata";
import { SharedMethods } from "./SharedMethods";
import { MediaType } from "../model/MediaType";
import { PlayableResource } from "../model/PlayableResource";
import moment = require("moment");
import momentDurationFormatSetup = require("moment-duration-format");
momentDurationFormatSetup(moment);
import { BotStatus } from "../model/BotStatus";
import { VolfbotServer } from "../model/VolfbotServer";

@Discord()
export abstract class Voice {
  @Slash({
    name: "join",
    description: "Join the voice channel you are currently connected to",
  })
  async join(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true });

      interaction.editReply({ embeds: [await server.connectBot(interaction)] }); // Join the vc
      server.lastChannel = interaction.channel; // set the last replied channel
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "disconect", description: "Disconnect from the voice chanel" })
  @Slash({ name: "dc", description: "Disconnect from the voice chanel" })
  async disconnect(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true });
      const connection = getVoiceConnection(interaction.guildId); // get the current voice connection
      server.lastChannel = interaction.channel; // set the last replied channel

      /* Checks if the bot is in a voice channel
       * if yes disconnect and then reply
       * if no just reply
       */
      if (connection === null) {
        interaction.editReply("I'm not in any voice chats right now");
      } else {
        server.disconnectBot([(await interaction.fetchReply()).id]);
        interaction.editReply("Disconnected 👋");
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "play", description: "Plays music" })
  async play(
    @SlashOption({ name: "media", description: "The media to play", required: true, type: ApplicationCommandOptionType.String })
    url: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction });

      const queue = server.queue; // get the server's queue
      const audioPlayer = server.audioPlayer; // get the server's audioPlayer
      let connection = getVoiceConnection(interaction.guildId); // get the current voice connection

      /* if the voice connection is undefined create a voice connection */
      if (connection === undefined) {
        server.updateStatusMessage(await server.lastChannel.send({ embeds: [await server.connectBot(interaction)] }));
        connection = getVoiceConnection(interaction.guildId);
      }

      if (await this.dealWithMedia(interaction, url, server) === null) {
        return;
      }


      if (!audioPlayer.playable.includes(connection)) {
        connection.subscribe(audioPlayer);
      }

      if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        let media = await queue.currentItem();
        if (media instanceof PlayableResource) {
          while ((await media.getResource()).ended) {
            await queue.dequeue();
            media = await queue.currentItem()
          }

          server.playSong(media);
        }
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "playnow", description: "Adds item to start of the queue and starts playing it now" })
  async playnow(
    @SlashOption({ name: "media", description: "The media to play", required: true, type: ApplicationCommandOptionType.String })
    url: string,
    interaction: CommandInteraction
  ) {
    try {
      const server = await this.initCommand({ interaction: interaction });
      const queue = server.queue; // get the server's queue

      if (!queue.hasMedia()) {
        return this.play(url, interaction);
      }

      const audioPlayer = server.audioPlayer; // get the server's audioPlayer
      let connection = getVoiceConnection(interaction.guildId); // get the current voice connection

      /* if the voice connection is undefined create a voice connection */
      if (connection === undefined) {
        server.updateStatusMessage(await server.lastChannel.send({ embeds: [await server.connectBot(interaction)] }));
        connection = getVoiceConnection(interaction.guildId);
      }

      let media = await this.dealWithMedia(interaction, url, server, false);

      if (media === null) {
        return;
      }

      if (!audioPlayer.playable.includes(connection)) {
        connection.subscribe(audioPlayer);
      }

      let currentQueue = queue.getQueue();
      let newQueue;

      if (media instanceof PlayableResource) {
        let tempQueue = new Array<PlayableResource>();
        tempQueue.push(media);
        newQueue = tempQueue.concat(await currentQueue);
      } else if (media instanceof Array<PlayableResource>) {
        newQueue = media.concat(await currentQueue);
      } else {
        return;
      }

      queue.setQueue(newQueue);
      let currentItem = await queue.currentItem();
      if (currentItem !== undefined) {
        server.playSong(currentItem);
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "stop", description: "Stops playback and clears queue" })
  async stop(interaction: CommandInteraction) {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true });

      let connection = getVoiceConnection(interaction.guildId);
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

  @Slash({ name: "clear", description: "Clears the queue" })
  async clear(interaction: CommandInteraction) {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true });

      if ((await server.queue.getQueueCount()) == 0) {
        interaction.editReply("Nothing is currently queued");
      } else {
        server.queue.clear(true);
        interaction.editReply("Queue cleared");
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "resume", description: "Resumes playback" })
  async resume(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true });

      const embed = new EmbedBuilder();
      const audioPlayer = server.audioPlayer;
      server.lastChannel = interaction.channel;
      if (audioPlayer.state.status === AudioPlayerStatus.Paused) {
        audioPlayer.unpause();
        embed.setDescription("Resumed queue");
      } else if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        embed.setDescription("No audio queued up");
      } else {
        embed.setDescription("Cannot resume queue");
      }
      interaction.editReply({ embeds: [embed] });

    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "pause", description: "Pauses any currently playing music" })
  async pause(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true });

      const embed = new EmbedBuilder();
      const audioPlayer = server.audioPlayer;
      server.lastChannel = interaction.channel;
      if (audioPlayer.state.status === AudioPlayerStatus.Playing) {
        audioPlayer.pause();
        embed.setDescription("Paused playback");
      } else if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        embed.setDescription("No audio queued up");
      } else {
        embed.setDescription("Cannot pause");
      }
      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({
    name: "ping",
    description: "Returns the ping of the current voice connection",
  })
  async ping(interaction: CommandInteraction): Promise<void> {
    try {
      await this.initCommand({ interaction: interaction, isStatusMessage: true });

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

  @Slash({ name: "queue", description: "View the current queue" })
  async viewQueue(
    @SlashOption({ name: "page", description: "The page of the queue to display", required: false, type: ApplicationCommandOptionType.Integer }) page: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isQueueMessage: true });

      const queue = server.queue;
      const audioPlayer = server.audioPlayer;
      server.lastChannel = interaction.channel;

      const embed = new EmbedBuilder();
      let title =
        audioPlayer.state.status == AudioPlayerStatus.Playing
          ? "Now Playing"
          : "Current Queue";

      let description = " ";

      if (queue.hasMedia()) {
        const queuedSongs = await queue.getQueue();
        const queueCount = await queue.getQueueCount();

        const parsedInt = parseInt(page);
        let pageInt = 1;
        if (!isNaN(parsedInt) && (parsedInt - 1) * 10 < queueCount && parsedInt > 1) {
          pageInt = parsedInt;
        }

        if (queueCount > 9) {
          title += ` — Page ${pageInt} of ${Math.ceil(queueCount / 10)}`
          const queueLength = await queue.getTotalLength();
          title += ` — Total Duration: ${moment.duration(queueLength, "ms").format("d [days], h [hours], m [minutes], s [seconds]")}`;
        } else if (queueCount > 1) {
          const queueLength = await queue.getTotalLength();
          title += ` — Total Duration: ${moment.duration(queueLength, "ms").format("d [days], h [hours], m [minutes], s [seconds]")}`;
        }

        for (let i = Math.max((pageInt - 1) * 10 - 1, 0); i < queueCount; i++) {
          const media = queuedSongs[i];
          const meta = media.meta as IMetadata;
          description += `\n${i + 1}. [${meta.title.slice(0, 256)}](${media.url}) [${meta.queuedBy}]`;
          if (i == pageInt * 10 - 1) {
            const j = queueCount;
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

  @Slash({ name: "skip", description: "Skip the currently playing song(s)" })
  async skip(
    @SlashOption({ name: "index", description: "The index of the song to skip to", type: ApplicationCommandOptionType.Integer })
    skip: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true, isQueueMessage: true });

      const queue = server.queue;
      let i = parseInt(skip);
      const embed = new EmbedBuilder();
      const audioPlayer = server.audioPlayer;

      if (!queue.hasMedia()) {
        embed.setDescription("No songs to skip");
      } else if (!isNaN(i)) {
        const queueLength = await queue.getQueueCount();
        if (queueLength < i) {
          embed.setDescription(`Only ${queueLength} songs in queue, cannot skip to song #${i} as no such song exists`);
        } else if (i == 1) {
          embed.setDescription(`Song #1 is the currently playing song`);
        } else {
          await queue.dequeue(i - 2);
          audioPlayer.stop();
          embed.setDescription("Skipped " + (i - 1).toString() + " songs");
        }
      } else {
        audioPlayer.stop();
        embed.setDescription("Song skipped");
      }

      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "loop", description: "Loops the current queue until looping is stoped" })
  async loop(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true });

      server.queue.loopQueue();
      interaction.editReply({ embeds: [new EmbedBuilder().setDescription("Queue will loop until stoped\n(use /end-loop to stop looping)")] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "end-looping", description: "Stops looping the current queue" })
  @Slash({ name: "eloop", description: "Stops looping the current queue" })
  async EndLoop(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true });

      server.queue.endLoop();
      interaction.editReply({ embeds: [new EmbedBuilder().setDescription("Queue will no longer loop")] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "now-playing", description: "Shows the currently playing song and who queued it" })
  @Slash({ name: "np", description: "Shows the currently playing song and who queued it" })
  async nowPlaying(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isNowPlayingMessage: true });

      const nowPlaying: PlayableResource = await server.queue.currentItem();
      if (!server.queue.hasMedia() || nowPlaying == null) {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription("No songs are currently queued")] })
      } else if (nowPlaying.meta instanceof Metadata) {
        interaction.editReply({ embeds: [await SharedMethods.nowPlayingEmbed(server)] });
      } else {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription("Could not get currently playing song")] });
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "shuffle", description: "Shuffle the current queue" })
  async shuffle(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true, isQueueMessage: true });

      if (await server.queue.getTotalLength() == 0) {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription("Queue is empty")] });
      } else {
        server.queue.shuffle();
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription("Queue shuffled")] });
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "remove", description: "Remove an item at the index" })
  async removeItem(
    @SlashOption({ name: "index", description: "The index of the song to remove", type: ApplicationCommandOptionType.Integer })
    indexString: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true, isQueueMessage: true });

      const index = parseInt(indexString);
      if (!server.queue.hasMedia()) {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`No songs are currently queued`)] });
      } else if (isNaN(index)) {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`Could not parse ${indexString}, please enter a whole number`)] });
      } else if (index == 1) {
        server.queue.removeItemAt(index - 1);
        server.audioPlayer.stop();
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`Currently playing song removed`)] });
      } else if (index > await server.queue.getQueueCount()) {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`You entered a number larger than the number of queued songs`)] });
      } else {
        const song = await server.queue.getItemAt(index - 1);
        server.queue.removeItemAt(index - 1);
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`${song.meta.title} at queue position ${index} removed`)] });
      }
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @Slash({ name: "status", description: "Returns the current status of the bot" })
  async status(interaction: CommandInteraction) {
    try {
      const server = await this.initCommand({ interaction: interaction, isStatusMessage: true });
      const status = SharedMethods.getStatus(server);
      const vc: VoiceBasedChannel = (await server.guild.members.fetch("698214544560095362")).voice.channel;
      let msg = "";

      switch (status) {
        case BotStatus.Idle:
          msg = "I'm ready and waiting for your commands";
          break;
        case BotStatus.InVC:
          msg = `I'm sitting in the *${vc.name}* voice chat, and waiting for your commands`
          break;
        case BotStatus.PlayingMusic:
          msg = `I'm curently playing [${(await server.queue.currentItem()).meta.title}](${(await server.queue.currentItem()).url}) in "${vc.name}"`
          break;
        default:
          msg = "I'm not sure what I'm up to";
          break;
      }

      interaction.editReply({ embeds: [new EmbedBuilder().setDescription(msg).setTitle("Current Status")] });
    } catch (error) {
      SharedMethods.handleErr(error, interaction.guild);
    }
  }

  @On({ event: "voiceStateUpdate" })
  async voiceStatusUpdate(voiceStates: [oldState: VoiceState, newState: VoiceState], _client: Client) {
    const botUserId = "698214544560095362";
    const server = await SharedMethods.getServer(voiceStates[0].guild);
    const bot = await server.guild.members.fetch(botUserId);
    const channel = bot.voice.channel;

    if (channel != null) {
      if (channel.members.filter(m => !m.user.bot).size == 0) {
        server.disconnectBot();
      }
    } else if (server.queue.hasMedia()) {
      server.queue.clear();
    }
  }

  private async initCommand({ interaction, isStatusMessage: isStatusMessage, isQueueMessage: isQueueMessage, isNowPlayingMessage: isNowPlayingMessage }: InitCommandParams): Promise<VolfbotServer> {
    if (!interaction.deferred) {
      const reply = await interaction.deferReply({ fetchReply: true });
      const server = await SharedMethods.getServer(interaction.guild);
      if (isStatusMessage) await server.updateStatusMessage(reply);
      if (isQueueMessage) await server.updateQueueMessage(reply);
      if (isNowPlayingMessage) await server.updateNowPlayingMessage(reply);
      server.lastChannel = interaction.channel;
      return server;
    } else {
      return SharedMethods.getServer(interaction.guild);
    }
  }

  private checkMediaStatus(media: PlayableResource, isPlaylist: boolean, username: string): [boolean, EmbedBuilder] {
    let embed = new EmbedBuilder();
    let mediaError = false;

    if (media == undefined) {
      embed.setTitle("Unknown Error");
      embed.setDescription("Could not get queued item info, please let the developer know what happened.");
      mediaError = true;
    } else if (media.meta.title == "") {
      embed.setTitle("Failed to queue video");
      embed.setDescription("This video is unavailable to be queued. Sorry about that.");
      mediaError = true;
    } else if (isPlaylist) {
      embed.setTitle("Playlist Queued");
      embed.setDescription(`[${media.meta.playlist.name}](https://www.youtube.com/playlist?list=${media.url}) [${username}]`);
    } else {
      const meta = media.meta as IMetadata;
      embed.setTitle('Song Queued');
      embed.setDescription(`[${meta.title}](${media.url}) [${meta.queuedBy}]`);
    }

    return [mediaError, embed];
  }

  private async dealWithMedia(interaction: CommandInteraction, url: string, server: VolfbotServer, queue = true): Promise<Array<PlayableResource> | PlayableResource | null> {
    const mediaType = await SharedMethods.determineMediaType(url, server).catch(err => {
      this.handleDetermineMediaTypeError(err, interaction);
    });

    let media: Array<PlayableResource>;

    if (mediaType[0] == MediaType.yt_playlist) {
      media = await SharedMethods.createYoutubePlaylistResource(mediaType[1], interaction.user.username, server);
    } else if (mediaType[0] == MediaType.yt_video || mediaType[0] == MediaType.yt_search) {
      media = new Array<PlayableResource>();
      let vid = new PlayableResource(server, mediaType[1]);
      vid.meta = await SharedMethods.getMetadata(vid.url, interaction.user.username);
      media.push(vid);
    }

    if (media !== undefined && queue) {
      server.queue.enqueue(media);
    }

    let videoToTest: PlayableResource;
    const vid: PlayableResource = media[0];

    if (vid.meta.title === '') {
      vid.meta = await SharedMethods.getMetadata(vid.url, interaction.user.username, mediaType[1]);
    }

    videoToTest = vid;

    let mediaStatus = this.checkMediaStatus(videoToTest, mediaType[0] == MediaType.yt_playlist, interaction.user.username);

    if (mediaStatus[0]) {
      server.updateQueueMessage(await interaction.editReply({ embeds: [mediaStatus[1]] }));
      return;
    } else {

      let extraLength: number = 1;

      if (media instanceof Array<PlayableResource>) {
        extraLength = media.length;
      }

      server.updateQueueMessage(await interaction.editReply({ embeds: [mediaStatus[1].setTitle(mediaStatus[1].data.title + ` — ${(await server.queue.getQueueCount()) + extraLength} Songs in Queue`)] }));
    }

    return media;
  }

  private async handleDetermineMediaTypeError(err, interaction) {
    if (err instanceof EmbedBuilder) {
      interaction.editReply({ embeds: [err] });
    } else {
      throw err;
    }
  }
}

interface InitCommandParams {
  interaction: CommandInteraction;
  isStatusMessage?: boolean;
  isQueueMessage?: boolean;
  isNowPlayingMessage?: boolean;
}