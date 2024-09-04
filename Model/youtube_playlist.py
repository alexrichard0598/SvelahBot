from model.media import Media
from model.metadata import Metadata

class YouTubePlaylist(Media):
  def isPlaylist() -> bool:
    return True
  
  @property
  def metadata(self) -> Metadata:
    if not self.metadata is None:
      return self.metadata
    #else do punch of work