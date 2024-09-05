"""A module containing the DiscordServer class"""
from typing import Optional
from discord import Guild, TextChannel, VoiceChannel
from model.media import Media
from model.media_queue import MediaQueue


class DiscordServer:
    """A Discord server and related methods
    """

    def __init__(self, guild) -> None:
        self._server_guild: Guild = guild
        self._last_text_channel: Optional[TextChannel] = None
        self._last_voice_channel: Optional[VoiceChannel] = None
        self.__media_queue: MediaQueue = MediaQueue(self)

    @property
    def server_guild(self) -> Guild:
        """The server Guild

        Returns:
            Guild: The guild object
        """
        return self._server_guild

    @property
    def last_text_channel(self):
        """The last text channel the bot received a command from

        Returns:
            Optional[TextChannel]: The last text channel the bot received a command from, 
            or None if bot hasn't received any commands yet
        """
        return self._last_text_channel

    @last_text_channel.setter
    def last_text_channel(self, value: TextChannel):
        self._last_text_channel = value

    @property
    def last_voice_channel(self):
        """The last voice channel the bot connected to

        Returns:
            Optional[TextChannel]: The last voice channel the bot connected to, 
            or None if bot hasn't connected to any voice channels yet
        """
        return self._last_text_channel

    @last_voice_channel.setter
    def last_voice_channel(self, value: VoiceChannel):
        self._last_voice_channel = value

    def enqueue_media(self, media: Media):
        """Enqueues the media given, and starts playback if it isn't currently playing

        Args:
            media (Media): The media object to play
        """
        self.__media_queue.enqueue_media(media)

    def connect_to_vc(self, vc: VoiceChannel):
        """Connects to the provided voice channel

        Args:
            vc (VoiceChannel): The voice channel to connect to
        """
