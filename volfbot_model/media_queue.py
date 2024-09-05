"""The module containing the MediaQueue class"""

from typing import List
from volfbot_model.media import Media
from volfbot_service.discord_server import DiscordServer


class MediaQueue:
    """The MediaQueue class and related methods"""

    def __init__(self, server: DiscordServer) -> None:
        self.__media_list: List[Media] = List[Media]
        self._looping: bool = False
        self._server: DiscordServer = server

    @property
    def looping(self):
        """Whether or not the MediaQueue is looping

        Returns:
            bool: True if looping
        """
        return self._looping

    @property
    def server(self):
        """The DiscordServer the MediaQueue belongs to

        Returns:
            DiscordServer: The DiscordServer the MediaQueue belongs to
        """
        return self

    def start_looping(self):
        """Starts the media queue looping"""
        self._looping = True

    def stop_looping(self):
        """Stops the media queue looping"""
        self._looping = False

    def enqueue_media(self, media: Media):
        """Enqueues the media into the MediaQueue

        Args:
            media (Media): The media to enqueue
        """
        self.__media_list.append(media)
        if not self.is_playing():
            self.__start_playback()

    def is_playing(self) -> bool:
        """Gets if the MediaQueue is currently playing media"""
        return False

    def __start_playback(self) -> bool:
        pass
