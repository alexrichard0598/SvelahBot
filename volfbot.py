"""The main module for Volfbot"""

import json
import logging
import logging.handlers
import discord
from discord import Intents, Interaction, app_commands, Client
from volfbot_service.discord_server import DiscordServer
from volfbot_service.servers import Servers


class VolfbotClient(Client):
    """The main class for Volfbot"""

    def __init__(self, *, bot_intents: Intents):
        super().__init__(intents=bot_intents)
        self.tree = app_commands.CommandTree(self)

    async def on_ready(self):
        """When bot is connected and ready print logged in message"""
        print('Logged in as', self.user)

    async def setup_hook(self):
        self.tree.copy_global_to(guild=DEV_GUILD)
        await self.tree.sync(guild=DEV_GUILD)


handler = logging.handlers.RotatingFileHandler(
    filename="volfbot.log", encoding="utf-8", mode="w", maxBytes=100*1024*1024, backupCount=5)
intents = discord.Intents.default()
intents.message_content = True
client = VolfbotClient(bot_intents=intents)

settingsFile = open("appSettings.json", encoding="utf-8")
settingsText = settingsFile.read()
settings = json.loads(settingsText)
DEV_GUILD = discord.Object(id=settings["DevServerId"])
client.run(settings['DiscordToken'], log_handler=handler)

# Commands beyond here
class VolfbotCommands:
    """A class that contains all of the slash commands for Volfbot"""

    @client.tree.command(name="foo")
    async def test(self, interaction: Interaction):
        """A test method"""
        await interaction.response.send_message("bar")


    @client.tree.command()
    async def join(self, interaction: Interaction):
        """Join the vc the user is currently connected to, if any"""
        server = self.__command_ready(interaction)
        server.Connect(interaction.user.voice.channel)

    async def __command_ready(self, interaction: Interaction) -> DiscordServer:
        await interaction.response.defer(thinking=True)
        server: DiscordServer = await Servers.get_server(DiscordServer(interaction.guild))
        server.last_text_channel = interaction.channel
        return server
