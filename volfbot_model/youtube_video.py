"""The module containing YouTube Video"""
from volfbot_model.media import Media
from volfbot_model.metadata import Metadata


class YouTubeVideo(Media):
    """A YouTube video"""

    def is_playlist(self) -> bool:
        return False

    @property
    def metadata(self) -> Metadata:
        if not self.metadata is None:
            return self.metadata
        # else do punch of work
