from model.media import Media
from model.metadata import Metadata

class YouTubeVideo(Media):
  def isPlaylist() -> bool:
    return False
  
  @property
  def metadata(self) -> Metadata:
    if not self.metadata is None:
      return self.metadata
    #else do punch of work