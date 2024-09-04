from abc import ABC, abstractmethod
from typing import List
from model.media import Media
from model.metadata import Metadata
from service.discord_server import DiscordServer


class MediaQueue:

  def __init__(self, server: DiscordServer) -> None:
    self.__mediaList: List[Media] = List[Media]
    self.looping: bool = False
    self.server: DiscordServer = server
  
  @property
  def looping(self):
    return self.looping
  
  @property
  def server(self):
    return self

  def startLooping(self):
    self.looping = True

  def stopLooping(self):
    self.looping = False

  def enqueueMedia(self, media: Media):
    self.__mediaList.append(media)
    if(not self.isPlaying()):
      self.__startPlayback()

  def isPlaying(self) -> bool:
    return False
  
  def __startPlayback(self) -> bool:
    pass
