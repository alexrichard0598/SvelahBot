import { Client, Discord, On, Slash, SlashOption } from "discordx";
import {
  CommandInteraction,
  EmbedBuilder,
  VoiceBasedChannel,
  VoiceState,
  ApplicationCommandOptionType,
  userMention,
  channelMention,
} from "discord.js";
import {
  AudioPlayerStatus,
  VoiceConnection,
  getVoiceConnection,
} from "@discordjs/voice";
import { IMetadata, Metadata } from "../model/Metadata";
import { MediaType } from "../model/MediaType";
import { PlayableResource } from "../model/PlayableResource";
import moment = require("moment");
import momentDurationFormatSetup = require("moment-duration-format");
momentDurationFormatSetup(moment);
import { BotStatus } from "../model/BotStatus";
import { VolfbotServer } from "../model/VolfbotServer";
import { MessageHandling } from "../functions/MessageHandling";
import { MediaQueue } from "../model/MediaQueue";

@Discord()
export abstract class Voice {
  @Slash({
    name: "join",
    description: "Join the voice channel you are currently connected to",
  })
  public async Join(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true });

      interaction.editReply({ embeds: [await server.ConnectBot(interaction)] }); // Join the vc
      server.SetLastChannel(interaction.channel); // set the last replied channel
    } catch (error) {
      MessageHandling.LogError("Join", error, interaction.guild);
    }
  }

  @Slash({ name: "disconnect", description: "Disconnect from the voice chanel" })
  @Slash({ name: "dc", description: "Disconnect from the voice chanel" })
  public async Disconnect(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true });
      const connection = getVoiceConnection(interaction.guildId); // get the current voice connection
      server.SetLastChannel(interaction.channel); // set the last replied channel

      /* Checks if the bot is in a voice channel
       * if yes disconnect and then reply
       * if no just reply
       */
      if (connection === null) {
        interaction.editReply("I'm not in any voice chats right now");
      } else {
        server.DisconnectBot([(await interaction.fetchReply()).id]);
        interaction.editReply("Disconnected 👋");
      }
    } catch (error) {
      MessageHandling.LogError("Disconnect", error, interaction.guild);
    }
  }

  @Slash({ name: "play", description: "Plays music" })
  public async Play(
    @SlashOption({ name: "media", description: "The media to play", required: true, type: ApplicationCommandOptionType.String })
    url: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction });

      const queue = server.queue; // get the server's queue
      const audioPlayer = server.audioPlayer; // get the server's audioPlayer
      const connection = await this.CheckForVoiceConnection(server, interaction);

      if (await this.DealWithMedia(interaction, url, server) === null) {
        return;
      }

      if (!audioPlayer.playable.includes(connection)) {
        connection.subscribe(audioPlayer);
      }

      if (audioPlayer.state.status === AudioPlayerStatus.Idle) {
        let media = await queue.CurrentItem();
        if (media instanceof PlayableResource) {
          while ((await media.GetResource()).ended) {
            await queue.Dequeue();
            media = await queue.CurrentItem()
          }

          server.PlaySong(media);
        }
      }
    } catch (error) {
      MessageHandling.LogError("Play", error, interaction.guild);
    }
  }

  @Slash({ name: "play-now", description: "Adds item to start of the queue and starts playing it now" })
  public async PlayNow(
    @SlashOption({ name: "media", description: "The media to play", required: true, type: ApplicationCommandOptionType.String })
    url: string,
    interaction: CommandInteraction
  ) {
    try {
      const server = await this.InitCommand({ interaction: interaction });
      const queue = server.queue; // get the server's queue

      if (!queue.HasMedia()) {
        return this.Play(url, interaction);
      }

      const audioPlayer = server.audioPlayer; // get the server's audioPlayer
      let connection = await this.CheckForVoiceConnection(server, interaction);

      let media = await this.DealWithMedia(interaction, url, server, false);

      if (media === null) {
        return;
      }

      if (!audioPlayer.playable.includes(connection)) {
        connection.subscribe(audioPlayer);
      }

      let currentQueue = await queue.GetQueue();
      let newQueue: PlayableResource[];

      if (media instanceof PlayableResource) {
        let tempQueue = new Array<PlayableResource>();
        tempQueue.push(media);
        newQueue = tempQueue.concat(currentQueue);
      } else if (media instanceof Array<PlayableResource>) {
        newQueue = media.concat(currentQueue);
      } else {
        return;
      }

      await queue.SetQueue(newQueue);
      let currentItem = newQueue[0];
      if (currentItem !== undefined && currentItem !== null) {
        server.PlaySong(currentItem);
      } else {
        server.lastChannel.send("Failed to play media");
      }
    } catch (error) {
      MessageHandling.LogError("PlayNow", error, interaction.guild);
    }
  }

  @Slash({ name: "stop", description: "Stops playback and clears queue" })
  public async Stop(interaction: CommandInteraction) {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true });

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
        queue.Clear();
      }

    } catch (error) {
      MessageHandling.LogError("Stop", error, interaction.guild);
    }
  }

  @Slash({ name: "clear", description: "Clears the queue" })
  public async Clear(interaction: CommandInteraction) {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true });

      if ((await server.queue.GetQueueCount()) == 0) {
        interaction.editReply("Nothing is currently queued");
      } else {
        server.queue.Clear(true);
        interaction.editReply("Queue cleared");
      }
    } catch (error) {
      MessageHandling.LogError("Clear", error, interaction.guild);
    }
  }

  @Slash({ name: "resume", description: "Resumes playback" })
  public async Resume(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true });

      const embed = new EmbedBuilder();
      const audioPlayer = server.audioPlayer;
      const hasQueue = await server.queue.HasMedia();
      server.SetLastChannel(interaction.channel);

      if (audioPlayer.state.status === AudioPlayerStatus.Playing) {
        embed.setDescription("Already playing music in " + channelMention((await server.GetCurrentVC()).id));
      } else if (hasQueue) {
        this.CheckForVoiceConnection(server, interaction);

        if (audioPlayer.state.status === AudioPlayerStatus.Paused) {
          audioPlayer.unpause();
        } else {
          server.queue.ResumePlayback();
        }

        embed.setDescription("Resumed queue");
      } else if (!hasQueue) {
        embed.setDescription("No audio queued up");
      } else {
        embed.setDescription("Cannot resume queue");
        server.queue.Clear();
      }
      interaction.editReply({ embeds: [embed] });

    } catch (error) {
      MessageHandling.LogError("Resume", error, interaction.guild);
    }
  }

  @Slash({ name: "pause", description: "Pauses any currently playing music" })
  public async Pause(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true });

      const embed = new EmbedBuilder();
      const audioPlayer = server.audioPlayer;
      server.SetLastChannel(interaction.channel);
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
      MessageHandling.LogError("Pause", error, interaction.guild);
    }
  }

  @Slash({
    name: "ping",
    description: "Returns the ping of the current voice connection",
  })
  public async Ping(interaction: CommandInteraction): Promise<void> {
    try {
      await this.InitCommand({ interaction: interaction, isStatusMessage: true });

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
      MessageHandling.LogError("Ping", error, interaction.guild);
    }
  }

  @Slash({ name: "queue", description: "View the current queue" })
  public async ViewQueue(
    @SlashOption({ name: "page", description: "The page of the queue to display", required: false, type: ApplicationCommandOptionType.Integer }) page: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isQueueMessage: true });

      const queue = server.queue;
      const audioPlayer = server.audioPlayer;
      server.SetLastChannel(interaction.channel);

      const embed = new EmbedBuilder();
      let title =
        audioPlayer.state.status == AudioPlayerStatus.Playing
          ? "Now Playing"
          : "Current Queue";

      let description = " ";

      if (queue.HasMedia()) {
        const queuedSongs = await queue.GetQueue();
        const queueCount = await queue.GetQueueCount();

        const parsedInt = parseInt(page);
        let pageInt = 1;
        if (!isNaN(parsedInt) && (parsedInt - 1) * 10 < queueCount && parsedInt > 1) {
          pageInt = parsedInt;
        }

        if (queueCount > 9) {
          title += ` — Page ${pageInt} of ${Math.ceil(queueCount / 10)}`
          const queueLength = await queue.GetTotalLength();
          title += ` — Total Duration: ${moment.duration(queueLength, "ms").format("d [days], h [hours], m [minutes], s [seconds]")}`;
        } else if (queueCount > 1) {
          const queueLength = await queue.GetTotalLength();
          title += ` — Total Duration: ${moment.duration(queueLength, "ms").format("d [days], h [hours], m [minutes], s [seconds]")}`;
        }

        for (let i = Math.max((pageInt - 1) * 10 - 1, 0); i < queueCount; i++) {
          const media = queuedSongs[i];
          const meta = media.meta as IMetadata;
          description += `\n${i + 1}. [${meta.title.slice(0, 256)}](${media.url}) [${userMention(meta.queuedBy)}]`;
          if (i == pageInt * 10 - 1) {
            const j = queueCount;
            const endMedia = queuedSongs[j - 1];
            const endMeta = endMedia.meta as IMetadata;
            description += '\n...';
            description += `\n${j}. [${endMeta.title}](${endMedia.url}) [${userMention(endMeta.queuedBy)}]`;
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
      MessageHandling.LogError("ViewQueue", error, interaction.guild);
    }
  }

  @Slash({ name: "skip", description: "Skip the currently playing song(s)" })
  public async Skip(
    @SlashOption({ name: "index", description: "The index of the song to skip to", type: ApplicationCommandOptionType.Integer })
    skip: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true, isQueueMessage: true });

      const queue = server.queue;
      let i = parseInt(skip);
      const embed = new EmbedBuilder();
      const audioPlayer = server.audioPlayer;

      if (!queue.HasMedia()) {
        embed.setDescription("No songs to skip");
      } else if (!isNaN(i)) {
        const queueLength = await queue.GetQueueCount();
        if (queueLength < i) {
          embed.setDescription(`Only ${queueLength} songs in queue, cannot skip to song #${i} as no such song exists`);
        } else if (i == 1) {
          embed.setDescription(`Song #1 is the currently playing song`);
        } else {
          await queue.Dequeue(i - 2);
          audioPlayer.stop();
          embed.setDescription("Skipped " + (i - 1).toString() + " songs");
        }
      } else {
        audioPlayer.stop();
        embed.setDescription("Song skipped");
      }

      interaction.editReply({ embeds: [embed] });
    } catch (error) {
      MessageHandling.LogError("Skip", error, interaction.guild);
    }
  }

  @Slash({ name: "loop", description: "Loops the current queue until looping is stopped" })
  public async Loop(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true });

      server.queue.loopQueue();
      interaction.editReply({ embeds: [new EmbedBuilder().setDescription("Queue will loop until stopped\n(use /end-loop to stop looping)")] });
    } catch (error) {
      MessageHandling.LogError("Loop", error, interaction.guild);
    }
  }

  @Slash({ name: "end-looping", description: "Stops looping the current queue" })
  @Slash({ name: "eloop", description: "Stops looping the current queue" })
  public async EndLoop(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true });

      server.queue.endLoop();
      interaction.editReply({ embeds: [new EmbedBuilder().setDescription("Queue will no longer loop")] });
    } catch (error) {
      MessageHandling.LogError("EndLoop", error, interaction.guild);
    }
  }

  @Slash({ name: "now-playing", description: "Shows the currently playing song and who queued it" })
  @Slash({ name: "np", description: "Shows the currently playing song and who queued it" })
  public async NowPlaying(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isNowPlayingMessage: true });

      const nowPlaying: PlayableResource = await server.queue.CurrentItem();
      if (!server.queue.HasMedia() || nowPlaying == null) {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription("No songs are currently queued")] })
      } else if (nowPlaying.meta instanceof Metadata) {
        interaction.editReply({ embeds: [await MessageHandling.NowPlayingEmbed(server)] });
      } else {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription("Could not get currently playing song")] });
      }
    } catch (error) {
      MessageHandling.LogError("NowPlaying", error, interaction.guild);
    }
  }

  //TODO: Fix this
  @Slash({ name: "shuffle", description: "Shuffle the current queue" })
  public async Shuffle(interaction: CommandInteraction): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true, isQueueMessage: true });
      interaction.editReply({content: "Sorry, this command is currently broken"});
      return;
      if (await server.queue.GetTotalLength() == 0) {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription("Queue is empty")] });
      } else {
        server.queue.Shuffle();
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription("Queue shuffled")] });
      }
    } catch (error) {
      MessageHandling.LogError("Shuffle", error, interaction.guild);
    }
  }

  @Slash({ name: "remove", description: "Remove an item at the index" })
  public async RemoveItem(
    @SlashOption({ name: "index", description: "The index of the song to remove", type: ApplicationCommandOptionType.Integer })
    indexString: string,
    interaction: CommandInteraction
  ): Promise<void> {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true, isQueueMessage: true });

      const index = parseInt(indexString);
      if (!server.queue.HasMedia()) {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`No songs are currently queued`)] });
      } else if (isNaN(index)) {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`Could not parse ${indexString}, please enter a whole number`)] });
      } else if (index == 1) {
        server.queue.RemoveItemAt(index - 1);
        server.audioPlayer.stop();
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`Currently playing song removed`)] });
      } else if (index > await server.queue.GetQueueCount()) {
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`You entered a number larger than the number of queued songs`)] });
      } else {
        const song = await server.queue.GetItemAt(index - 1);
        server.queue.RemoveItemAt(index - 1);
        interaction.editReply({ embeds: [new EmbedBuilder().setDescription(`${song.meta.title} at queue position ${index} removed`)] });
      }
    } catch (error) {
      MessageHandling.LogError("RemoveItem", error, interaction.guild);
    }
  }

  @Slash({ name: "status", description: "Returns the current status of the bot" })
  public async Status(interaction: CommandInteraction) {
    try {
      const server = await this.InitCommand({ interaction: interaction, isStatusMessage: true });
      const status = server.GetStatus();
      const vc: VoiceBasedChannel = await server.GetCurrentVC();
      let msg = "";

      switch (status) {
        case BotStatus.Idle:
          msg = "I'm ready and waiting for your commands";
          break;
        case BotStatus.InVC:
          msg = `I'm sitting in the *${vc.id}* voice chat, and waiting for your commands`
          break;
        case BotStatus.PlayingMusic:
          msg = `I'm currently playing [${(await server.queue.CurrentItem()).meta.title}](${(await server.queue.CurrentItem()).url}) in "${vc.id}"`
          break;
        default:
          msg = "I'm not sure what I'm up to";
          break;
      }

      interaction.editReply({ embeds: [new EmbedBuilder().setDescription(msg).setTitle("Current Status")] });
    } catch (error) {
      MessageHandling.LogError("Status", error, interaction.guild);
    }
  }

  @On({ event: "voiceStateUpdate" })
  public async VoiceStatusUpdate(voiceStates: [oldState: VoiceState, newState: VoiceState], _client: Client) {
    try {
      const server = await VolfbotServer.GetServerFromGuild(voiceStates[0].guild);
      let channel = await server.GetCurrentVC();

      if (channel != null) {
        if (channel.members.filter(m => !m.user.bot).size == 0) {
          server.DisconnectBot();
        } else {
          server.SetLastVC(channel);
        }
      } else if (server.queue.HasMedia()) {
        server.queue.Clear();
      }
    } catch (error) {
      MessageHandling.LogError("VoiceStatusUpdate", error, voiceStates[0].guild);
    }
  }

  private async InitCommand({ interaction, isStatusMessage: isStatusMessage, isQueueMessage: isQueueMessage, isNowPlayingMessage: isNowPlayingMessage }: InitCommandParams): Promise<VolfbotServer> {
    if (!interaction.deferred) {
      const reply = await interaction.deferReply({ fetchReply: true });
      const server = await VolfbotServer.GetServerFromGuild(interaction.guild);
      if (isStatusMessage) await server.UpdateStatusMessage(reply);
      if (isQueueMessage) await server.UpdateQueueMessage(reply);
      if (isNowPlayingMessage) await server.UpdateNowPlayingMessage(reply);
      server.SetLastChannel(interaction.channel);
      return server;
    } else {
      return VolfbotServer.GetServerFromGuild(interaction.guild);
    }
  }

  private async CheckForVoiceConnection(server: VolfbotServer, interaction: CommandInteraction): Promise<VoiceConnection> {
    const guildId = interaction.guild.id;
    let connection = getVoiceConnection(guildId); // get the current voice connection

    /* if the voice connection is undefined create a voice connection */
    if (connection === undefined) {
      server.UpdateStatusMessage(await server.lastChannel.send({ embeds: [await server.ConnectBot(interaction)] }));
      connection = getVoiceConnection(guildId);
    }

    return connection;
  }

  private CheckMediaStatus(media: PlayableResource, isPlaylist: boolean, username: string): [boolean, EmbedBuilder] {
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
      embed.setDescription(`[${meta.title}](${media.url}) [${userMention(meta.queuedBy)}]`);
    }

    return [mediaError, embed];
  }

  private async DealWithMedia(interaction: CommandInteraction, url: string, server: VolfbotServer, queue = true): Promise<Array<PlayableResource> | PlayableResource | null> {
    const mediaType = await MediaQueue.DetermineMediaType(url, server).catch(error => {
      this.HandleDetermineMediaTypeError(error, interaction);
    });

    let media: Array<PlayableResource>;

    if (mediaType[0] == MediaType.yt_playlist) {
      media = await MediaQueue.CreateYoutubePlaylistResource(mediaType[1], interaction.user.id, server);
    } else if (mediaType[0] == MediaType.yt_video || mediaType[0] == MediaType.yt_search) {
      media = new Array<PlayableResource>();
      let vid = new PlayableResource(server, mediaType[1]);
      vid.meta = await MediaQueue.GetMetadata(vid.url, interaction.user.id, server);
      media.push(vid);
    }

    if (media !== undefined && queue) {
      server.queue.Enqueue(media);
    }

    let videoToTest: PlayableResource;
    const vid: PlayableResource = media[0];

    if (vid.meta.title === '') {
      vid.meta = await MediaQueue.GetMetadata(vid.url, interaction.user.id, server, mediaType[1]);
    }

    videoToTest = vid;

    let mediaStatus = this.CheckMediaStatus(videoToTest, mediaType[0] == MediaType.yt_playlist, interaction.user.id);

    if (mediaStatus[0]) {
      server.UpdateQueueMessage(await interaction.editReply({ embeds: [mediaStatus[1]] }));
      return;
    } else {

      let extraLength: number = 1;

      if (media instanceof Array<PlayableResource>) {
        extraLength = media.length;
      }

      server.UpdateQueueMessage(await interaction.editReply({ embeds: [mediaStatus[1].setTitle(mediaStatus[1].data.title + ` — ${(await server.queue.GetQueueCount()) + extraLength} Songs in Queue`)] }));
    }

    return media;
  }

  private async HandleDetermineMediaTypeError(error, interaction) {
    if (error instanceof EmbedBuilder) {
      interaction.editReply({ embeds: [error] });
    } else {
      throw error;
    }
  }
}

interface InitCommandParams {
  interaction: CommandInteraction;
  isStatusMessage?: boolean;
  isQueueMessage?: boolean;
  isNowPlayingMessage?: boolean;
}