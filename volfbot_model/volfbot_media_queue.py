"""The module containing the MediaQueue class"""

from typing import List, Optional

from volfbot_service import discord_server
from volfbot_model import volfbot_media


class MediaQueue:
    """The MediaQueue class and related methods"""

    def __init__(self, server) -> None:
        self.__media_list: List[volfbot_media.Media] = []
        self._looping: bool = False
        self._server: discord_server.DiscordServer = server
        self._index: int = 0

    @property
    def looping(self):
        """Whether or not the MediaQueue is looping

        Returns:
            bool: True if looping
        """
        return self._looping

    @property
    def index(self) -> int:
        """Returns the current media queue index

        Returns:
            int: the current index
        """
        return self._index

    def increment_index(self):
        """Increase index by 1"""
        self._index = self._index + 1

    @property
    def current_media(self) -> Optional[volfbot_media.Media]:
        """Returns the current playing Media

        Returns:
            Optional[Media]: returns the current playing Media or None if no current playing media
        """
        if self.has_media():
            return self.__media_list[self.index]
        return None

    def start_looping(self):
        """Starts the media queue looping"""
        self._looping = True

    def stop_looping(self):
        """Stops the media queue looping"""
        self._looping = False

    def enqueue_media(self, media_to_enqueue: volfbot_media.Media) -> bool:
        """Enqueues the media into the MediaQueue

        Args:
            media (Media): The media to enqueue
        """
        self.__media_list.append(media_to_enqueue)
        self.__start_playback()
        return True

    def clear_queue(self) -> bool:
        """Clears the queue

        Returns:
            bool: if the queue was cleared
        """
        if self.is_playing():
            return False
        self.__media_list = []
        return True

    def stop_media(self) -> bool:
        """Stops the current playing media

        Returns:
            bool: if the media was successfully stopped
        """
        if not self.is_playing():
            return False
        self._server.voice_client.stop()
        self.index = 0
        return True

    def is_playing(self) -> bool:
        """Gets if the MediaQueue is currently playing media"""
        if isinstance(self._server, discord_server.DiscordServer):
            return self._server.voice_client.is_playing()

    def has_media(self) -> bool:
        """Does the media queue have unplayed media

        Returns:
            bool: returns true if media queue is not empty and index is not greater than media_count
        """
        media_count = len(self.__media_list)
        return media_count > 0 and self.index + 1 <= media_count

    def __start_playback(self) -> bool:
        if not self.is_playing():
            current_media = self.current_media
            if current_media is not None:
                audio_source = current_media.play()
                self._server.voice_client.play(
                    audio_source, after=self.__continue_playback()
                )
                return True

        return False

    def __continue_playback(self):
        self.increment_index()
        if self.has_media():
            self.__start_playback()
