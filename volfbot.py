"""The main module for Volfbot"""

import json
import logging
import logging.handlers
from typing import List
import discord
from discord import Intents, app_commands
from discord.ext import commands
from volfbot_commands import VolfbotCommands

settingsFile = open("appSettings.json", encoding="utf-8")
settingsText = settingsFile.read()
settings = json.loads(settingsText)

DEV_GUILD = discord.Object(id=settings["DevServerId"])

class VolfbotClient(commands.Bot):
    """The main class for Volfbot"""

    def __init__(self, *, bot_intents: Intents):
        super().__init__(command_prefix="!",intents=bot_intents)

    async def setup_hook(self):
        volfbot_commands = VolfbotCommands(bot)
        await bot.add_cog(volfbot_commands)
        await self.register_commands()

    async def on_ready(self):
        """When bot is connected and ready print logged in message"""
        print('Logged in as', self.user)

    async def register_commands(self):
        """Register Bot command"""
        print(f"Registering commands with {DEV_GUILD.id}")
        self.tree.copy_global_to(guild=DEV_GUILD)
        commands_list: List[app_commands.AppCommand] = await self.tree.sync(guild=DEV_GUILD)
        print(commands_list)
        for cmd in commands_list:
            print('Registered command: ', cmd.name)


handler = logging.handlers.RotatingFileHandler(
    filename="volfbot.log", encoding="utf-8", mode="w", maxBytes=100*1024*1024, backupCount=5
)

intents = discord.Intents.default()
intents.message_content = True

bot = VolfbotClient(bot_intents=intents)

bot.run(settings['DiscordToken'], log_handler=handler)
