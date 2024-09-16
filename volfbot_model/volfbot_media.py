"""The module containing the Media abstract class"""

from abc import ABC, abstractmethod

from volfbot_model import volfbot_metadata
from discord import AudioSource


class Media(ABC):
    """The abstract class Media"""

    def __init__(self, url: str, media_queue) -> None:
        self._url = url
        self._queue = media_queue

    def is_playlist(self) -> bool:
        """Gets whether it is a playlist

        Returns:
            bool: returns true when a playlist
        """

    @property
    def metadata(self) -> volfbot_metadata.Metadata:
        """Gets the metadata about the media

        Returns:
            Metadata: The media metadata
        """

    @property
    def url(self) -> str:
        return self._url

    @abstractmethod
    def play(self) -> AudioSource:
        """Streams the audio to the connected server"""
