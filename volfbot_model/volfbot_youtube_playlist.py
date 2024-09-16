"""The module containing the YouTubePlaylist class"""
from volfbot_model import volfbot_media, volfbot_metadata


class YouTubePlaylist(volfbot_media.Media):
    """A YouTube Playlist"""
    def is_playlist(self) -> bool:
        return True

    @property
    def metadata(self) -> volfbot_metadata.Metadata:
        if not self.metadata is None:
            return self.metadata
        # else do punch of work
