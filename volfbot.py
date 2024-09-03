import json
import logging
import logging.handlers
import discord
from discord.ext import commands
from discord import app_commands

class VolfbotClient(discord.Client):
  def __init__(self, *, intents: discord.Intents):
    super().__init__(intents=intents)
    self.tree = app_commands.CommandTree(self)

  async def on_ready(self):
    print('Logged in as', self.user)

  async def setup_hook(self):
    self.tree.copy_global_to(guild=DEV_GUILD)
    await self.tree.sync(guild=DEV_GUILD)

handler = logging.handlers.RotatingFileHandler(filename="volfbot.log", encoding="utf-8", mode="w", maxBytes=100*1024*1024, backupCount=5)
intents = discord.Intents.default()
intents.message_content = True
client = VolfbotClient(intents=intents)

@client.tree.command()
@app_commands.describe(arg="the message to echo")
async def foo(interaction: discord.Interaction, arg:str):
  await interaction.response.send_message(f"foobar: {arg}")


settingsFile = open("appSettings.json")
settingsText = settingsFile.read()
settings = json.loads(settingsText)
DEV_GUILD = discord.Object(id=settings["DevServerId"])
client.run(settings['DiscordToken'], log_handler=handler)