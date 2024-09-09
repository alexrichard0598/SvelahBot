"""A module containing the DiscordServer class"""
import asyncio
from typing import Optional
from discord import Guild, TextChannel, VoiceChannel, VoiceClient
from volfbot_model.media import Media
from volfbot_model.media_queue import MediaQueue


class DiscordServer:
    """A Discord server and related methods
    """

    def __init__(self, guild) -> None:
        self._server_guild: Guild = guild
        self._last_text_channel: Optional[TextChannel] = None
        self._last_voice_channel: Optional[VoiceChannel] = None
        self.__media_queue: MediaQueue = MediaQueue()
        self.__voice_client: Optional[VoiceClient] = None

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
        return self._last_voice_channel

    @last_voice_channel.setter
    def last_voice_channel(self, value: VoiceChannel):
        self._last_voice_channel = value

    @property
    def ID(self):
        return self.server_guild.id

    def enqueue_media(self, media: Media):
        """Enqueues the media given, and starts playback if it isn't currently playing

        Args:
            media (Media): The media object to play
        """
        self.__media_queue.enqueue_media(media)

    async def connect_to_vc(self, vc: VoiceChannel) -> Optional[bool]:
        """Connects to the provided voice channel

        Args:
            vc (VoiceChannel): The voice channel to connect to
        """
        try:
            if not self.is_connected(vc):
                self.__voice_client: VoiceClient = await vc.connect()
                self.last_voice_channel = vc
                return True
            else:
                return None
        except asyncio.TimeoutError:
            return False


    async def disconnect_from_vc(self, vc: Optional[VoiceChannel] = None) -> bool:
        """Disconnects from the specified voice channel

        Args:
            vc (Optional[VoiceChannel]): The voice channel to disconnect from, defaults to None

        Returns:
            bool: If the disconnect was successful
        """
        if vc is None or self.is_connected(vc):
            await self.__voice_client.disconnect()
            return True
        else:
            return False

    def is_connected(self, vc: VoiceChannel) -> bool:
        """Checks if the bot is connected to the specified vc

        Args:
            vc (VoiceChannel): The voice channel to check

        Returns:
            bool: True if connected to the specified vc
        """
        if not self.__voice_client is None:
            if self.__voice_client.is_connected():
                if self.__voice_client.channel.id == vc.id:
                    return True
        else:
            return False
