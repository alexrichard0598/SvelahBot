"""A module containing the DiscordServer class"""
import asyncio
import re
from typing import Optional
from discord import Guild, TextChannel, VoiceChannel, VoiceClient, User
import discord
from volfbot_model.volfbot_youtube_video import YouTubeVideo
from volfbot_model.volfbot_media import Media
from volfbot_model.volfbot_media_queue import MediaQueue


class DiscordServer:
    """A Discord server and related methods
    """

    def __init__(self, guild) -> None:
        self._server_guild: Guild = guild
        self._last_text_channel: Optional[TextChannel] = None
        self._last_voice_channel: Optional[VoiceChannel] = None
        self.__media_queue: MediaQueue = MediaQueue(self)
        self.__media_queue.server = self
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
    def id(self) -> int:
        """Return the guild id"""
        return self.server_guild.id

    @property
    def voice_client(self) -> Optional[VoiceClient]:
        """Returns the voice client

        Returns:
            Optional[VoiceClient]: the voice client
        """
        return self.__voice_client

    async def send_text(self, content: str) -> bool:
        """Sends a text message

        Args:
            content (str): the text to send

        Returns:
            bool: returns true if successful, returns false if throws HTTPException or Forbidden
        """
        try:
            await self._last_text_channel.send(content)
            return True
        except (discord.HTTPException, discord.Forbidden):
            return False

    def create_media(self, link: str, queued_by: User) -> Optional[Media]:
        """Creates a media object from the provided URL

        Args:
            link (str): the link to the media object to create

        Returns:
            Optional[Media]: the media object if the link is supported
        """
        youtube_regex = re.compile(
            r'^(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/'
            r'(watch\?v=|embed/|v/|.+\?v=)?([A-Za-z0-9_-]{11})'
        )

        # Match the URL against the regex pattern
        match = youtube_regex.match(link)

        if bool(match):
            playlist_regex = re.compile(r'list=[A-Za-z0-9_-]{34}')
            is_playlist = bool(playlist_regex.match(link))
            if is_playlist:
                return None

            return YouTubeVideo(link, queued_by, self.__media_queue)

        return None

    def enqueue_media(self, media: Media) -> bool:
        """Enqueues the media given, and starts playback if it isn't currently playing

        Args:
            media (Media): The media object to play
        """
        return self.__media_queue.enqueue_media(media)

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
