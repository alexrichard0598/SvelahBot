"""The module containing the YouTubePlaylist class"""
from volfbot_model.media import Media
from volfbot_model.metadata import Metadata


class YouTubePlaylist(Media):
    """A YouTube Playlist"""
    def is_playlist(self) -> bool:
        return True

    @property
    def metadata(self) -> Metadata:
        if not self.metadata is None:
            return self.metadata
        # else do punch of work
