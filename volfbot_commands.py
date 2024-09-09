from discord import Interaction, app_commands
from discord.ext import commands
from volfbot_service.discord_server import DiscordServer
from volfbot_service.servers import Servers


class VolfbotCommands(commands.Cog):
    """A class that contains all of the slash commands for Volfbot"""

    def __init__(self, bot: commands.Bot) -> None:
        self.bot = bot

    @app_commands.command(name="foo")
    async def test(self, interaction: Interaction):
        """A test method"""
        await interaction.response.send_message("bar")

    @app_commands.command(name="join",
                          description="Join the vc the user is currently connected to, if any")
    async def join(self, interaction: Interaction):
        """Join the vc the user is currently connected to, if any"""
        server = await self.__command_ready(interaction)
        success = await server.connect_to_vc(interaction.user.voice.channel)
        if success is None:
            await interaction.edit_original_response(
                content=f"I'm already connected to {server.last_voice_channel}")
        elif success:
            await interaction.edit_original_response(
                content=f"Connected to {server.last_voice_channel.name}")
        else:
            await interaction.edit_original_response(
                content=f"Failed to connect to {server.last_voice_channel}")

    @app_commands.command(name="disconnect",
                          description="Disconnects from any connected vc, if any")
    async def disconnect(self, interaction: Interaction):
        """Disconnects from the VC"""
        server = await self.__command_ready(interaction)
        success = await server.disconnect_from_vc()
        if success:
            await interaction.edit_original_response(
                content=f"Disconnected from {server.last_voice_channel}")
        else:
            await interaction.edit_original_response(
                content="I'm not currently connected to any voice channels")

    async def __command_ready(self, interaction: Interaction) -> DiscordServer:
        await interaction.response.defer(thinking=True)
        server: DiscordServer = Servers.get_server(
            DiscordServer(interaction.guild))
        server.last_text_channel = interaction.channel
        return server
