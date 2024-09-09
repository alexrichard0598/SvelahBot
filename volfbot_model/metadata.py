"""The module containing the Metadata class"""

from typing import Optional
from discord import User


class Metadata:
    """The metadata class for storing and accessing media metadata"""

    def __init__(self, title: str, length: int, queued_by: User,
                    playlist: Optional[str] = None):
        self._title: str = title
        self._length: int = length
        self._queued_by: User = queued_by
        self._is_playlist: bool = not playlist is None
        self._playlist: Optional[str] = playlist

    @property
    def title(self) -> str:
        """The media title

        Returns:
            str: The Title
        """
        return self._title

    @property
    def length(self) -> int:
        """The media length in seconds

        Returns:
            int: The number of seconds of media
        """
        return self._length

    @property
    def queued_by(self) -> bool:
        """Who the media was queued by

        Returns:
            User: A discord user
        """
        return self._queued_by

    @property
    def is_playlist(self) -> bool:
        """_summary_

        Returns:
            _type_: _description_
        """
        return self._is_playlist

    @property
    def playlist(self) -> Optional[str]:
        """The YouTube playlist

        Returns:
            Optional[YouTubePlaylist]: returns None if metadata isn't for a YouTubePlaylist
        """
        return self._playlist
