from typing import List
from service.discord_server import DiscordServer


class Servers:
  serverList: List[DiscordServer] = []

  @staticmethod
  def GetServer(server: DiscordServer) -> DiscordServer:
    fetchedServer = Servers.FetchServer(server.ID)
    if fetchedServer is None:
      Servers.serverList.append(server)
      return server
    return fetchedServer

  @staticmethod
  def FetchServer(id: int):
    for server in Servers.serverList:
      if server.ID == id:
        return server
    return None