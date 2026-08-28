# Discord Role Manager

A Discord.js v14 bot plus a web GUI that replaces Discord’s per-channel overwrite maze with **named access profiles** on categories and channels.

New members only see a verification gate until they react with ✅. Boosters automatically get a perk category. Moderator trainees can manage chat immediately, but member actions wait for a moderator to approve.

## What problem this solves

Discord makes you edit View Channel / Send Messages on every category, every channel, and every role. On a real server that is dozens of categories and hundreds of overwrites.

This bot stores a simple model instead:

| Profile | Who can see / chat |
| --- | --- |
| Verification gate | Unverified can see and react, not chat |
| Read-only info | Newbie+ can read |
| Newbie+ | Just-verified members (typical community) |
| Member+ | Optional second gate after Newbie |
| Booster perks | Nitro boosters + staff |
| Staff / Moderators / Administrators / Developer / Owner only | Staff ladders |
| Custom | Per-rank view & chat toggles in the GUI |
| Inherit category | Default for channels |

You pick a profile in `/panel`, `/access`, or the dashboard. **Apply** writes Discord overwrites only for the ranks you bound. Other roles (other bots, extra community roles) are left alone.

**Staff roles are created without Discord’s Administrator flag.** That flag bypasses channel overwrites, which would make the matrix useless. The guild owner user always counts as Owner.

## Ranks

| Rank | What they can do |
| --- | --- |
| **Owner** | Everything. Always sees and can chat in managed channels. The Discord guild owner is this rank even without a role. |
| **Developer** | Bot / access / verification config. **Cannot** timeout, kick, ban, or otherwise manage players (meant for the people running your *other* bot). Always *sees* channels so they can debug. |
| **Administrator** | Create and move channels/categories, bind moderator ranks, apply access, moderate members including ban. |
| **Moderator** | Manage chat and members (timeout, kick). Approves trainee requests. Cannot ban. |
| **Moderator Trainee** | Purge / slowmode immediately. Timeout, kick, and nick **create a request** that a moderator must approve. |
| **Booster** | Auto-assigned while someone is boosting. Used for the booster category. |
| **Member** | Optional graduated community role. |
| **Newbie** | Granted by any reaction on `VERIFY_MESSAGE_ID` (or the verify button / `/setup verify` panel). |
| **Unverified** | Defaults to `@everyone`. New joins only see channels whose profile allows Unverified (the gate). |

## Commands

- `/panel` — control panel (access, map, setup, verify, boosters, trainee queue, dashboard link)
- `/setup roles` — create and bind rank roles
- `/setup verify channel:#verify` — post the ✅ / button gate
- `/setup booster category:` — booster perk category
- `/setup status`
- `/access gui` · `/access set` · `/access apply`
- `/map` — canvas picture of the category tree colored by profile
- `/structure`
- `/channel create|move|rename` · `/category create|rename`
- `/mod timeout|kick|ban|purge|slowmode|nick`
- `/trainee pending|approve|deny`
- `/roles bind|unbind|list`
- `/dashboard` — magic link to the web GUI (DMs you; falls back to ephemeral)

## Web dashboard

The dashboard shows the live category/channel tree. Click a node, pick a profile (or custom view/chat checkboxes), save, then **Apply to Discord**.

Auth is a magic link from `/dashboard` so you do **not** need `DISCORD_CLIENT_SECRET`. Links expire in 12 hours.

## Environment

Copy `.env.example` to `.env`.

**Required to run the bot**

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`

**Required unless you only preview the UI**

- `DATABASE_URL` — Postgres, e.g. `postgres://rolebot:rolebot@localhost:5432/rolebot`

**Optional**

- `GUILD_ID` — register slash commands to one guild (instant)
- `VERIFY_MESSAGE_ID` — **the Discord message to watch**. Any reaction on it grants the Newbie role. Enable Developer Mode → right-click the message → Copy Message ID.
- `VERIFY_CHANNEL_ID` — channel that contains that message (so the bot can fetch/cache it on startup)
- `NEWBIE_ROLE_ID` — role given on react (otherwise bind with `/roles bind`)
- `BOOSTER_CATEGORY_ID`, `LOG_CHANNEL_ID` — defaults `/setup` can pick up
- `DASHBOARD_PORT` (default `3000`)
- `DASHBOARD_PUBLIC_URL` — must be reachable by your browser (used in magic links)
- `SESSION_SECRET`
- `DEPLOY_COMMANDS` — re-register commands on boot (default true)

## Discord Developer Portal

Enable these **Privileged Gateway Intents**:

- Server Members Intent (joins, boosters, role assignment)

Invite the bot with at least: Manage Roles, Manage Channels, Manage Messages, Kick Members, Ban Members, Moderate Members, Add Reactions, Embed Links, Attach Files, Read Message History, Send Messages, View Channels.

Put the **bot role above** Newbie / staff roles it must assign.

## Run

```bash
cp .env.example .env
# fill DISCORD_TOKEN and DISCORD_CLIENT_ID

docker compose up -d postgres
npm install
npm run migrate
npm start
```

Then in Discord: `/setup roles` (or set `NEWBIE_ROLE_ID`) → put `VERIFY_MESSAGE_ID` in `.env` → assign profiles → `/access apply`.

`/setup verify` is optional if you already have a rules/verify message to react on.

### Preview the GUI without a bot token

```bash
npm run preview:dashboard
# open http://localhost:3000 → “Open preview dashboard”
```

```bash
npm run preview:map
# writes output/access-map-1.png
```

```bash
npm test
```

## Product defaults (change any of these)

You asked for scope questions; these are the defaults so the repo is usable immediately:

1. **Multi-guild** — every table is keyed by `guild_id`.
2. **Newbie from any reaction** on `VERIFY_MESSAGE_ID` (and optionally the `/setup verify` button). Removing the reaction does not strip the role.
3. **Trainees** may manage chat without approval; member actions need a moderator.
4. **Developers** cannot moderate players; they can configure access.
5. **Boosters** get a bound role automatically; the booster category uses the Booster perks profile.
6. **Apply** only upserts overwrites for `@everyone` and bound rank roles.
7. Dashboard auth is a Discord magic link, not OAuth.

Follow-ups that are easy to add later: extra community ranks, role menus, per-user overrides, or Discord OAuth for the dashboard.
