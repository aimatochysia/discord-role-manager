'use strict';

const fs = require('fs');
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { PROFILES } = require('../config/profiles');
const { channelKind } = require('../utils/channels');

const FONT_CANDIDATES = [
  '/usr/share/fonts/truetype/macos/Inter-Regular.ttf',
  '/usr/share/fonts/truetype/macos/Inter-Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
];

let fontsReady = false;
let fontFamily = 'sans-serif';

function ensureFonts() {
  if (fontsReady) return fontFamily;
  for (const file of FONT_CANDIDATES) {
    if (!fs.existsSync(file)) continue;
    const name = path.basename(file, '.ttf');
    try {
      GlobalFonts.registerFromPath(file, name);
      if (file.includes('Inter-Regular')) fontFamily = name;
      else if (fontFamily === 'sans-serif') fontFamily = name;
    } catch {
      // keep looking
    }
  }
  const bold = '/usr/share/fonts/truetype/macos/Inter-Bold.ttf';
  if (fs.existsSync(bold)) {
    try {
      GlobalFonts.registerFromPath(bold, 'Inter-Bold');
    } catch {
      // ignore
    }
  }
  fontsReady = true;
  return fontFamily;
}

const WIDTH = 980;
const PAD = 28;
const ROW = 30;
const HEADER = 92;
const LEGEND = 54;
const MAX_HEIGHT = 1800;

const COLORS = {
  bg: '#1e1f22',
  panel: '#2b2d31',
  text: '#f2f3f5',
  muted: '#b5bac1',
  faint: '#80848e',
  line: '#3f4147',
  accent: '#5865f2'
};

function typePrefix(type) {
  const kind = channelKind(type);
  if (kind === 'voice' || kind === 'stage') return '🔊';
  if (kind === 'forum') return '🗂️';
  if (kind === 'announcement') return '📣';
  return '#';
}

function profileColor(profileKey) {
  return PROFILES[profileKey]?.color || '#80848e';
}

function profileLabel(profileKey, inherit) {
  if (inherit && profileKey) return `${PROFILES[profileKey]?.label || profileKey} · inherit`;
  return PROFILES[profileKey]?.label || profileKey || 'unset';
}

function collectRows(structure) {
  const rows = [];
  for (const category of structure.categories || []) {
    rows.push({
      kind: 'category',
      name: category.name,
      profileKey: category.access?.profileKey || 'hidden',
      inherit: false
    });
    for (const channel of category.channels || []) {
      rows.push({
        kind: 'channel',
        name: channel.name,
        type: channel.type,
        profileKey: channel.access?.profileKey || category.access?.profileKey,
        inherit: Boolean(channel.access?.inherit)
      });
    }
  }
  if (structure.uncategorized?.length) {
    rows.push({ kind: 'category', name: 'UNCATEGORIZED', profileKey: 'hidden', inherit: false });
    for (const channel of structure.uncategorized) {
      rows.push({
        kind: 'channel',
        name: channel.name,
        type: channel.type,
        profileKey: channel.access?.profileKey || 'hidden',
        inherit: false
      });
    }
  }
  return rows;
}

function paginate(rows) {
  const available = MAX_HEIGHT - HEADER - LEGEND - PAD;
  const perPage = Math.max(8, Math.floor(available / ROW));
  const pages = [];
  for (let i = 0; i < rows.length; i += perPage) {
    pages.push(rows.slice(i, i + perPage));
  }
  return pages.length ? pages : [[]];
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function usedProfiles(rows) {
  const keys = [];
  const seen = new Set();
  for (const row of rows) {
    const key = row.profileKey || 'hidden';
    if (seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function drawPage({ structure, rows, pageIndex, pageCount, allRows }) {
  const family = ensureFonts();
  const height = HEADER + LEGEND + rows.length * ROW + PAD * 2;
  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, WIDTH, height);

  roundRect(ctx, 12, 12, WIDTH - 24, height - 24, 16);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();

  ctx.fillStyle = COLORS.text;
  ctx.font = `600 26px ${family}`;
  ctx.fillText(structure.name || 'Server', PAD + 8, 48);

  ctx.fillStyle = COLORS.muted;
  ctx.font = `14px ${family}`;
  const catCount = structure.categories?.length || 0;
  const chCount = (structure.categories || []).reduce((n, c) => n + (c.channels?.length || 0), 0)
    + (structure.uncategorized?.length || 0);
  ctx.fillText(
    `${catCount} categories · ${chCount} channels · access map${pageCount > 1 ? ` · ${pageIndex + 1}/${pageCount}` : ''}`,
    PAD + 8,
    72
  );

  const legendY = 96;
  const legendKeys = usedProfiles(allRows).filter((key) => key !== 'inherit').slice(0, 10);
  let lx = PAD + 8;
  ctx.font = `12px ${family}`;
  for (const key of legendKeys) {
    const label = PROFILES[key]?.label || key;
    ctx.fillStyle = profileColor(key);
    roundRect(ctx, lx, legendY, 10, 10, 3);
    ctx.fill();
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(label, lx + 16, legendY + 10);
    lx += ctx.measureText(label).width + 32;
  }

  let y = HEADER + LEGEND;
  for (const row of rows) {
    if (row.kind === 'category') {
      ctx.fillStyle = COLORS.line;
      ctx.fillRect(PAD, y - 12, WIDTH - PAD * 2, 1);
      ctx.fillStyle = COLORS.text;
      ctx.font = `600 15px ${family}`;
      ctx.fillText(`▸  ${row.name.toUpperCase()}`, PAD + 8, y + 8);
    } else {
      ctx.fillStyle = COLORS.muted;
      ctx.font = `14px ${family}`;
      const prefix = typePrefix(row.type);
      ctx.fillText(`${prefix}   ${row.name}`, PAD + 36, y + 8);
    }

    const badge = profileLabel(row.profileKey, row.inherit && row.kind === 'channel');
    ctx.font = `12px ${family}`;
    const textW = ctx.measureText(badge).width;
    const bx = WIDTH - PAD - textW - 28;
    ctx.fillStyle = profileColor(row.profileKey);
    roundRect(ctx, bx, y - 8, textW + 16, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillText(badge, bx + 8, y + 6);

    y += ROW;
  }

  ctx.fillStyle = COLORS.faint;
  ctx.font = `11px ${family}`;
  ctx.fillText('Role Manager · profiles, not 200 Discord overwrites', PAD + 8, height - 22);

  return canvas.toBuffer('image/png');
}

function renderAccessMap(structure) {
  ensureFonts();
  const rows = collectRows(structure);
  const pages = paginate(rows);
  return pages.map((pageRows, index) =>
    drawPage({
      structure,
      rows: pageRows,
      pageIndex: index,
      pageCount: pages.length,
      allRows: rows
    })
  );
}

module.exports = { renderAccessMap, ensureFonts, collectRows };
