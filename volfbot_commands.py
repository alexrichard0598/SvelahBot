from discord import Interaction, app_commands
from discord.ext import commands
from volfbot_model.volfbot_media import Media
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

    @app_commands.command(
        name="join",
        description="Join the vc the user is currently connected to, if any"
    )
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

    @app_commands.command(
        name="disconnect",
        description="Disconnects from any connected vc, if any"
    )
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

    @app_commands.command(
        name="metadata",
        description="Retrieves the metadata from a youtube video"
    )
    @app_commands.describe(link="The YouTube link to get metadata for")
    async def fetch_metadata(self, interaction: Interaction, link: str):
        """Plays the sent media"""
        server = await self.__command_ready(interaction)
        media = server.create_media(link, interaction.user)
        await interaction.edit_original_response(
            content=f"Metadata retrieved: {media.metadata.to_str()}"
        )

    @app_commands.command(name="play", description="Plays the provided YouTube link")
    @app_commands.describe(link="The YouTube link to play")
    async def play(self, interaction: Interaction, link: str):
        """Plays the sent media"""
        server = await self.__command_ready(interaction)
        success = await server.connect_to_vc(interaction.user.voice.channel)
        if success is not None:
            if success:
                await server.send_text(f"Connected to {server.last_voice_channel.name}")
            else:
                await server.send_text(f"Failed to connect to {server.last_voice_channel}")

        media: Media = server.create_media(link, interaction.user)
        enqueued = server.enqueue_media(media)
        if enqueued:
            interaction.edit_original_response(
                content=f"Enqueued {media.metadata.title}"
            )
        else:
            interaction.edit_original_response(
                content=f"Failed to enqueue {media.url}"
            )

    async def __command_ready(self, interaction: Interaction) -> DiscordServer:
        await interaction.response.defer(thinking=True)
        server: DiscordServer = Servers.get_server(
            DiscordServer(interaction.guild))
        server.last_text_channel = interaction.channel
        return server
