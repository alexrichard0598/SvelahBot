from typing import List
from service.discord_server import DiscordServer


class Servers:
  ServerList: List[DiscordServer] = []

  @staticmethod
  def GetServer(server: DiscordServer) -> DiscordServer:
    fetched_server = Servers.FetchServer(server.ID)
    if fetched_server is None:
      Servers.ServerList.append(server)
      return server
    return fetched_server

  @staticmethod
  def FetchServer(id: int):
    for server in Servers.ServerList:
      if server.ID == id:
        return server
    return None