from typing import Optional
from discord import User
from model.youtube_playlist import YouTubePlaylist

class Metadata:
  def __init__(self, title: str, length: int, queuedBy: User, playlist: Optional[YouTubePlaylist] = None):
    self.title: str = title
    self.length: int = length
    self.queuedBy: User = queuedBy
    self.isPlaylist: bool = not playlist is None
    self.playlist: Optional[YouTubePlaylist] = playlist
  
  @property
  def title(self):
    return self.title
  
  @property
  def length(self):
    return self.length
  
  @property
  def queuedBy(self):
    return self.queuedBy
  
  @property
  def isPlaylist(self):
    return self.isPlaylist
  
  @property
  def playlist(self):
    return self.playlist