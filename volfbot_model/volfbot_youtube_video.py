"""The module containing YouTube Video"""
from discord import FFmpegPCMAudio, User
from yt_dlp import YoutubeDL

from volfbot_model import volfbot_media, volfbot_metadata


class YouTubeVideo(volfbot_media.Media):
    """A YouTube video"""

    def __init__(self, url: str, queued_by: User, media_queue) -> None:
        super().__init__(url, media_queue)
        self._metadata = self.__fetch_metadata(queued_by)

    def is_playlist(self) -> bool:
        """Gets whether it is a playlist

        Returns:
            bool: returns true when a playlist
        """
        return False

    @property
    def metadata(self) -> volfbot_metadata.Metadata:
        return self._metadata

    def __fetch_metadata(self, queued_by) -> volfbot_metadata.Metadata:
        title = ""
        duration = 0

        ytdl_ops = {
            'format': 'm4a/bestaudio/best',
            'quiet': True,
            'noplaylist': True,
            'extract_flat': True,  # To get the URL only
        }

        with YoutubeDL(ytdl_ops) as ytdl:
            extracted_info = ytdl.extract_info(self._url, False)
            title = extracted_info['title']
            duration = extracted_info['duration']
            url = extracted_info['url']

        self._metadata = volfbot_metadata.Metadata(title, duration, queued_by, url)
        return self._metadata

    def play(self) -> FFmpegPCMAudio:
        audio_source = FFmpegPCMAudio(self.metadata.stream_url)
        return audio_source
