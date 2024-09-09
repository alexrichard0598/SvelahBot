"""A module with the Servers class"""
from typing import List, Optional
from volfbot_service.discord_server import DiscordServer


class Servers:
    """Has the method to store and load DiscordServers"""
    serverList: List[DiscordServer] = []

    @staticmethod
    def get_server(server: DiscordServer) -> DiscordServer:
        """If the server already exists in the list returns the server from the list,
        otherwise adds the server to the list and return the server passed in

        Args:
            server (DiscordServer): The server to Get/Add

        Returns:
            DiscordServer: Either a fetched server, or if a new server was passed in, 
            returns the same server
        """
        fetched_server = Servers.__fetch_server(server.ID)
        if fetched_server is None:
            Servers.serverList.append(server)
            return server
        return fetched_server

    @staticmethod
    def __fetch_server(server_id: int) -> Optional[DiscordServer]:
        """Fetch a server from the list of servers using the id

        Args:
            id (int): The snowflake for the guild

        Returns:
            _type_: The found DiscordServer or if no server was found returns None
        """
        for server in Servers.serverList:
            if server.ID == server_id:
                return server
        return None
