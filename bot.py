import os
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

intents = discord.Intents.default()
bot = commands.Bot(command_prefix=';', intents=intents, help_command=None)

@bot.event
async def on_ready():
    try:
        synced = await bot.tree.sync()
        print(f'Logged in as {bot.user} (ID: {bot.user.id})')
        print(f'Ready to delete messages with /p. Synced {len(synced)} command(s).')
    except Exception as exc:
        print(f'Logged in as {bot.user} (ID: {bot.user.id}), but failed to sync commands: {exc}')

@bot.tree.command(name='p', description='Delete messages in this channel')
async def purge_channel(interaction: discord.Interaction):
    if interaction.guild is None:
        await interaction.response.send_message('This command must be used in a server channel.', ephemeral=True)
        return

    if not interaction.user.guild_permissions.manage_messages:
        await interaction.response.send_message('You need the Manage Messages permission to use this command.', ephemeral=True)
        return

    if not isinstance(interaction.channel, discord.TextChannel):
        await interaction.response.send_message('This command only works in text channels.', ephemeral=True)
        return

    await interaction.response.defer(thinking=True, ephemeral=True)
    deleted_count = 0

    try:
        bulk_deleted = await interaction.channel.purge(limit=None, bulk=True)
        deleted_count += len(bulk_deleted)
    except discord.HTTPException:
        pass

    try:
        fallback_deleted = await interaction.channel.purge(limit=None, bulk=False)
        deleted_count += len(fallback_deleted)
    except discord.HTTPException:
        pass

    await interaction.followup.send(f'Cleaned up {deleted_count} messages.', ephemeral=True)

if __name__ == '__main__':
    token = os.getenv('DISCORD_TOKEN')
    if not token:
        raise SystemExit('Set the DISCORD_TOKEN environment variable in a `.env` file or as an environment variable before running this bot.')

    bot.run(token)
