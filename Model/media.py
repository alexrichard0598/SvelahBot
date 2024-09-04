from abc import ABC, abstractmethod

from model.metadata import Metadata


class Media(ABC):
  @abstractmethod
  def __init__(self) -> None:
    self.metadata: Metadata

  @abstractmethod
  def isPlaylist() -> bool:
    pass

  @abstractmethod
  @property
  def metadata(self) -> Metadata:
    pass