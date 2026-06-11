from flask import Flask, render_template, request, jsonify
import requests
import os
import time
from dotenv import load_dotenv

# Load environment variables from .env (if present)
load_dotenv()

app = Flask(__name__, static_folder='static', template_folder='templates')


@app.route('/')
def index():
    discord_token = os.getenv('DISCORD_TOKEN', '')
    def mask_token(t):
        if not t:
            return ''
        if len(t) <= 8:
            return '•' * (len(t)-4) + t[-4:]
        return '•' * (len(t)-8) + t[-8:-4] + ' ' + t[-4:]

    discord_token_masked = mask_token(discord_token)
    return render_template('index.html', discord_token=discord_token, discord_token_masked=discord_token_masked)


@app.route('/send', methods=['POST'])
def send():
    data = request.json or {}
    payload = {}
    if 'content' in data:
        payload['content'] = data['content']
    if 'embeds' in data:
        payload['embeds'] = data['embeds']
    if 'components' in data:
        payload['components'] = data['components']

    webhook = data.get('webhook_url')
    if webhook:
        try:
            r = requests.post(webhook, json=payload, timeout=10)
            return jsonify({'status': r.status_code, 'response': r.text, 'json': r.json() if r.headers.get('content-type','').startswith('application/json') else None}), r.status_code
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    bot_token = data.get('bot_token')
    channel_id = data.get('channel_id')
    if bot_token and channel_id:
        url = f'https://discord.com/api/v10/channels/{channel_id}/messages'
        headers = {'Authorization': f'Bot {bot_token}', 'Content-Type': 'application/json'}
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=10)
            return jsonify({'status': r.status_code, 'response': r.text, 'json': r.json() if r.headers.get('content-type','').startswith('application/json') else None}), r.status_code
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'no webhook_url or bot_token+channel_id provided'}), 400


@app.route('/messages', methods=['POST'])
def list_messages():
    data = request.json or {}
    bot_token = data.get('bot_token')
    channel_id = data.get('channel_id')
    limit = int(data.get('limit', 50))

    if bot_token and channel_id:
        headers = {'Authorization': f'Bot {bot_token}'}
        try:
            me_res = requests.get('https://discord.com/api/v10/users/@me', headers=headers, timeout=10)
            if me_res.status_code != 200:
                return jsonify({'error': 'failed to fetch bot identity', 'response': me_res.text}), me_res.status_code
            bot_id = me_res.json().get('id')

            url = f'https://discord.com/api/v10/channels/{channel_id}/messages'
            r = requests.get(url, headers=headers, params={'limit': limit}, timeout=10)
            if r.status_code != 200:
                return jsonify({'error': 'failed to fetch messages', 'response': r.text}), r.status_code

            messages = r.json()
            if isinstance(messages, list) and bot_id:
                messages = [m for m in messages if m.get('author', {}).get('id') == bot_id]
            return jsonify(messages), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'bot_token and channel_id required to list messages'}), 400


@app.route('/channels', methods=['POST'])
def list_channels():
    data = request.json or {}
    bot_token = data.get('bot_token')

    if not bot_token:
        return jsonify({'error': 'bot_token required to list channels'}), 400

    headers = {'Authorization': f'Bot {bot_token}'}
    try:
        guilds_res = requests.get('https://discord.com/api/v10/users/@me/guilds', headers=headers, timeout=10)
        if guilds_res.status_code == 429:
            return jsonify({'error': 'rate limited by Discord API, try again in a moment'}), 429
        if guilds_res.status_code != 200:
            return jsonify({'error': 'failed to list guilds', 'response': guilds_res.text}), guilds_res.status_code

        guilds = guilds_res.json()
        result = []
        for guild in guilds:
            guild_id = guild.get('id')
            if not guild_id:
                continue
            
            time.sleep(0.1)
            
            channels_res = requests.get(f'https://discord.com/api/v10/guilds/{guild_id}/channels', headers=headers, timeout=10)
            if channels_res.status_code == 429:
                continue
            
            channels_by_category = {}
            if channels_res.status_code == 200:
                all_channels = channels_res.json()
                categories = {}
                
                for c in all_channels:
                    if c.get('type') == 4:
                        categories[c.get('id')] = c.get('name')
                
                for c in all_channels:
                    if c.get('type') in (0, 5):
                        category_id = c.get('parent_id') or 'no_category'
                        if category_id not in channels_by_category:
                            category_name = categories.get(category_id) if category_id != 'no_category' else None
                            channels_by_category[category_id] = {
                                'name': category_name,
                                'channels': []
                            }
                        channels_by_category[category_id]['channels'].append({
                            'id': c.get('id'),
                            'name': c.get('name') or c.get('id'),
                            'guild_id': guild_id,
                        })
            # include icon if present so frontend can render guild icons
            guild_entry = {'id': guild_id, 'name': guild.get('name', guild_id), 'channels_by_category': channels_by_category}
            if guild.get('icon'):
                guild_entry['icon'] = guild.get('icon')
            result.append(guild_entry)

        return jsonify({'guilds': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/emojis', methods=['POST'])
def list_emojis():
    data = request.json or {}
    bot_token = data.get('bot_token')
    guild_id = data.get('guild_id')

    if not bot_token or not guild_id:
        return jsonify({'error': 'bot_token and guild_id required to list emojis'}), 400

    url = f'https://discord.com/api/v10/guilds/{guild_id}/emojis'
    headers = {'Authorization': f'Bot {bot_token}'}
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            return jsonify({'emojis': r.json()}), 200
        return jsonify({'error': 'failed to fetch emojis', 'response': r.text}), r.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/edit', methods=['POST'])
def edit_message():
    data = request.json or {}
    message_id = data.get('message_id')
    payload = {}
    if 'content' in data:
        payload['content'] = data['content']
    if 'embeds' in data:
        payload['embeds'] = data['embeds']

    webhook = data.get('webhook_url')
    if webhook and message_id:
        try:
            url = f'{webhook}/messages/{message_id}'
            r = requests.patch(url, json=payload, timeout=10)
            return jsonify({'status': r.status_code, 'response': r.text, 'json': r.json() if r.headers.get('content-type','').startswith('application/json') else None}), r.status_code
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    bot_token = data.get('bot_token')
    channel_id = data.get('channel_id')
    if bot_token and channel_id and message_id:
        url = f'https://discord.com/api/v10/channels/{channel_id}/messages/{message_id}'
        headers = {'Authorization': f'Bot {bot_token}', 'Content-Type': 'application/json'}
        try:
            r = requests.patch(url, json=payload, headers=headers, timeout=10)
            return jsonify({'status': r.status_code, 'response': r.text, 'json': r.json() if r.headers.get('content-type','').startswith('application/json') else None}), r.status_code
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'provide webhook_url+message_id or bot_token+channel_id+message_id'}), 400


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=True)
