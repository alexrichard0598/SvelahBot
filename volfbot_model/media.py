"""The module containing the Media abstract class"""

from abc import ABC, abstractmethod
from volfbot_model.metadata import Metadata


class Media(ABC):
    """The abstract class Media"""

    @abstractmethod
    def __init__(self) -> None:
        self.metadata: Metadata

    @abstractmethod
    def is_playlist(self) -> bool:
        """Gets whether it is a playlist

        Returns:
            bool: returns true when a playlist
        """

    @property
    @abstractmethod
    def metadata(self) -> Metadata:
        """Gets the metadata about the media

        Returns:
            Metadata: The media metadata
        """
