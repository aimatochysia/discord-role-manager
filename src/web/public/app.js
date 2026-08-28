const state = {
  session: null,
  guilds: [],
  guildId: null,
  payload: null,
  view: 'access',
  selected: null
};

const $ = (id) => document.getElementById(id);

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  setTimeout(() => {
    el.hidden = true;
  }, 2800);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function profileMeta(key) {
  return (state.payload?.profiles || []).find((item) => item.key === key) || { key, label: key, color: '#80848e', description: '' };
}

function findNode(type, id) {
  const structure = state.payload.structure;
  if (type === 'category') {
    return structure.categories.find((item) => item.id === id) || null;
  }
  for (const category of structure.categories) {
    const channel = category.channels.find((item) => item.id === id);
    if (channel) return { ...channel, parent: category };
  }
  return (structure.uncategorized || []).find((item) => item.id === id) || null;
}

function renderTree() {
  const tree = $('tree');
  tree.innerHTML = '';
  for (const category of state.payload.structure.categories) {
    const catBtn = document.createElement('button');
    catBtn.className = 'tree-cat';
    if (state.selected?.id === category.id) catBtn.classList.add('active');
    catBtn.innerHTML = `<span>▾ ${escapeHtml(category.name)}</span>${badge(category.access?.profileKey)}`;
    catBtn.onclick = () => select('category', category.id);
    tree.appendChild(catBtn);
    for (const channel of category.channels) {
      const chBtn = document.createElement('button');
      chBtn.className = 'tree-ch';
      if (state.selected?.id === channel.id) chBtn.classList.add('active');
      const prefix = channel.type === 2 || channel.type === 13 ? '🔊' : channel.type === 5 ? '📣' : '#';
      const key = channel.access?.inherit ? `${channel.access.profileKey}` : channel.access?.profileKey;
      chBtn.innerHTML = `<span>${prefix} ${escapeHtml(channel.name)}</span>${badge(key, channel.access?.inherit)}`;
      chBtn.onclick = () => select('channel', channel.id);
      tree.appendChild(chBtn);
    }
  }
}

function badge(profileKey, inherit) {
  const meta = profileMeta(profileKey);
  const label = inherit ? 'inherit' : meta.label;
  return `<span class="badge" style="background:${meta.color}">${escapeHtml(label)}</span>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function select(type, id) {
  state.selected = { type, id };
  renderTree();
  renderInspector();
}

function renderInspector() {
  const empty = $('emptyState');
  const inspector = $('inspector');
  if (state.view !== 'access') return;
  if (!state.selected) {
    empty.hidden = false;
    inspector.hidden = true;
    $('mainTitle').textContent = 'Select a category or channel';
    return;
  }
  empty.hidden = true;
  inspector.hidden = false;
  const node = findNode(state.selected.type, state.selected.id);
  $('mainTitle').textContent = node.name;
  $('crumb').textContent = state.selected.type === 'category' ? 'Category access' : 'Channel access';

  const selectEl = $('profileSelect');
  selectEl.innerHTML = state.payload.profiles
    .map((profile) => `<option value="${profile.key}">${escapeHtml(profile.label)}</option>`)
    .join('');
  const current = node.access?.inherit && state.selected.type === 'channel' ? 'inherit' : node.access?.profileKey || 'hidden';
  selectEl.value = current;
  $('profileHelp').textContent = profileMeta(selectEl.value).description || '';

  const inheritWrap = $('inheritWrap');
  inheritWrap.hidden = state.selected.type !== 'channel';
  $('inheritCheck').checked = Boolean(node.access?.inherit);

  renderMatrix(node.access?.ranks || {}, current === 'custom');
}

function renderMatrix(ranks, editable) {
  const table = $('matrix');
  const rows = state.payload.ranks
    .map((rank) => {
      const access = ranks[rank.key] || { view: false, send: false };
      const disabled = editable ? '' : 'disabled';
      return `<tr>
        <td><span class="swatch" style="background:${rank.color}"></span>${escapeHtml(rank.label)}</td>
        <td><input type="checkbox" data-rank="${rank.key}" data-perm="view" ${access.view ? 'checked' : ''} ${disabled}></td>
        <td><input type="checkbox" data-rank="${rank.key}" data-perm="send" ${access.send ? 'checked' : ''} ${disabled}></td>
      </tr>`;
    })
    .join('');
  table.innerHTML = `<thead><tr><th>Rank</th><th>View</th><th>Chat</th></tr></thead><tbody>${rows}</tbody>`;
  table.querySelectorAll('input').forEach((input) => {
    input.addEventListener('change', () => {
      if (input.dataset.perm === 'send' && input.checked) {
        const view = table.querySelector(`input[data-rank="${input.dataset.rank}"][data-perm="view"]`);
        if (view) view.checked = true;
      }
    });
  });
}

function readMatrix() {
  const ranks = {};
  document.querySelectorAll('#matrix input').forEach((input) => {
    if (!ranks[input.dataset.rank]) ranks[input.dataset.rank] = { view: false, send: false };
    ranks[input.dataset.rank][input.dataset.perm] = input.checked;
  });
  return ranks;
}

function renderRanks() {
  const wrap = $('rankList');
  const roles = state.payload.roles || [];
  wrap.innerHTML = state.payload.ranks
    .map((rank) => {
      const bound = state.payload.bindings[rank.key] || '';
      const options = roles
        .map((role) => `<option value="${role.id}" ${role.id === bound ? 'selected' : ''}>${escapeHtml(role.name)}</option>`)
        .join('');
      return `<div class="rank-row">
        <div><span class="swatch" style="background:${rank.color}"></span><strong>${escapeHtml(rank.label)}</strong><div class="hint" style="padding:0">${escapeHtml(rank.description)}</div></div>
        <select data-bind="${rank.key}">${options}</select>
      </div>`;
    })
    .join('');
  wrap.querySelectorAll('select').forEach((select) => {
    select.addEventListener('change', async () => {
      await api(`/api/guilds/${state.guildId}/ranks`, {
        method: 'PUT',
        body: { rankKey: select.dataset.bind, roleId: select.value }
      });
      toast('Rank binding saved');
      await reload();
    });
  });
}

function renderSettings() {
  const settings = state.payload.settings || {};
  $('verifyChannel').value = settings.verify_channel_id || '';
  $('boosterCategory').value = settings.booster_category_id || '';
  $('lockdown').checked = settings.lockdown_unverified !== false;
  $('autoBooster').checked = settings.auto_booster !== false;
}

function renderQueue() {
  const rows = state.payload.requests || [];
  $('queueList').innerHTML = rows.length
    ? rows
        .map((row) => {
          const payload = row.payload || {};
          return `<article class="queue-item">
            <h4>#${row.id} · ${escapeHtml(row.action_type)}</h4>
            <div class="hint" style="padding:0">Trainee ${escapeHtml(row.requester_tag || row.requester_id)} → ${escapeHtml(payload.targetTag || payload.targetUserId || '')}</div>
            <div>${escapeHtml(payload.reason || '')}</div>
            <div class="queue-actions">
              <button class="primary" data-approve="${row.id}">Approve</button>
              <button class="danger" data-deny="${row.id}">Deny</button>
            </div>
          </article>`;
        })
        .join('')
    : '<p class="hint" style="padding:0">No pending requests.</p>';
  $('queueList').querySelectorAll('[data-approve],[data-deny]').forEach((button) => {
    button.onclick = async () => {
      const id = button.dataset.approve || button.dataset.deny;
      const decision = button.dataset.approve ? 'approved' : 'denied';
      await api(`/api/guilds/${state.guildId}/requests/${id}/review`, { method: 'POST', body: { status: decision } });
      toast(`Request ${decision}`);
      await reload();
    };
  });
}

function renderAudit() {
  const rows = state.payload.audit || [];
  $('auditList').innerHTML = rows.length
    ? rows
        .map((row) => `<div class="audit-item"><strong>${escapeHtml(row.action)}</strong> · ${escapeHtml(row.actor || row.actor_id || 'system')}<div class="hint" style="padding:0">${escapeHtml(JSON.stringify(row.details || {}))}</div></div>`)
        .join('')
    : '<p class="hint" style="padding:0">No audit events yet.</p>';
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  ['access', 'ranks', 'settings', 'queue', 'audit'].forEach((name) => {
    $(`view-${name}`).hidden = name !== view;
  });
  $('crumb').textContent = ({ access: 'Access', ranks: 'Ranks', settings: 'Settings', queue: 'Trainee queue', audit: 'Audit' })[view];
  if (view === 'ranks') {
    $('mainTitle').textContent = 'Bind Discord roles';
    renderRanks();
  }
  if (view === 'settings') {
    $('mainTitle').textContent = 'Server gates';
    renderSettings();
  }
  if (view === 'queue') {
    $('mainTitle').textContent = 'Needs moderator approval';
    renderQueue();
  }
  if (view === 'audit') {
    $('mainTitle').textContent = 'What changed';
    renderAudit();
  }
  if (view === 'access') renderInspector();
}

async function saveAccess() {
  if (!state.selected) return;
  const inherit = state.selected.type === 'channel' && $('inheritCheck').checked;
  let profileKey = $('profileSelect').value;
  if (inherit) profileKey = 'inherit';
  const body = {
    targetType: state.selected.type,
    targetId: state.selected.id,
    profileKey,
    inherit
  };
  if (profileKey === 'custom') body.ranks = readMatrix();
  await api(`/api/guilds/${state.guildId}/access`, { method: 'PUT', body });
  $('saveStatus').textContent = 'Saved';
  toast('Access profile saved — apply to push into Discord');
  await reload();
}

async function reload() {
  state.payload = await api(`/api/guilds/${state.guildId}/state`);
  $('guildName').textContent = state.payload.guild.name;
  renderTree();
  if (state.view === 'access') renderInspector();
  if (state.view === 'ranks') renderRanks();
  if (state.view === 'settings') renderSettings();
  if (state.view === 'queue') renderQueue();
  if (state.view === 'audit') renderAudit();
}

async function boot() {
  const session = await api('/api/session');
  state.session = session;
  state.guilds = session.guilds || [];
  state.guildId = session.guildId || state.guilds[0]?.id;
  if (!state.guildId) throw new Error('No guild');
  const switcher = $('guildSwitch');
  if (state.guilds.length > 1) {
    switcher.hidden = false;
    switcher.innerHTML = state.guilds.map((guild) => `<option value="${guild.id}">${escapeHtml(guild.name)}</option>`).join('');
    switcher.value = state.guildId;
    switcher.onchange = async () => {
      state.guildId = switcher.value;
      state.selected = null;
      await reload();
    };
  }
  await reload();
}

$('profileSelect').addEventListener('change', () => {
  $('inheritCheck').checked = $('profileSelect').value === 'inherit';
  $('profileHelp').textContent = profileMeta($('profileSelect').value).description || '';
  renderMatrix(findNode(state.selected.type, state.selected.id).access?.ranks || {}, $('profileSelect').value === 'custom');
});
$('inheritCheck').addEventListener('change', () => {
  if ($('inheritCheck').checked) $('profileSelect').value = 'inherit';
});
$('saveBtn').addEventListener('click', () => saveAccess().catch((error) => toast(error.message)));
$('applyBtn').addEventListener('click', async () => {
  try {
    const result = await api(`/api/guilds/${state.guildId}/access/apply`, { method: 'POST' });
    toast(result.message || 'Applied');
    await reload();
  } catch (error) {
    toast(error.message);
  }
});
$('mapBtn').addEventListener('click', () => {
  window.open(`/api/guilds/${state.guildId}/map.png`, '_blank');
});
$('saveSettings').addEventListener('click', async () => {
  await api(`/api/guilds/${state.guildId}/settings`, {
    method: 'PUT',
    body: {
      verify_channel_id: $('verifyChannel').value || null,
      booster_category_id: $('boosterCategory').value || null,
      lockdown_unverified: $('lockdown').checked,
      auto_booster: $('autoBooster').checked
    }
  });
  toast('Settings saved');
  await reload();
});
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

boot().catch((error) => {
  toast(error.message);
});
