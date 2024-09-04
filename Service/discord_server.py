from typing import Optional
from discord import Guild, TextChannel, VoiceChannel
from model.media import Media
from model.media_queue import MediaQueue;

class DiscordServer:

  def __init__(self, guild) -> None:
    self.guild: Guild = guild
    self.lastTextChannel: Optional[TextChannel] = None
    self.lastVoiceChannel: Optional[VoiceChannel] = None
    self.__mediaQueue: MediaQueue = MediaQueue(self)

  @property
  def guild(self) -> Guild:
    return self.guild
  
  @property
  def lastTextChannel(self):
    return self.lastTextChannel
  
  @lastTextChannel.setter
  def lastTextChannel(self, value: TextChannel):
    self.lastTextChannel = value

  @property
  def lastVoiceChannel(self):
    return self.lastTextChannel
  
  @lastVoiceChannel.setter
  def lastVoiceChannel(self, value: VoiceChannel):
    self.lastVoiceChannel = value

  def enqueueMedia(self, media: Media):
    self.__mediaQueue.enqueueMedia(media)