function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  children.forEach(c => e.append(typeof c === 'string' ? document.createTextNode(c) : c));
  return e;
}

const embedsEl = document.getElementById('embeds');
const addEmbedBtn = document.getElementById('add-embed');
const preview = document.getElementById('json_preview');
const fetchBtn = document.getElementById('fetch-messages');
const refreshChannelsBtn = document.getElementById('refresh-channels');
const channelSelect = document.getElementById('channel_select');
const messagesEl = document.getElementById('messages');
let editingMessageId = null;
const emojiPickerEl = document.getElementById('emoji-picker');
const serverEmojiPickerEl = document.getElementById('server-emoji-picker');
const customEmojiInput = document.getElementById('custom-emoji');
const insertCustomEmojiBtn = document.getElementById('insert-custom-emoji');
const botTokenFullEl = document.getElementById('bot_token_full');
const startupModal = document.getElementById('startup-modal');
const startupBotInput = document.getElementById('startup_bot_token');
const startupWebhookInput = document.getElementById('startup_webhook_url');
const startupContinueBtn = document.getElementById('startup_continue');
const toggleDarkModeBtn = document.getElementById('toggle-dark-mode');
const changeCredentialsBtn = document.getElementById('change-credentials');
const sendButton = document.getElementById('send');
const serversContainer = document.getElementById('servers_container');

const emojiList = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😋','🤩','🤖','🎉','🔥','✨','❤️','👍','🙌','😢','😎'];
let currentInput = null;
let fetchedGuilds = [];
// Simple emoji name map for shortcut suggestions
const emojiMap = {
  smile: '😀',
  grin: '😁',
  joy: '😂',
  laugh: '🤣',
  wink: '😉',
  heart: '❤️',
  thumbs: '👍',
  party: '🎉',
  fire: '🔥',
  robot: '🤖',
  star: '✨'
};
let emojiSuggestionBox = null;

function initEmojiPicker(){
  emojiList.forEach(e=>{
    const b = document.createElement('button'); b.type='button'; b.className='emoji-btn'; b.textContent = e;
    b.addEventListener('click', ()=> insertAtCursor(e));
    emojiPickerEl.appendChild(b);
  });
  insertCustomEmojiBtn.addEventListener('click', ()=> {
    const v = customEmojiInput.value.trim(); if (!v) return;
    insertAtCursor(v);
  });
}

function insertAtCursor(text){
  const el = currentInput || document.getElementById('content');
  if (!el) return;
  const start = el.selectionStart || 0;
  const end = el.selectionEnd || 0;
  const val = el.value || '';
  el.value = val.slice(0,start) + text + val.slice(end);
  const pos = start + text.length;
  el.selectionStart = el.selectionEnd = pos;
  el.focus();
  updatePreview();
}

// Render servers list and allow selecting a guild to filter channels
function clearServersUI(){
  if (!serversContainer) return;
  serversContainer.innerHTML = '';
}

function renderServers(guilds){
  if (!serversContainer) return;
  clearServersUI();
  const list = document.createElement('div');
  list.className = 'servers-list';
  const selectedGuild = localStorage.getItem('selected_guild');
  guilds.forEach(g => {
    const card = document.createElement('div');
    card.className = 'server-card';
    card.dataset.guildId = g.id;
    const img = document.createElement('img');
    if (g.icon) {
      img.src = `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`;
    } else {
      img.src = 'https://via.placeholder.com/34?text=' + encodeURIComponent((g.name||'')[0]||'S');
    }
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = g.name || g.id;
    card.appendChild(img);
    card.appendChild(name);
    if (selectedGuild && selectedGuild === g.id) card.classList.add('selected');
    card.addEventListener('click', () => {
      // mark selected
      document.querySelectorAll('.server-card.selected').forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');
      localStorage.setItem('selected_guild', g.id);
      renderChannelsForGuild(g.id);
    });
    list.appendChild(card);
  });
  serversContainer.appendChild(list);
}

function renderChannelsForGuild(guildId){
  channelSelect.innerHTML = '<option value="">Choose a channel</option>';
  const guild = fetchedGuilds.find(g=>g.id===guildId);
  if (!guild) return;
  if (guild.channels_by_category && Object.keys(guild.channels_by_category).length) {
    Object.entries(guild.channels_by_category).forEach(([catId, catData]) => {
      const catLabel = catData.name ? `${guild.name} — ${catData.name}` : `${guild.name} — Uncategorized`;
      const catGroup = document.createElement('optgroup');
      catGroup.label = catLabel;
      catData.channels.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.id;
        option.textContent = `#${channel.name}`;
        option.dataset.guildId = channel.guild_id;
        catGroup.appendChild(option);
      });
      channelSelect.appendChild(catGroup);
    });
  }
}

// Fetch servers (guilds) and store locally
async function fetchServers(){
  const bot_token = getBotToken();
  if (!bot_token) return;
  try {
    const res = await fetch('/channels', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ bot_token }) });
    const data = await res.json();
    if (res.status !== 200) return console.error('Failed to fetch servers', data);
    if (Array.isArray(data.guilds)){
      fetchedGuilds = data.guilds;
      renderServers(fetchedGuilds);
    }
  } catch (e) {
    console.error('Error fetching servers', e);
  }
}

function attachFocusListeners(root){
  root.querySelectorAll('input, textarea').forEach(i=>{
    i.addEventListener('focus', ()=> currentInput = i);
  });
}


function makeEmbedEditor() {
  const container = el('div', { class: 'embed-editor' });
  const title = el('input', { placeholder: 'Embed title', class: 'embed-title' });
  const desc = el('textarea', { placeholder: 'Embed description', class: 'embed-desc' });
  const color = el('input', { placeholder: 'Color (decimal)', class: 'embed-color' });
  const fields = el('div', { class: 'embed-fields' });
  const addField = el('button', { type: 'button' }, 'Add Field');
  const remove = el('button', { type: 'button', class: 'remove' }, 'Remove Embed');

  addField.addEventListener('click', () => {
    const fName = el('input', { placeholder: 'Field name', class: 'field-name' });
    const fVal = el('input', { placeholder: 'Field value', class: 'field-value' });
    const fInline = el('input', { type: 'checkbox', class: 'field-inline' });
    const wrapper = el('div', { class: 'field' }, fName, fVal, el('label', {}, 'Inline', fInline));
    fields.appendChild(wrapper);
    updatePreview();
  });

  remove.addEventListener('click', () => { container.remove(); updatePreview(); });

  [title, desc, color].forEach(i => i.addEventListener('input', updatePreview));

  // attach focus listeners so emoji picker can insert into these
  [title, desc, color, addField].forEach(i=> i.addEventListener('focus', ()=> currentInput = i));

  container.appendChild(title);
  container.appendChild(desc);
  container.appendChild(color);
  container.appendChild(addField);
  container.appendChild(fields);
  container.appendChild(remove);
  attachFocusListeners(container);
  return container;
}

addEmbedBtn.addEventListener('click', () => { embedsEl.appendChild(makeEmbedEditor()); updatePreview(); });

function buildPayload() {
  const content = document.getElementById('content').value;
  const embedNodes = Array.from(document.querySelectorAll('.embed-editor'));
  const embeds = embedNodes.map(node => {
    const title = node.querySelector('.embed-title').value;
    const description = node.querySelector('.embed-desc').value;
    const color = parseInt(node.querySelector('.embed-color').value) || undefined;
    const fields = Array.from(node.querySelectorAll('.field')).map(f => ({
      name: f.querySelector('.field-name').value,
      value: f.querySelector('.field-value').value,
      inline: f.querySelector('.field-inline').checked
    }));
    const e = { title, description };
    if (!Number.isNaN(color)) e.color = color;
    if (fields.length) e.fields = fields;
    return e;
  });

  const payload = {};
  if (content) payload.content = content;
  if (embeds.length) payload.embeds = embeds;
  return payload;
}

function getBotToken() {
  let token = (startupBotInput && startupBotInput.value.trim()) || localStorage.getItem('botToken') || '';
  if (!token && botTokenFullEl) {
    token = botTokenFullEl.value.trim();
  }
  return token;
}

function getWebhookUrl() {
  return localStorage.getItem('webhookUrl') || '';
}

function setEditingState(editing) {
  editingMessageId = editing ? editingMessageId : null;
  sendButton.textContent = editing ? 'Edit' : 'Send';
}

function setEditButtonForLoadedMessage(messageId) {
  editingMessageId = messageId;
  sendButton.textContent = 'Edit';
}

function setSendButtonDefault() {
  editingMessageId = null;
  sendButton.textContent = 'Send';
}

function loadPreferredTheme() {
  const theme = localStorage.getItem('bot_ui_theme');
  if (theme === 'dark') {
    document.body.classList.add('dark');
    if (toggleDarkModeBtn) toggleDarkModeBtn.textContent = '☀️';
  } else {
    document.body.classList.remove('dark');
    if (toggleDarkModeBtn) toggleDarkModeBtn.textContent = '🌙';
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('bot_ui_theme', isDark ? 'dark' : 'light');
  if (toggleDarkModeBtn) toggleDarkModeBtn.textContent = isDark ? '☀️' : '🌙';
}

async function fetchChannels() {
  const bot_token = getBotToken();
  if (!bot_token) {
    alert('Provide a bot token to fetch channels');
    return;
  }

  refreshChannelsBtn.disabled = true;
  channelSelect.disabled = true;
  channelSelect.innerHTML = '<option>Loading channels...</option>';

  try {
    const res = await fetch('/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_token })
    });
    const data = await res.json();
    console.log('fetchChannels response:', res.status, data);

    if (res.status !== 200) {
      alert(`Error: ${data.error || 'Failed to fetch channels'}`);
      refreshChannelsBtn.disabled = false;
      channelSelect.disabled = false;
      return;
    }

    channelSelect.innerHTML = '<option value="">Choose a channel</option>';
    if (Array.isArray(data.guilds)) {
      data.guilds.forEach(guild => {
        // If channels are grouped by category, create one optgroup per category
        if (guild.channels_by_category && Object.keys(guild.channels_by_category).length) {
          Object.entries(guild.channels_by_category).forEach(([catId, catData]) => {
            const catLabel = catData.name ? `${guild.name} — ${catData.name}` : `${guild.name} — Uncategorized`;
            const catGroup = document.createElement('optgroup');
            catGroup.label = catLabel;
            catData.channels.forEach(channel => {
              const option = document.createElement('option');
              option.value = channel.id;
              option.textContent = `#${channel.name}`;
              option.dataset.guildId = channel.guild_id;
              catGroup.appendChild(option);
            });
            channelSelect.appendChild(catGroup);
          });
        } else if (Array.isArray(guild.channels) && guild.channels.length) {
          // Fallback: group all channels under the guild name
          const group = document.createElement('optgroup');
          group.label = guild.name || guild.id;
          guild.channels.forEach(channel => {
            const option = document.createElement('option');
            option.value = channel.id;
            option.textContent = `${channel.name} (${channel.id})`;
            option.dataset.guildId = channel.guild_id;
            group.appendChild(option);
          });
          channelSelect.appendChild(group);
        }
      });
    } else {
      alert('Error fetching channels: ' + (data.error || 'unexpected response'));
    }
  } catch (e) {
    alert('Error fetching channels: ' + e.message);
  } finally {
    refreshChannelsBtn.disabled = false;
    channelSelect.disabled = false;
  }
}

async function fetchMessagesForChannel(channelId) {
  const bot_token = getBotToken();
  if (!bot_token) {
    return alert('Provide a bot token to fetch messages');
  }
  if (!channelId) {
    return alert('Select or enter a channel ID to fetch messages');
  }

  const selectedOption = channelSelect.querySelector(`option[value="${channelId}"]`);
  if (selectedOption && selectedOption.dataset.guildId) {
    await fetchGuildEmojis(selectedOption.dataset.guildId);
  } else {
    serverEmojiPickerEl.innerHTML = '';
  }

  try {
    const res = await fetch('/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_token, channel_id: channelId, limit: 50 })
    });
    const data = await res.json();
    if (!Array.isArray(data)) return alert('Error fetching messages: ' + JSON.stringify(data));

    messagesEl.innerHTML = '';
    data.forEach(m => {
      const d = document.createElement('div');
      d.className = 'message-item';
      const meta = document.createElement('div');
      meta.innerText = `ID: ${m.id} — ${m.author ? m.author.username : 'unknown'}`;
      const content = document.createElement('pre');
      content.textContent = m.content || '';
      const load = document.createElement('button');
      load.type = 'button';
      load.innerText = 'Load to editor';
      load.addEventListener('click', () => {
        document.getElementById('content').value = m.content || '';
        embedsEl.innerHTML = '';
        if (m.embeds && m.embeds.length) {
          m.embeds.forEach(emb => {
            const editor = makeEmbedEditor();
            editor.querySelector('.embed-title').value = emb.title || '';
            editor.querySelector('.embed-desc').value = emb.description || '';
            if (emb.color) editor.querySelector('.embed-color').value = emb.color;
            const fieldsContainer = editor.querySelector('.embed-fields');
            if (emb.fields && emb.fields.length) {
              emb.fields.forEach(f => {
                const fName = document.createElement('input'); fName.placeholder = 'Field name'; fName.className = 'field-name'; fName.value = f.name || '';
                const fVal = document.createElement('input'); fVal.placeholder = 'Field value'; fVal.className = 'field-value'; fVal.value = f.value || '';
                const fInline = document.createElement('input'); fInline.type = 'checkbox'; fInline.className = 'field-inline'; fInline.checked = !!f.inline;
                const wrapper = document.createElement('div'); wrapper.className = 'field'; wrapper.appendChild(fName); wrapper.appendChild(fVal); const lbl = document.createElement('label'); lbl.appendChild(document.createTextNode('Inline')); lbl.appendChild(fInline); wrapper.appendChild(lbl);
                fieldsContainer.appendChild(wrapper);
              });
            }
            embedsEl.appendChild(editor);
          });
        }
        editingMessageId = m.id;
        setEditButtonForLoadedMessage(m.id);
        updatePreview();
      });
      d.appendChild(meta);
      d.appendChild(content);
      d.appendChild(load);
      messagesEl.appendChild(d);
    });
  } catch (e) {
    alert('Error fetching messages: ' + e.message);
  }
}

function renderServerEmojis(emojis) {
  serverEmojiPickerEl.innerHTML = '';
  if (!Array.isArray(emojis) || emojis.length === 0) {
    serverEmojiPickerEl.textContent = 'No server emojis found for this guild.';
    return;
  }

  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-btn server-emoji-btn';
    const emojiText = emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
    const ext = emoji.animated ? 'gif' : 'png';
    const img = document.createElement('img');
    img.src = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}`;
    img.alt = emoji.name;
    img.title = emoji.name;
    img.className = 'server-emoji-icon';
    btn.appendChild(img);
    btn.addEventListener('click', () => insertAtCursor(emojiText));
    serverEmojiPickerEl.appendChild(btn);
  });
}

async function fetchGuildEmojis(guildId) {
  const bot_token = getBotToken();
  if (!bot_token || !guildId) {
    serverEmojiPickerEl.innerHTML = '';
    return;
  }

  serverEmojiPickerEl.innerHTML = 'Loading server emojis...';
  try {
    const res = await fetch('/emojis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_token, guild_id: guildId })
    });
    const data = await res.json();
    if (Array.isArray(data.emojis)) {
      renderServerEmojis(data.emojis);
    } else {
      serverEmojiPickerEl.innerHTML = 'Failed to load server emojis.';
    }
  } catch (e) {
    serverEmojiPickerEl.innerHTML = 'Error loading server emojis.';
  }
}

function updatePreview() {
  preview.textContent = JSON.stringify(buildPayload(), null, 2);
}

document.getElementById('content').addEventListener('input', updatePreview);

// Emoji suggestion dropdown for :name: style shortcuts
function createEmojiSuggestionBox(){
  if (emojiSuggestionBox) return;
  emojiSuggestionBox = document.createElement('div');
  emojiSuggestionBox.className = 'emoji-suggestions';
  emojiSuggestionBox.style.display = 'none';
  document.getElementById('content').parentNode.insertBefore(emojiSuggestionBox, document.getElementById('content').nextSibling);
}

function showEmojiSuggestions(matches, insertCallback){
  createEmojiSuggestionBox();
  emojiSuggestionBox.innerHTML = '';
  matches.forEach(name => {
    const item = document.createElement('div');
    item.className = 'emoji-suggestion-item';
    item.textContent = `${emojiMap[name]}   :${name}:`;
    item.addEventListener('click', ()=> { insertCallback(emojiMap[name]); hideEmojiSuggestions(); });
    emojiSuggestionBox.appendChild(item);
  });
  emojiSuggestionBox.style.display = matches.length ? 'block' : 'none';
}

function hideEmojiSuggestions(){ if (emojiSuggestionBox) emojiSuggestionBox.style.display = 'none'; }

// Detect :token while typing in content and show suggestions
document.getElementById('content').addEventListener('keyup', (e)=>{
  const el = e.target;
  const pos = el.selectionStart || 0;
  const val = el.value || '';
  const left = val.slice(0, pos);
  const m = left.match(/:([a-zA-Z0-9_+-]{1,20})$/);
  if (m) {
    const token = m[1].toLowerCase();
    const matches = Object.keys(emojiMap).filter(n => n.startsWith(token)).slice(0,6);
    if (matches.length) {
      showEmojiSuggestions(matches, (emoji)=>{
        // replace last :token with emoji
        const start = pos - m[0].length;
        el.value = val.slice(0,start) + emoji + val.slice(pos);
        el.selectionStart = el.selectionEnd = start + emoji.length;
        el.focus();
        updatePreview();
      });
      return;
    }
  }
  hideEmojiSuggestions();
});

document.addEventListener('click', (ev)=>{ if (!emojiSuggestionBox) return; if (!emojiSuggestionBox.contains(ev.target)) hideEmojiSuggestions(); });

document.getElementById('send').addEventListener('click', async () => {
  const webhook_url = getWebhookUrl();
  const bot_token = getBotToken();
  const channel_id = channelSelect.value.trim();
  const payload = buildPayload();
  const body = { ...payload };
  if (webhook_url) body.webhook_url = webhook_url;
  if (bot_token) body.bot_token = bot_token;
  if (channel_id) body.channel_id = channel_id;
  try {
    let res, j;
    if (editingMessageId) {
      body.message_id = editingMessageId;
      res = await fetch('/edit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      j = await res.json();
      alert('Edited: ' + JSON.stringify(j));
      setSendButtonDefault();
    } else {
      res = await fetch('/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      j = await res.json();
      alert('Sent: ' + JSON.stringify(j));
    }
    updatePreview();
  } catch (e) {
    alert('Error: ' + e.message);
  }
});

updatePreview();

// Logs modal wiring and console capture
const toggleLogsBtn = document.getElementById('toggle-logs');
const logsModal = document.getElementById('logs-modal');
const closeLogsBtn = document.getElementById('close-logs');
const clearLogsBtn = document.getElementById('clear-logs');
const logsOutput = document.getElementById('logs-output');

function formatArg(a) {
  try {
    if (typeof a === 'string') return a;
    return JSON.stringify(a, null, 2);
  } catch (e) {
    return String(a);
  }
}

function addLog(level, ...args) {
  if (!logsOutput) return;
  const d = document.createElement('div');
  d.className = 'log-entry ' + (level || 'info');
  const time = new Date().toLocaleTimeString();
  d.textContent = `[${time}] ${args.map(formatArg).join(' ')} `;
  logsOutput.appendChild(d);
  logsOutput.scrollTop = logsOutput.scrollHeight;
}

if (toggleLogsBtn && logsModal) {
  toggleLogsBtn.addEventListener('click', () => {
    logsModal.style.display = 'flex';
  });
}

if (closeLogsBtn && logsModal) {
  closeLogsBtn.addEventListener('click', () => {
    logsModal.style.display = 'none';
  });
}

if (clearLogsBtn && logsOutput) {
  clearLogsBtn.addEventListener('click', () => {
    logsOutput.innerHTML = '';
  });
}

// Capture console output and mirror into logs modal
(function captureConsole(){
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);

  console.log = function(...args){ origLog(...args); addLog('info', ...args); };
  console.warn = function(...args){ origWarn(...args); addLog('warn', ...args); };
  console.error = function(...args){ origError(...args); addLog('error', ...args); };

  window.addEventListener('error', (ev) => {
    addLog('error', ev.message || 'Uncaught error', ev.filename || '', ev.lineno || '', ev.colno || '');
  });
  window.addEventListener('unhandledrejection', (ev) => {
    addLog('error', 'UnhandledRejection', ev.reason || ev);
  });
})();

initEmojiPicker();

// attach focus listeners for top-level content input
attachFocusListeners(document);

loadPreferredTheme();
if (toggleDarkModeBtn) {
  toggleDarkModeBtn.addEventListener('click', toggleDarkMode);
}

fetchBtn.addEventListener('click', async () => {
  const bot_token = getBotToken();
  const channel_id = channelSelect.value.trim();
  if (!bot_token || !channel_id) return alert('Provide bot token and select a channel to fetch messages');
  await fetchMessagesForChannel(channel_id);
});

refreshChannelsBtn.addEventListener('click', fetchChannels);
channelSelect.addEventListener('change', () => {
  const selected = channelSelect.value;
  if (selected) {
    fetchMessagesForChannel(selected);
  }
});

if (startupContinueBtn) {
  startupContinueBtn.addEventListener('click', () => {
    const botToken = startupBotInput ? startupBotInput.value.trim() : '';
    const webhookUrl = startupWebhookInput ? startupWebhookInput.value.trim() : '';
    if (!botToken && !webhookUrl) {
      return alert('Please enter a bot token or a webhook URL to continue.');
    }
    if (botToken) {
      localStorage.setItem('botToken', botToken);
    }
    if (webhookUrl) {
      localStorage.setItem('webhookUrl', webhookUrl);
    }
    if (startupModal) {
      startupModal.style.display = 'none';
    }
    const t = getBotToken();
    if (t) setTimeout(fetchServers, 200);
  });
}

function showStartupModal() {
  const savedBot = localStorage.getItem('botToken');
  const savedWebhook = localStorage.getItem('webhookUrl');
  if (startupBotInput) startupBotInput.value = savedBot || (botTokenFullEl && botTokenFullEl.value.trim()) || '';
  if (startupWebhookInput) startupWebhookInput.value = savedWebhook || '';
  if (startupModal) startupModal.style.display = 'flex';
}

if (changeCredentialsBtn) {
  changeCredentialsBtn.addEventListener('click', showStartupModal);
}

// Auto-open startup modal on page load
window.addEventListener('load', () => {
  showStartupModal();
});