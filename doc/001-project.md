# Private Nostalgic Farm Game — Project Plan

## 1. Project Summary

Build a private browser-based 2D farming game inspired by old social farm games from the Orkut era (like Happy Farm).

This is an **original game** that recreates the *emotional experience* of those games with its own visual identity and assets.

Mechanically, this project now targets a **high-fidelity recreation** of classic social-farm systems (especially Happy Farm / Colheita Feliz style loops) as documented in `doc/002-original.md`.

The goal is to reproduce the gameplay behavior and progression feel as closely as practical, while keeping names, art, audio, branding, and UI assets original.

The game should feel nostalgic, cozy, simple, colorful, and relaxing. The first version should focus on the core loop:

1. Open the farm.
2. Plant seeds.
3. Wait for crops to grow in real time.
4. Harvest crops.
5. Sell harvested items.
6. Earn coins and XP.
7. Unlock more seeds and decorations.

This is a private personal project, not a commercial public clone. The game must not use the original name, assets, UI, icons, sounds, or copied artwork from any existing game.

Suggested internal project name:

```txt
nostalgic-farm
```

Suggested in-game names:

```txt
Our Little Farm
Happy Garden
Cozy Harvest
Family Farm
```

Final name can be changed later.

---

## 2. Main Goal

Create a playable web game that recreates the emotional experience of old browser farming games:

* simple farm grid;
* real-time crop growth;
* planting and harvesting;
* coins and XP;
* shop;
* inventory/storage;
* decorations;
* later: animals and private friend visits.

The first deliverable must be a working single-player local version.

### 2.1 Direction Update (2026-06-18)

Gameplay direction is now explicitly driven by the original mechanics reference:

* Canonical mechanics source: `doc/002-original.md`
* Priority: replicate documented mechanics and interaction loops, including social tension loops (help/steal/protect), crop care states, warehouse flow, and event visibility.
* Constraint: keep implementation and assets original (no copied proprietary art, names, logos, or UI layouts).

### 2.2 Mechanics Parity Snapshot (2026-06-18)

Already aligned with the historical loop:

* real-time timestamp-based crop growth
* planting, harvesting, storage inventory, and selling loop
* XP/level progression with unlock gates
* decorations baseline
* animals baseline

Still missing for closer original parity:

* multi-season crops and fertilizer acceleration
* animal lifecycle depth (feeding, growing-to-sell animals, status bars, lifespan)
* social loop (friend visits, help actions, stealing limits, optional sabotage)
* flowers, gifts, and a separate popularity track
* event/assistant log with clear action history
* dog/security and anti-theft interactions
* land expansion and unlockable plots
* daily reward and daily action caps

### 2.3 Strict Mechanics Parity Backlog (Execution Order)

This backlog maps the documented mechanics in `doc/002-original.md` to implementation phases.

Status legend:

* DONE: already implemented
* PARTIAL: implemented in simplified form
* TODO: not implemented yet

Phase P0 - Lock parity baseline

* Goal: freeze current playable baseline and parity plan before new systems.
* Mechanics target: none (planning checkpoint).
* Current status: PARTIAL (docs updated, execution order now defined).
* Exit criteria:
  * this section remains the source of implementation order;
  * every gameplay feature mapped to a parity phase below.

Phase P1 - Crop care and failure states

* Goal: match crop maintenance pressure from originals.
* Mechanics target:
  * dryness/drought;
  * weeds;
  * pests/bugs;
  * crop health decay;
  * harvest block or penalty when unhealthy.
* Current status: DONE.
* Exit criteria:
  * planted tiles can independently become dry/weedy/pested by elapsed time rules;
  * player can water/remove weeds/remove pests;
  * health value is persisted and affects crop outcomes.
* Implementation notes:
  * deterministic, timestamp-based care simulation in `frontend/src/game/systems/CareSystem.ts`;
  * care advances on load (covers closed-game time) and every tick, scaled by dev growth speed;
  * clicking a planted tile resolves the most urgent problem first (pests > weeds > dry) before harvesting;
  * crop health scales harvest XP (40%-100%); care state persisted via save v4.

Phase P2 - Mature window, wither, and hoe cleanup

* Goal: add return-time urgency from the original loop.
* Mechanics target:
  * mature grace window;
  * wither/dead transition if ignored;
  * tile residue/dead cleanup with hoe action.
* Current status: DONE.
* Exit criteria:
  * mature crops can expire into dead state;
  * dead/residue tiles cannot be replanted until cleaned;
  * state transitions are timestamp-based and persist across reload.
* Implementation notes:
  * crops wither if health reaches 0 or if left past their mature grace window
    (`MATURE_GRACE_MULTIPLIER` of grow time) via `isCropDead` in `CareSystem.ts`;
  * dead tiles render as `Withered` and must be cleared with a hoe click before
    replanting or decorating;
  * `dead` tile state is persisted in save v4 and resolves correctly after reload.

Phase P3 - Multi-season and fertilizer parity

* Goal: add deeper crop lifecycle and acceleration tools.
* Mechanics target:
  * multi-season crops (regrowth cycles);
  * fertilizer types with different time reduction values;
  * optional friend-usable fertilizer variant.
* Current status: DONE (multi-season + single-player fertilizer; friend variant deferred to P4b).
* Exit criteria:
  * at least one crop supports more than one harvest season;
  * fertilizer usage is inventory-based and persisted;
  * growth reduction rules are deterministic and validated.
* Implementation notes:
  * crops define optional `seasons` (strawberry 3, corn 2, tomato 1);
  * harvesting a non-final season regrows the crop (fresh growth + reset care)
    instead of clearing the tile; final season clears as before;
  * current season persisted on the tile (save v4) and shown in tile subtitle;
  * three coins-only fertilizers (normal -30s/15c, fast -75s/35c, super
    -165s/80c) matching the original 1:2.5:5.5 reduction ratio; data in
    `data/fertilizers.ts`;
  * fertilizers stored in a dedicated `fertilizers` save map (save v5, with
    v1-v4 migrations) to avoid entanglement with sellable inventory;
  * parity rule enforced: a crop can be fertilized only once per growth stage
    (tracked via `FarmTile.fertilizedStage`);
  * UX mirrors the original tool model: toggle Fertilizer mode (F), then click a
    growing crop to apply; buy with B, switch type with , / .; reduction is
    deterministic and dev-speed aware;
  * friend-usable "love" fertilizer intentionally deferred to the social phase.


Phase P3b - Animal lifecycle depth

* Goal: bring animals from baseline egg generation to full original-style lifecycle.
* Mechanics target:
  * animal feeding with timed food duration;
  * productive animals (egg/milk/wool/honey) gated by feed state;
  * growing animals that mature and are sold;
  * animal status bars (food, growth, productivity) and optional lifespan.
* Current status: DONE.
* Implementation notes:
  * animals are now per-instance (`AnimalState[]`) rather than aggregate coops,
    each tracking `fedUntil`, `storedProduct`, `produceProgressMs`, `growthMs`
    and `matured`;
  * two starter types in `data/animals.ts`: chicken (productive: feed -> lay
    eggs to a cap -> collect -> sell eggs) and calf (growing: feed -> mature
    through Calf/Heifer/Cow -> sell for coins);
  * feeding is timestamp-based with a food duration (chicken 120s / calf 180s at
    prototype scale, ~2:3 mirroring the original 8h:12h) and is dev-speed aware;
  * only the fed portion of elapsed time advances produce/growth, so unfed
    animals stall exactly like the original;
  * barn panel exposes Buy Chicken / Buy Calf / Feed All (A) / Collect Products
    (E) / Sell Mature (M); status text shows per-animal food + produce/growth;
  * save bumped to v6 with a migration that converts legacy chicken coops into
    hungry chicken instances and moves stored eggs into inventory.
* Exit criteria:
  * animals require feeding to produce or grow; [met]
  * at least one productive animal and one growing animal type exist; [met]
  * animal state is timestamp-based and persisted. [met]

Phase P4 - Social baseline: visit, help, steal, log

* Goal: reproduce core social tension loop.
* Mechanics target:
  * friend farm visit;
  * help actions (water, weed, pest removal);
  * stealing from mature crops with per-crop/per-visit limits;
  * assistant/event log for both owner and visitor.
* Current status: DONE (local simulated neighbors; real friends deferred to the
  backend phase).
* Implementation notes:
  * neighbors are locally simulated NPC farms (Maria / João / Ana) generated by
    a deterministic seeded PRNG and persisted in the save (`NeighborFarm[]`);
    this lets the full social loop work offline, and the same shape can later be
    backed by real friends when the sync backend lands;
  * each neighbor farm is a 4x3 plot grid with a deterministic mix of ripe
    crops (stealable), crops carrying a problem (dry / weeds / pests) to help
    with, and healthy growing crops;
  * a dedicated `NeighborScene` is the visit view: clicking a plot resolves the
    most urgent problem (help) or harvests a ripe crop (steal);
  * help grants +2 XP / +1 coin per action; stealing grants +3 XP and drops the
    stolen unit into the player's inventory to sell later;
  * steal limits are enforced both per tile (3 units, then the crop regrows so
    the owner keeps the rest) and per visit (5 units total);
  * every help/steal action writes a timestamped entry to a shared activity log
    (`FarmEvent[]`, capped to 25) shown on the main farm and inside the visit
    view;
  * save bumped to v7 with a migration that seeds default neighbors + an empty
    event log onto older saves.
* Exit criteria:
  * approved users can visit friend farms; [met — visit any of the 3 neighbors]
  * at least one help action and one steal action are available; [met — water /
    weed / pest help + steal]
  * every social action writes a visible event log entry with timestamp. [met]

Phase P4b - Flowers, gifts, and popularity

* Goal: reproduce the social-prestige track that was separate from farming XP.
* Mechanics target:
  * flowers that grow like crops but are giftable;
  * gift inbox (send/receive);
  * popularity score that increases from received flowers/gifts;
  * popularity shown distinctly from XP/level.
* Current status: DONE.
* Implementation notes:
  * Added two giftable flower crops (`rose`, `sunflower`) flagged with `isFlower` on `CropDefinition`; they grow like any other crop.
  * `social.ts` gained a `Gift` type; `SocialSystem.ts` gained flower helpers (`flowerCrops`, `isFlowerCrop`, `makeGift`, `createStarterGifts`) and gift/popularity constants (`POPULARITY_PER_GIFT` 5, `GIFT_OUT_XP` 1).
  * Save bumped to v8: `popularity` + `giftInbox` added to `SaveGame`, with a v7→v8 migration (seeds two starter gifts, popularity 0) plus pass-through in every older migration branch.
  * NeighborScene: "Gift a Flower (F)" consumes a flower from inventory, grants `GIFT_OUT_XP`, and the neighbor reciprocates with a gift that lands in the player's inbox.
  * FarmScene: popularity HUD line (`★ Popularity / Gifts waiting`) shown separately from coins/XP/level; "Collect Gifts (C)" converts inbox gifts into popularity and logs a system event.
* Exit criteria:
  * player can grow and gift a flower to a friend; [met]
  * receiving a gift raises a persisted popularity value; [met]
  * popularity is displayed separately from XP and level. [met]

Phase P5 - Sabotage and protection (dog/security)

* Goal: complete the classic revenge/protection loop.
* Mechanics target:
  * optional sabotage (place weed/bug on friend farm);
  * dog/guard system that can prevent or penalize theft/sabotage;
  * protection state visibility.
* Current status: DONE.
* Implementation notes:
  * `SABOTAGE_ENABLED` product flag in `SocialSystem.ts` gates the whole sabotage path; when off, the sabotage toggle is never created.
  * Sabotage (NeighborScene "Sabotage: ON/OFF" toggle, key X) places bugs then weeds on a neighbor's planted tile and logs a `sabotage` event; the infestation persists on that neighbor's tile.
  * Guard dogs: `NeighborFarm.hasDog` (first neighbor unguarded, the rest guarded). Stealing or sabotaging a guarded farm rolls `DOG_CATCH_CHANCE`; on a catch the player is fined `DOG_FINE` coins, the action is aborted, and a `caught` event is logged.
  * The player can buy a guard dog for their own farm (FarmScene "Buy Guard Dog", key K, `DOG_PRICE` coins); ownership persists and is shown in the HUD. (NPC neighbors don't raid the player in the local prototype, so the player's dog is a visible protection state pending the multiplayer phase.)
  * Protection visibility: each visit shows whether the farm is guarded; the farm HUD shows the player's own guard-dog state.
  * Save bumped to v9 (`player.hasDog` + `neighbor.hasDog`); v8→v9 migration assigns the default dog layout and a dogless player. `FarmEventKind` extended with `sabotage` and `caught`.
* Exit criteria:
  * sabotage can be enabled/disabled by product flag; [met]
  * protected farms can trigger anti-theft penalties; [met]
  * protection outcomes are logged in event history. [met]

Phase P5b - Land expansion and plot unlocks

* Goal: match the progression of unlocking/expanding farm area over time.
* Mechanics target:
  * locked plots that can be unlocked with coins and/or level;
  * farm area growth beyond the initial 6x4 grid;
  * persistence of unlocked plot layout.
* Current status: DONE.
* Implementation notes:
  * The field stays a fixed 6x4 grid (the maximum area); the playable area starts at the top two rows and grows as locked plots are unlocked, mirroring the original "start small, expand" feel. (Physically enlarging the grid past 6x4 is deferred — the fixed grid keeps the save shape stable.)
  * `FarmTile.locked?: boolean`; the bottom two rows start locked (`createDefaultFarmTiles` locks rows >= 2).
  * `LandSystem.ts`: `plotUnlockInfo(tile)` gives each locked plot a coin cost (escalating per column) and a level requirement — row 2 is cheap/no gate, row 3 is pricier and needs level 2.
  * FarmScene: locked plots render dark with a lock icon and their price; clicking a locked plot runs `attemptUnlock` (checks level then coins, deducts, sets `locked=false`, logs a `system` event). The click handler intercepts locked plots before any plant/decor/fertilize path, so planting respects locked vs unlocked.
  * Save bumped to v10 (`FarmTile.locked`); the v9→v10 migration (and every older branch via `withLockedBottomPlots`) locks the empty bottom-row plots while never locking a plot that already holds a crop or decoration. `locked` round-trips through local save, reload, and upload/download sync.
* Exit criteria:
  * some plots start locked and can be unlocked; [met]
  * unlocked layout persists across reload and sync; [met]
  * planting respects locked vs unlocked plots. [met]

Phase P6 - Daily systems and anti-abuse limits

* Goal: replicate retention rhythms and prevent exploit loops.
* Mechanics target:
  * daily reward;
  * daily XP/action caps for repetitive social actions;
  * server-side reset window for caps.
* Current status: DONE (client-side; backend enforcement deferred to P8).
* Implementation notes:
  * `systems/DailySystem.ts` holds both mechanics. `DailyState` (in the save) tracks `lastClaimDate` + `streak` for the reward and `capsDate` + `helpXp` + `stealXp` for the anti-abuse caps. The reset window is the player's local calendar day (`dayKey`); `rolloverDaily` resets the cap counters when the day changes.
  * Daily reward: a 5-day rotating table (`DAILY_REWARD_CYCLE`: coins / produce / fertilizer / coins / rare produce — faithful to the original coins/seed/fertilizer/decoration/rare-seed idea, mapped onto this prototype's systems since planting costs coins directly and there is no decoration inventory yet). The streak continues if the previous claim was yesterday, otherwise it restarts at 1. FarmScene shows a "Daily reward ready / claimed" line plus a "Claim Daily Reward (J)" button that only appears when a claim is available.
  * Anti-abuse caps: helping and stealing stop paying XP/coins once the per-day XP cap is hit (`DAILY.HELP_XP_CAP` 40, `DAILY.STEAL_XP_CAP` 30). The action itself still happens (the friend's plot is still cleared, the crop is still taken) — only the reward stops, matching the original "after the daily cap these actions stopped giving XP/coins". NeighborScene shows the remaining daily XP for help and steal.
  * Save bumped to v11 (`SaveGame.daily`); v10->v11 (and every older branch) seeds a fresh `DailyState`. The daily state round-trips through local save, reload, and upload/download sync.
  * Backend note: per the project's local-first ordering ("Sync UX is LAST", P8), the reset window and caps are enforced client-side here. The "enforced by backend / server-side reset window" exit criterion is deferred to P8, where the save sync and server authority land; the cap/reward fields already live in the synced save so the backend can take over enforcement there.
* Exit criteria:
  * daily reward claim persists by date; [met]
  * help/steal XP gains stop or taper after cap; [met]
  * cap state is enforced by backend, not only UI. [deferred to P8 — client-side enforcement in place, fields synced for backend takeover]

Phase P7 - Economy parity tuning pass

* Goal: shift from MVP-fast pacing toward original-like pacing profiles.
* Mechanics target:
  * long crop timers profile set (with dev-speed override kept);
  * care costs/rewards tuning;
  * steal risk vs reward balancing.
* Current status: PARTIAL (economy and progression tuned for MVP speed).
* Exit criteria:
  * at least two pacing profiles exist (dev-fast and nostalgia);
  * documented target metrics for profit/hour and xp/hour per crop tier;
  * one full balancing pass completed after social mechanics are live.

Phase P8 - Final sync and conflict UX (last item)

* Goal: finish cloud sync ergonomics after gameplay parity is stable.
* Mechanics target:
  * upload/download merge strategy options;
  * force upload/download controls;
  * explicit conflict resolution UI.
* Current status: PARTIAL (basic timestamp conflict guard exists).
* Exit criteria:
  * player can choose conflict strategy intentionally;
  * sync outcomes are auditable via status/history;
  * no sync data loss in tested conflict scenarios.

Implementation rule for parity work:

1. Do not start a later phase before the previous phase exit criteria pass.
2. Keep visual and naming originality while matching gameplay behavior.
3. Keep sync UX as the final phase, unless a blocker requires minimal sync changes earlier.

---

## 2.5. Current Project Status (2026-06-18)

This section reflects the current implementation state in the repository and local runtime.

### Latest Health Check (verified)

* Verification time: 2026-06-18 (local run)
* `docker compose ps`:
  * `farmy-postgres`: healthy
  * `farmy-redis`: healthy
  * `farmy-rabbitmq`: healthy
  * `farmy-api`: up
  * `farmy-nginx`: up
* Endpoint checks:
  * `GET http://localhost:53001/health` → `200`
  * `GET http://localhost:53001/api/health/db` → `200`
  * `GET http://localhost:53001/api/health/redis` → `200`
  * `GET http://localhost:5080/health` → `200`
  * `GET http://localhost:5080/api/health/db` → `200` (nginx proxy working)
  * `GET http://localhost:55673/api/overview` (RabbitMQ management, basic auth) → `200`

### Completed

* Core documentation structure is in place (`README.md` at root, detailed docs under `doc/`).
* Docker Compose infrastructure is running locally with non-default host ports:
  * API: `53001`
  * PostgreSQL: `55432`
  * Redis: `56379`
  * RabbitMQ AMQP: `55672`
  * RabbitMQ Admin: `55673`
  * nginx: `5080`
* Backend API skeleton is implemented and running (`backend/src/index.ts`).
* Health endpoints are working directly via API:
  * `GET /health`
  * `GET /api/health/db`
  * `GET /api/health/redis`
* i18n backend foundation is implemented:
  * SQL migration for languages/translations
  * translation routes (`backend/src/routes/translations.ts`)
  * seed scripts (`backend/src/db/seed.ts`, `backend/src/db/seed-translations.ts`)
* Frontend i18n base files exist:
  * `frontend/src/i18n/config.ts`
  * `frontend/src/i18n/hooks.ts`
  * locale files in `frontend/locales/`
* Frontend Phase 1 base is implemented:
  * Vite + React + TypeScript scaffold in `frontend/`
  * Phaser bootstrap (`BootScene` + `FarmScene`) wired and building
  * Frontend local dev URL: `http://localhost:5173`
* Phase 4 save system is implemented (initial version):
  * `SaveSystem` with create/load/save/clear flows
  * 6x4 tile state persisted in localStorage
  * reset controls available (button + `R` shortcut)
* Phase 5 planting and economy baseline is implemented:
  * crop definitions for strawberry/corn/tomato
  * starting economy (`coins=100`, `xp=0`, `level=1`) persisted in save
  * planting on empty tiles deducts seed cost and saves immediately
  * guardrails for occupied tile and insufficient coins
  * basic HUD/status text for economy and selected seed
* Phase 6 real-time growth baseline is implemented:
  * planted tiles now store `plantedAt` timestamp
  * growth stage is computed by elapsed time vs crop `growSeconds`
  * tile visuals and labels update in real time (no scene restart required)
  * ready crops are visually distinguished from growing crops
* Phase 7 harvesting + inventory persistence is implemented:
  * clicking ready crops harvests and clears the tile
  * harvested crops are stored in persistent inventory
  * harvesting grants XP and updates player level
  * SaveSystem migrated to version 2 with inventory support
* Phase 8 selling baseline is implemented:
  * `Sell Inventory` action converts stored crops to coins using crop sell price
  * selling is available via button and `S` keyboard shortcut
  * inventory and economy are saved immediately after selling
* Phase 9 seed shop baseline is implemented:
  * seed selection UI allows switching active crop
  * crop selection enforces unlock level rules
  * selected seed remains persisted in save data
* Phase 10 progression feedback baseline is implemented:
  * level-up message now appears when XP crosses threshold
  * unlock messaging shows newly unlocked crops
  * seed lock/unlock checks use current player level
  * HUD now shows XP needed to reach next level
* Phase 10.5 balance and HUD polish baseline is implemented:
  * crop economy values were tuned for faster MVP pacing and clearer profit trade-offs
  * progression now uses a configurable XP curve instead of fixed linear level jumps
  * selected seed panel now shows sell value, profit, growth time, and XP reward
  * controls hint line was added to improve in-game usability
* Phase 12 decorations baseline is implemented:
  * decoration mode allows placing decor on empty tiles with level/coin rules
  * placed decorations are persisted in save data
  * decoration selector UI allows switching active decor option
* Phase 13 animals baseline is implemented:
  * chicken coop purchase flow with level/coin requirements
  * eggs are generated over time with per-coop capacity limits
  * egg collection adds inventory items and grants XP
  * animal progression state is saved and loaded with game data
* Phase 11 backend save sync baseline is implemented:
  * new API endpoints `GET/PUT /api/v1/game-state/me` backed by Redis
  * frontend upload/download actions sync local save with authenticated user profile
  * remote payload validation now enforces full 6x4 farm tile grid
  * Vite dev proxy now forwards `/api/*` to backend for local sync testing
  * real auth routes are available (`/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/me`)
  * JWT bearer auth now protects save sync endpoints
* Dev-only growth speed controls are implemented:
  * growth can run at `1x`, `10x`, or `100x` in development mode
  * speed toggles available via UI buttons and keys `1/2/3`
* Sync UX polish is implemented:
  * scene now shows sync state (`idle/syncing/success/error`)
  * last successful sync timestamp is displayed in UI
  * auth status displays current logged-in user
  * in-game controls allow register/login/logout for sync testing
  * sync now blocks overwriting when target save is newer (basic timestamp conflict guard)

### In Progress / Partial

* Backend is currently a scaffold for infrastructure and translation features; gameplay-specific endpoints are not implemented yet.
* Local single-player gameplay MVP is now functional: plant, grow, harvest, store, select seeds, and sell.
* Backend-connected persistence now uses real account auth, but sync polishing is intentionally deprioritized.

### Recently Fixed

* nginx API forwarding is now working.
  * `http://localhost:5080/api/health/db` returns `200` and correctly proxies to the API service.

### Not Started Yet (Gameplay)

* Final economy balancing pass after longer playtest sessions.
* Extended UI polish for shop and feedback panel visuals.
* Social phase (friend visits and private interactions).
* Final sync polish (manual merge/force actions and upload/download UX refinements).

### Recommended Next Steps

1. Run a mechanics gap analysis against `doc/002-original.md` and convert missing core systems into an implementation backlog.
2. Implement core crop-care loop parity: dryness, weeds, pests, and crop health/penalty flow.
3. Implement social parity baseline: friend farm visit actions (help, steal, optional sabotage) plus event log.
4. Keep sync UX as the last item: finalize upload/download conflict controls and merge strategy.

---

## 3. Important Legal and Creative Constraints

Do not copy proprietary assets or branding from any existing game.

The project must not:

* use the name of any existing farming game;
* use original screenshots as direct visual templates;
* copy icons, sprites, characters, interface elements, sounds, or logos;
* copy the exact layout pixel by pixel;
* use protected assets from old games, Orkut, Facebook games, mobile games, or commercial games.

The project may:

* use a general farming theme;
* replicate common and documented historical mechanics such as planting, watering, pests, weeds, harvesting, storage/warehouse selling, leveling, social help/steal loops, and decorations;
* create original pixel-art or cartoon-style assets;
* use placeholder shapes during development;
* later replace placeholders with original commissioned or AI-assisted assets, as long as they do not copy protected material.

The goal is **mechanics-faithful recreation with original presentation**.

---

## 4. Recommended Technology Stack

### Frontend

```txt
TypeScript
Vite
Phaser
HTML/CSS
React (for complex UI later)
```

### Backend (Docker Compose)

```txt
Node.js + Express (API server)
PostgreSQL (main database)
Redis (caching & real-time)
RabbitMQ (message queue for async tasks)
nginx (reverse proxy)
```

### Why This Stack

**Frontend:**
- Phaser provides scenes, sprites, input handling, animations, game loop, and pointer interactions.
- Vite gives fast development and simple bundling.
- TypeScript keeps state and entities predictable.
- React can be added later for complex modals (shop, inventory, settings, login).

**Backend:**
- Node.js + Express gives a simple, scalable HTTP API.
- PostgreSQL provides a reliable relational database for game state, users, and social features.
- Redis enables fast caching, real-time updates, and session management.
- RabbitMQ handles async tasks (crop notifications, friend requests, event logs) without blocking the API.
- nginx routes requests and handles multiple API instances for horizontal scaling.

### Scalability Strategy

This architecture supports:

* **Horizontal scaling** — Run multiple API instances behind nginx.
* **Session persistence** — Use Redis for session data across instances.
* **Asynchronous jobs** — Use RabbitMQ for background tasks (notifications, batch updates).
* **Database scaling** — PostgreSQL can be upgraded or replicated as needed.
* **Caching layer** — Redis reduces database load.

### Development Approach

Build with **local-first** strategy:

1. **Phase 1–2** — Client-side only (localStorage). No backend needed.
2. **Phase 3+** — Introduce Docker Compose backend for save sync, user accounts, and social features.
3. Client gracefully handles offline mode; sync when backend is available.

---

## 4.5. Internationalization (i18n) Strategy

The game supports multiple languages with **database-driven translations** for easy management and future scaling.

### Supported Languages (MVP)

1. **English** (default)
2. **Portuguese (Brazil)** (pt-BR)

Future: Spanish, French, German, Japanese, etc.

### Frontend i18n

Use **i18next** library for React-friendly translation management.

Setup:

```bash
npm install i18next react-i18next i18next-http-loader
```

Config: `src/i18n/config.ts`

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-loader';

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    defaultNS: 'common',
    backend: {
      loadPath: '/api/v1/translations/:lng/:ns',
    },
    interpolation: { escapeValue: false },
  });
```

Usage in code:

```tsx
import { useTranslation } from 'react-i18next';

function CropName() {
  const { t } = useTranslation();
  return <span>{t('crops.strawberry')}</span>;
}
```

### Backend Translation Storage

PostgreSQL tables:

```sql
CREATE TABLE languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,  -- 'en', 'pt-BR'
  name VARCHAR(50) NOT NULL,         -- 'English', 'Português (Brasil)'
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE translation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace VARCHAR(50) NOT NULL,    -- 'common', 'game', 'ui'
  key VARCHAR(255) NOT NULL,         -- 'crops.strawberry'
  context VARCHAR(255),              -- Optional context
  plural_form INT,                   -- For plural forms
  UNIQUE(namespace, key, context, plural_form),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  key_id UUID NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  last_updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(255),           -- User/system that updated
  UNIQUE(language_id, key_id)
);

CREATE INDEX idx_translations_language ON translations(language_id);
CREATE INDEX idx_translations_key ON translations(key_id);
CREATE INDEX idx_translation_keys_namespace ON translation_keys(namespace);
```

### API Endpoints

```
GET /api/v1/translations/:lang/:namespace
  Returns: { "crops.strawberry": "Strawberry", ... }

POST /api/v1/translations (admin only)
  Create/update translation

PUT /api/v1/translations/:id (admin only)
  Update single translation

GET /api/v1/languages
  Returns: [{ code: 'en', name: 'English', active: true }, ...]
```

### Language Persistence

Player's language choice is stored:

1. **localStorage** (client-side):
   ```js
   localStorage.setItem('language', 'pt-BR');
   ```

2. **User account** (after login):
   ```sql
   ALTER TABLE users ADD COLUMN language_preference VARCHAR(10) DEFAULT 'en';
   ```

### Translation Workflow

1. **Developer adds new key** in code:
   ```tsx
   <div>{t('game.newFeatureName')}</div>
   ```

2. **Backend seeding** populates translation keys:
   ```bash
   npm run seed:translations
   ```

3. **Admin/translator** fills in translations via API or admin panel.

4. **Client loads translations** on startup:
   ```js
   await i18n.changeLanguage('pt-BR');
   ```

### Language Detector

Auto-detect player's language:

```ts
import LanguageDetector from 'i18next-browser-languagedetector';

i18n.use(LanguageDetector).init({
  detection: {
    order: ['localStorage', 'navigator', 'htmlTag'],
    caches: ['localStorage'],
  },
});
```

Order of detection:
1. localStorage (saved preference)
2. browser language (navigator.language)
3. HTML lang attribute

### Fallback Strategy

- If translation missing in pt-BR → fallback to English
- If English missing → show key name (e.g., `crops.strawberry`)

### Adding a New Language (Future)

1. Create language in database:
   ```sql
   INSERT INTO languages (code, name) VALUES ('es', 'Español');
   ```

2. Populate translation keys (automated via seed script).

3. Hire translator to fill in translations.

4. Enable in frontend (add to language selector).

---

## 5. Initial Project Setup

Create the project:

```bash
npm create vite@latest nostalgic-farm -- --template vanilla-ts
cd nostalgic-farm
npm install
npm install phaser
npm install -D vitest
npm run dev
```

Add useful scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest"
  }
}
```

The project must always be buildable with:

```bash
npm run build
```

---

## 5.5. Docker Compose Backend Setup

Create a scalable backend with Docker. Setup in parallel with frontend development.

### Project Structure

```txt
nostalgic-farm/
  frontend/               # Your Vite + Phaser game
    src/
    package.json
  backend/                # Node.js API
    src/
    Dockerfile
    package.json
  docker-compose.yml      # Orchestrate all services
  .env.example
```

### docker-compose.yml

Save as `docker-compose.yml` in the project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: farmy-postgres
    environment:
      POSTGRES_USER: farmy_user
      POSTGRES_PASSWORD: farmy_password
      POSTGRES_DB: farmy_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U farmy_user -d farmy_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: farmy-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    container_name: farmy-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build: ./backend
    container_name: farmy-api
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://farmy_user:farmy_password@postgres:5432/farmy_db
      REDIS_URL: redis://redis:6379
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: npm run dev

  nginx:
    image: nginx:alpine
    container_name: farmy-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - api
    environment:
      - API_BACKEND=http://api:3001

volumes:
  postgres_data:
  redis_data:
  rabbitmq_data:
```

### Backend Project Setup

Initialize the backend:

```bash
mkdir backend
cd backend
npm init -y
npm install express pg redis amqplib cors dotenv
npm install -D typescript ts-node @types/node @types/express
npx tsc --init
```

### Run Services

Start all services:

```bash
docker-compose up -d
```

Check services:

```bash
docker-compose ps
docker-compose logs -f api
```

Stop services:

```bash
docker-compose down
```

### Development Workflow

1. **Frontend** runs on `http://localhost:5173` (Vite dev server)
2. **API** runs on `http://localhost:3001` (Node.js + Express)
3. **Database** accessible at `localhost:5432`
4. **Redis** accessible at `localhost:6379`
5. **RabbitMQ admin** at `http://localhost:15672` (guest/guest)

Update `frontend` API calls to use `http://localhost:3001` (or `/api` via nginx proxy).

---

## 6. Folder Structure

Create this structure:

```txt
src/
  game/
    main.ts
    config.ts

    scenes/
      BootScene.ts
      FarmScene.ts
      UIScene.ts

    systems/
      CropSystem.ts
      EconomySystem.ts
      InventorySystem.ts
      LevelSystem.ts
      SaveSystem.ts
      TimeSystem.ts
      ShopSystem.ts

    data/
      crops.ts
      shop.ts
      levels.ts

    types/
      crop.ts
      farm.ts
      inventory.ts
      economy.ts
      save.ts

    utils/
      ids.ts
      time.ts

  ui/
    styles.css

  assets/
    crops/
    tiles/
    ui/
    decorations/
    animals/
```

**Important:** Use placeholder graphics at first. Do not block progress waiting for real art. When replacing placeholders with final visuals:

* Create original pixel art or commission assets (do not reuse Happy Farm or other protected game assets)
* Use royalty-free asset packs if needed
* Maintain a distinct visual identity from the source game
* Document the origin of any external assets (licenses, sources)

---

## 7. Game Design Overview

### 7.1 Core Game Loop

The player starts with:

```txt
Coins: 100
XP: 0
Level: 1
Farm grid: 6 columns x 4 rows
Available seed: Strawberry
```

Basic loop:

```txt
Buy or select seed
Click empty tile
Plant seed
Wait for crop growth
Harvest crop
Crop goes to inventory
Sell crop
Gain coins and XP
Unlock more seeds
Repeat
```

### 7.2 Farm Grid

Initial grid:

```txt
6 columns
4 rows
24 total soil tiles
```

Each tile can be:

```txt
empty
planted
ready
dead
```

Later states:

```txt
dry
watered
has_pest
fertilized
```

### 7.3 Crop Growth

Crop growth must be based on timestamps, not timers.

Correct approach:

```txt
cropStage = calculateStage(plantedAt, currentTime, growDuration)
```

Do not rely on `setTimeout` to grow crops.

This allows crops to continue growing while the game is closed.

---

## 8. Core Types

Create the following TypeScript models.

### 8.1 Farm Tile

```ts
export type FarmTileState = "empty" | "planted" | "ready" | "dead";

export type FarmTile = {
  id: string;
  x: number;
  y: number;
  state: FarmTileState;
  cropId?: string;
  plantedAt?: string;
  wateredAt?: string;
  hasPest?: boolean;
  isFertilized?: boolean;
};
```

### 8.2 Crop Definition

```ts
export type CropDefinition = {
  id: string;
  name: string;
  seedPrice: number;
  sellPrice: number;
  growSeconds: number;
  xp: number;
  unlockLevel: number;
  stages: string[];
};
```

### 8.3 Inventory Item

```ts
export type InventoryItem = {
  itemId: string;
  quantity: number;
};
```

### 8.4 Player Economy

```ts
export type PlayerEconomy = {
  coins: number;
  xp: number;
  level: number;
};
```

### 8.5 Save Game

```ts
import type { FarmTile } from "./farm";
import type { InventoryItem } from "./inventory";
import type { PlayerEconomy } from "./economy";

export type SaveGame = {
  version: number;
  savedAt: string;
  economy: PlayerEconomy;
  farmTiles: FarmTile[];
  inventory: InventoryItem[];
};
```

---

## 9. Initial Crop Data

Create `src/game/data/crops.ts`.

```ts
import type { CropDefinition } from "../types/crop";

export const crops: CropDefinition[] = [
  {
    id: "strawberry",
    name: "Strawberry",
    seedPrice: 10,
    sellPrice: 25,
    growSeconds: 300,
    xp: 3,
    unlockLevel: 1,
    stages: ["seed", "sprout", "small", "ready"]
  },
  {
    id: "corn",
    name: "Corn",
    seedPrice: 20,
    sellPrice: 55,
    growSeconds: 900,
    xp: 8,
    unlockLevel: 2,
    stages: ["seed", "sprout", "small", "ready"]
  },
  {
    id: "tomato",
    name: "Tomato",
    seedPrice: 35,
    sellPrice: 90,
    growSeconds: 1800,
    xp: 15,
    unlockLevel: 3,
    stages: ["seed", "sprout", "small", "ready"]
  }
];
```

During development, crop times may be reduced for testing.

Example dev values:

```txt
Strawberry: 10 seconds
Corn: 20 seconds
Tomato: 30 seconds
```

Before release, increase times.

---

## 10. Required Systems

### 10.1 CropSystem

Responsibilities:

* plant a crop;
* calculate current crop stage;
* determine if crop is ready;
* harvest crop;
* prevent planting on occupied tile;
* prevent harvesting before ready.

Required functions:

```ts
plantCrop(tile, cropId, now)
getCropStage(tile, cropDefinition, now)
isCropReady(tile, cropDefinition, now)
harvestCrop(tile, cropDefinition, now)
```

### 10.2 EconomySystem

Responsibilities:

* manage coins;
* spend coins;
* add coins;
* add XP;
* calculate level.

Required functions:

```ts
canAfford(economy, amount)
spendCoins(economy, amount)
addCoins(economy, amount)
addXp(economy, xp)
```

### 10.3 InventorySystem

Responsibilities:

* add harvested crops;
* remove sold crops;
* calculate inventory quantities.

Required functions:

```ts
addItem(inventory, itemId, quantity)
removeItem(inventory, itemId, quantity)
getItemQuantity(inventory, itemId)
```

### 10.4 SaveSystem

Responsibilities:

* save game to localStorage;
* load game from localStorage;
* create default save;
* handle save versioning later.

Required functions:

```ts
saveGame(save)
loadGame()
createDefaultSave()
clearSave()
```

### 10.5 ShopSystem

Responsibilities:

* list available seeds by player level;
* buy/plant seed;
* validate unlock level;
* validate available coins.

Required functions:

```ts
getAvailableCrops(level)
canBuyCropSeed(economy, cropDefinition)
```

---

## 11. Scene Plan

### 11.1 BootScene

Responsibilities:

* configure initial game;
* load assets later;
* move to FarmScene.

For now, BootScene can immediately start FarmScene.

### 11.2 FarmScene

Responsibilities:

* render farm background;
* render soil grid;
* render crops;
* handle tile clicks;
* call game systems;
* update crop visuals based on calculated stage;
* save after relevant actions.

Initial interactions:

```txt
Click empty tile -> plant selected seed
Click ready crop -> harvest crop
Click planted but not ready crop -> show current stage/progress
```

### 11.3 UIScene

Responsibilities:

* show coins;
* show XP;
* show level;
* show selected seed;
* show buttons:

  * shop;
  * inventory;
  * save;
  * reset;

````

For the first MVP, UIScene can be simple Phaser text/buttons.

---

## 12. Visual Direction

The visual style should be:

```txt
cozy
bright
simple
colorful
nostalgic
soft cartoon or pixel-art inspired
````

Avoid realistic 3D.

Initial placeholders:

* soil tile: brown rounded rectangle;
* empty tile: brown;
* planted seed: small green dot;
* sprout: small green shape;
* growing crop: larger green shape;
* ready crop: colored fruit/vegetable shape.

Later assets can be replaced.

---

## 13. Development Phases

## Phase 1 — Project Base

Goal: working Vite + Phaser project.

Tasks:

* create Vite TypeScript project;
* install Phaser;
* create `main.ts`;
* create Phaser game config;
* create BootScene;
* create FarmScene;
* render a background color.

Acceptance criteria:

```txt
npm run dev starts the game.
Browser shows a Phaser canvas.
No TypeScript errors.
npm run build succeeds.
```

---

## Phase 2 — Docker Compose Backend Setup (Optional, Early)

Goal: deploy scalable backend infrastructure locally.

**When to do this:** Parallel to Phase 3–4, or before if you plan early multiplayer.

Tasks:

* create `docker-compose.yml` with PostgreSQL, Redis, RabbitMQ, nginx;
* create Node.js + Express API skeleton;
* test all services with `docker-compose up`;
* verify PostgreSQL connection and schema migrations;
* verify Redis and RabbitMQ are accessible.

Acceptance criteria:

```txt
docker-compose up -d starts all services without errors.
docker-compose ps shows all services healthy.
API server at http://localhost:3001 responds to health check.
PostgreSQL accessible at localhost:5432.
Redis accessible at localhost:6379.
RabbitMQ admin at http://localhost:15672 (guest/guest).
docker-compose down cleanly stops all services.
```

**Note:** You can skip this phase during MVP and add it later. The frontend works offline with localStorage alone.

---

## Phase 2.5 — Internationalization (i18n) Setup

Goal: establish multilingual infrastructure for English and Portuguese (Brazil).

**When to do this:** After Phase 2 Docker setup, or early during MVP before implementing game UI.

Tasks:

* install i18next and react-i18next in frontend;
* create i18n config file;
* set up language detection (localStorage fallback to browser language);
* create translations table in PostgreSQL;
* seed initial translations (crops, UI labels, game messages);
* create `/api/v1/translations/:lang/:namespace` endpoint;
* add language selector to UI;
* store language preference in localStorage (and user account after login).

Acceptance criteria:

```txt
Frontend loads with correct language (English by default).
Browser language is detected (e.g., pt-BR loads Portuguese).
Player can switch languages via selector.
Language preference persists in localStorage.
API endpoint returns translations correctly.
Missing translations fallback to English.
Both English and Portuguese translations are complete for MVP UI.
Game displays UI strings in selected language.
```

**Note:** For Phase 1 MVP, you can hardcode English strings and add i18n later. Or implement this early if you want multilingual from launch.

---

## Phase 3 — Farm Grid

Goal: display a clickable farm grid.

Tasks:

* create 6x4 grid;
* render soil tiles;
* each tile has an id, x, y, and state;
* clicking a tile selects it;
* selected tile has visible highlight.

Acceptance criteria:

```txt
The farm shows 24 tiles.
Clicking a tile highlights it.
Clicking another tile changes selection.
No game state is lost during interaction.
```

---

## Phase 4 — Save System

Goal: save and load the farm state locally.

Tasks:

* create SaveSystem;
* create default save;
* save to localStorage;
* load from localStorage;
* add reset save function for development.

Acceptance criteria:

```txt
Reloading the page keeps the farm state.
Reset button clears the save and starts over.
Invalid or missing save creates a default save.
```

---

## Phase 5 — Planting

Goal: plant one crop type.

Tasks:

* create crop definitions;
* create CropSystem;
* select default crop: strawberry;
* clicking empty tile plants strawberry;
* planting costs coins;
* tile stores cropId and plantedAt.

Acceptance criteria:

```txt
Player starts with 100 coins.
Planting strawberry costs 10 coins.
Empty tile becomes planted.
Occupied tile cannot be planted again.
Reloading page keeps planted crops.
```

---

## Phase 6 — Real-Time Crop Growth

Goal: crops grow based on elapsed time.

Tasks:

* calculate crop stage using `plantedAt`;
* render visual difference between stages;
* do not use setTimeout for growth;
* update visuals on scene update or periodic refresh.

Acceptance criteria:

```txt
Crop changes stage after enough real time passes.
Reloading page shows correct stage.
Closing and reopening the game does not reset crop growth.
Ready crop is visually distinct.
```

---

## Phase 7 — Harvesting

Goal: harvest ready crops.

Tasks:

* determine if crop is ready;
* clicking ready crop harvests it;
* harvested item goes to inventory;
* tile becomes empty again;
* player receives XP.

Acceptance criteria:

```txt
Not-ready crops cannot be harvested.
Ready crops can be harvested.
Harvesting adds crop to inventory.
Harvesting resets tile to empty.
Harvesting grants XP.
State persists after reload.
```

---

## Phase 8 — Inventory and Selling

Goal: sell harvested crops.

Tasks:

* create InventorySystem;
* show inventory panel/modal;
* list crop quantities;
* sell one item;
* sell all items;
* add coins from sale.

Acceptance criteria:

```txt
Harvested crops appear in inventory.
Selling one item reduces quantity.
Selling all removes all sellable items.
Coins increase correctly.
Inventory persists after reload.
```

---

## Phase 9 — Leveling

Goal: unlock crops through XP.

Tasks:

* define level thresholds;
* calculate level from XP;
* show level in HUD;
* crops have unlockLevel;
* shop only shows unlocked crops.

Example thresholds:

```ts
export const levelThresholds = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 20 },
  { level: 3, xpRequired: 60 },
  { level: 4, xpRequired: 120 },
  { level: 5, xpRequired: 220 }
];
```

Acceptance criteria:

```txt
Player gains XP from harvesting.
Level updates when XP threshold is reached.
New crops unlock by level.
Locked crops cannot be planted.
```

---

## Phase 10 — Shop

Goal: choose between unlocked seeds.

Tasks:

* create shop UI;
* list available crops;
* show seed price, sell price, grow time, XP;
* allow selecting seed;
* selected seed appears in HUD.

Acceptance criteria:

```txt
Shop opens and closes.
Unlocked crops are selectable.
Locked crops are hidden or disabled.
Selected seed is used when planting.
```

---

## Phase 11 — Watering and Pests

Goal: add simple care mechanics.

Tasks:

* add wateredAt to tile;
* add watering action;
* randomly add pests to planted crops;
* pest slows growth or blocks harvest;
* player can remove pest.

Keep it simple.

Suggested rules:

```txt
Watering gives small growth speed bonus.
Pests have a small random chance to appear.
Crops with pests cannot be harvested until pest is removed.
```

Acceptance criteria:

```txt
Player can water planted crops.
Watered crops show visual feedback.
Pests appear occasionally.
Player can remove pests.
Pested crop cannot be harvested before pest removal.
```

---

## Phase 12 — Decorations

Goal: allow farm personalization.

Tasks:

* create decoration item type;
* create decoration shop;
* allow placing decoration on non-soil grid areas or decoration layer;
* allow moving/removing decoration;
* save decoration positions.

Initial decorations:

```txt
Fence
Tree
Flower pot
Bench
Small pond
Scarecrow
```

Acceptance criteria:

```txt
Player can buy decoration.
Player can place decoration.
Decoration position persists after reload.
Decoration does not break crop interactions.
```

---

## Phase 13 — Animals

Goal: add simple animals.

Initial animals:

```txt
Chicken
Cow
Pig
```

Simple animal loop:

```txt
Buy animal
Place animal
Feed animal
Wait
Collect product
Sell product
```

Products:

```txt
Chicken -> egg
Cow -> milk
Pig -> truffle or bonus item
```

Acceptance criteria:

```txt
Player can buy an animal.
Animal appears on farm.
Animal can be fed.
Animal produces item after time passes.
Product can be collected and sold.
```

---

## Phase 14 — Private Social Features

Only start this after the local MVP is stable.

Recommended backend:

```txt
Supabase
Postgres
Supabase Auth
Supabase Realtime if needed
```

Features:

* login;
* private family/friends list;
* visit another farm;
* help water crops;
* remove pests;
* optionally steal a small amount from ready crops;
* event log.

Important:

Do not implement social features before the single-player version is fun.

Suggested tables:

```sql
users
farms
farm_tiles
inventory
decorations
animals
friendships
farm_events
```

Acceptance criteria:

```txt
User can log in.
User has one farm.
User can visit approved friend's farm.
Helping action is recorded.
Farm owner can see event log.
```

---

## 14. Data Persistence Strategy

### Hybrid Local-First + Backend Approach

This architecture uses **local-first design** with optional backend sync:

### Stage 1 — Local Only (Phases 1–2)

Use `localStorage` for single-player game loop.

Pros:

* Simple, fast, no backend dependency.
* Game is playable offline.
* Good for prototyping core mechanics.

Cons:

* Device-specific (no cross-device sync).
* Easy to lose (clear cache = lost save).
* No multiplayer features.

### Stage 2 — Backend Integration (Phase 3+)

Deploy Docker Compose services and add backend sync.

**Client behavior:**
- Continue using `localStorage` as primary store.
- Periodically sync state to backend.
- Gracefully handle offline mode.

**Server stores:**
- PostgreSQL: authoritative user accounts, farm state, social graph.
- Redis: session data, real-time updates (WebSocket).
- RabbitMQ: async jobs (notifications, crop timers, friend requests).

**Data flow:**
```
Client (localStorage)
    ↓ (sync on save/harvest/level-up)
Backend API
    ↓
PostgreSQL (persistent)
    ↓
Redis (cache & real-time)
    ↓
RabbitMQ (background jobs)
```

### Stage 3 — Multiplayer Features (Phase 13+)

Add private friend visits, shared farms, or co-op features using WebSocket (Socket.io) for real-time updates.

### Conflict Resolution

If client and server have different state:

1. Server is authoritative for user accounts, friends, and transactions.
2. Client is authoritative for ongoing farm state (unless in conflict).
3. On conflict, server state wins; client resyncs from server.

### Do Not Mix State Too Early

Keep local game loop simple during Phase 1–2.
Add backend complexity only when needed (social features, cross-device sync).

---

## 15. Game State Rules

The game must have one authoritative state object.

Avoid spreading state across many unrelated variables.

Recommended root state:

```ts
export type GameState = {
  economy: PlayerEconomy;
  farmTiles: FarmTile[];
  inventory: InventoryItem[];
  selectedCropId: string;
};
```

Every meaningful action should:

```txt
1. validate action;
2. update state;
3. re-render affected elements;
4. save state.
```

Example actions:

```txt
plant crop
harvest crop
sell item
select crop
water crop
remove pest
buy decoration
place decoration
```

---

## 16. Manual Test Checklist

Run this after each milestone.

### Core Gameplay

```txt
[ ] npm run build succeeds.
[ ] Game opens without console errors.
[ ] Farm grid renders.
[ ] Tile selection works.
[ ] Planting spends correct coins.
[ ] Cannot plant without enough coins.
[ ] Cannot plant over existing crop.
[ ] Crop growth is based on real time.
[ ] Reloading page keeps crop state.
[ ] Ready crop can be harvested.
[ ] Not-ready crop cannot be harvested.
[ ] Harvest adds item to inventory.
[ ] Selling item gives correct coins.
[ ] XP increases after harvest.
[ ] Level updates correctly.
[ ] Selected seed persists or defaults safely.
[ ] Reset save works during development.
```

### Inspiration vs. Copying Checklist

Before considering the game "done", verify:

```txt
[ ] Game is playable and feels cozy (not just a functional clone).
[ ] All game mechanics are original implementations (not copy-pasted logic from Happy Farm).
[ ] All visual assets (sprites, tiles, UI) are original or properly licensed.
[ ] Game UI layout and design is distinct from Happy Farm and other farming games.
[ ] No Happy Farm or other copyrighted names, branding, or protected assets are used.
[ ] Gameplay feel is inspired by the Orkut era but has its own personality.
[ ] Personal touches and wife's preferences are reflected in the design.
```

---

## 17. Code Agent Instructions

When implementing this project, follow these rules:

1. Implement incrementally.
2. Do not generate the entire game in one response.
3. Keep each change focused.
4. Prefer simple readable code over complex abstractions.
5. Do not add backend before the local MVP is complete.
6. Do not add React unless Phaser UI becomes too limiting.
7. Do not use copyrighted assets.
8. Use placeholder graphics until the mechanics are working.
9. Keep TypeScript types explicit.
10. After each step, provide:

    * files changed;
    * summary of changes;
    * manual test instructions;
    * known limitations.

Before major changes, explain the implementation plan.

After changes, ensure:

```bash
npm run build
```

works.

---

## 18. Initial Tasks for the Code Agent

### Task 1 — Create the Phaser Base

```txt
Create the initial Vite + TypeScript + Phaser game structure.

Requirements:
- Add Phaser config.
- Add BootScene.
- Add FarmScene.
- Render a simple background.
- Use the folder structure from PROJECT_PLAN.md.
- Keep code minimal.
- Do not add crop logic yet.
- Ensure npm run build succeeds.
```

### Task 2 — Setup Docker Compose Backend (Optional)

```txt
Deploy scalable backend infrastructure locally.

Requirements:
- Create docker-compose.yml with PostgreSQL, Redis, RabbitMQ, nginx
- Create backend/ folder with Node.js + Express skeleton
- Create database schema (users, farms, inventory tables)
- Create .env file with credentials
- Test all services: docker-compose up -d
- Verify health checks and API endpoint http://localhost:3001
- Document how to access services (PostgreSQL, Redis, RabbitMQ admin)
- Include docker-compose down cleanup
- Update frontend to call API at http://localhost:3001 (or via nginx proxy)

Optional: Skip this if you prefer to build the frontend first with localStorage only.
```

### Task 2.5 — Setup Internationalization (i18n)

```txt
Implement multilingual support for English and Portuguese (Brazil).

Requirements:
- Install i18next, react-i18next, i18next-http-loader
- Create i18n config file with language detection
- Create languages table in PostgreSQL (English, Portuguese)
- Create translation_keys and translations tables
- Create /api/v1/translations/:lang/:namespace endpoint
- Seed initial translations for all UI strings and game text
- Add language selector dropdown to UI
- Save language preference to localStorage
- Test language switching: UI updates correctly
- Missing translations fallback to English
- Ensure npm run build succeeds

Optional: Skip for MVP, add English-only first, implement i18n when ready.
```

### Task 3 — Add Clickable Farm Grid

```txt
Implement a 6x4 clickable farm grid.

Requirements:
- Create FarmTile type.
- Render 24 soil tiles.
- Each tile must be clickable.
- Selected tile must have a visible highlight.
- Store tile data in memory.
- Do not implement saving yet.
- Ensure npm run build succeeds.
```

### Task 4 — Add Save System

```txt
Implement local save/load.

Requirements:
- Create SaveSystem.
- Use localStorage.
- Create default save if no save exists.
- Save farm tile state.
- Add a temporary reset-save button or keyboard shortcut for development.
- Reloading the browser should preserve farm state.
- Ensure npm run build succeeds.
```

### Task 5 — Add Crop Definitions and Planting

```txt
Implement planting.

Requirements:
- Create CropDefinition type.
- Create crops.ts with at least strawberry, corn, and tomato.
- Player starts with 100 coins.
- Strawberry is selected by default.
- Clicking an empty tile plants the selected crop.
- Planting spends seedPrice.
- Cannot plant if player lacks coins.
- Cannot plant on occupied tile.
- Save after planting.
- Ensure npm run build succeeds.
```

### Task 6 — Add Real-Time Growth

```txt
Implement crop growth stages.

Requirements:
- Growth must be calculated from plantedAt and current time.
- Do not use setTimeout for crop completion.
- Add getCropStage function.
- Add isCropReady function.
- Visually distinguish crop stages.
- Reloading page must show correct crop stage.
- Use short grow times during development.
- Ensure npm run build succeeds.
```

### Task 7 — Add Harvesting and Inventory

```txt
Implement harvesting.

Requirements:
- Clicking a ready crop harvests it.
- Harvested crop is added to inventory.
- Tile becomes empty after harvest.
- Player gains crop XP.
- Inventory is persisted in localStorage.
- Not-ready crops cannot be harvested.
- Ensure npm run build succeeds.
```

### Task 8 — Add Selling

```txt
Implement inventory selling.

Requirements:
- Add simple inventory UI.
- Show harvested item quantities.
- Allow selling one item.
- Allow selling all items.
- Selling adds coins based on crop sellPrice.
- Inventory updates and persists.
- Ensure npm run build succeeds.
```

### Task 9 — Add Leveling

```txt
Implement XP and leveling system.

Requirements:
- Define level thresholds.
- Calculate level from cumulative XP.
- Show level and XP in HUD.
- Crops have unlockLevel requirement.
- Shop only shows crops player can afford and has unlocked.
- Ensure npm run build succeeds.
```

### Task 10 — Add Shop and Seed Selection

```txt
Implement shop.

Requirements:
- Add shop UI.
- Show available crops.
- Show seed price, sell price, grow time, and XP.
- Allow selecting crop seed.
- Selected crop should appear in HUD.
- Locked crops should not be selectable.
- Ensure npm run build succeeds.
```

---

## 19. Suggested Commit Order

```txt
01-setup-vite-phaser
02-setup-docker-compose-backend
02-5-setup-i18n
03-add-farm-scene
04-add-clickable-grid
05-add-save-system
06-add-crop-definitions
07-add-planting
08-add-real-time-growth
09-add-harvesting
10-add-inventory
11-add-selling
12-add-leveling
13-add-shop
14-add-watering
15-add-pests
16-add-decorations
17-add-animals
18-add-backend-sync
19-add-user-accounts
20-add-friend-visits
```

---

## 20. Definition of MVP Done

The MVP is complete when:

```txt
The player can open the game in a browser.
The farm grid appears.
The player has coins, XP, and level.
The player can plant at least one crop.
The crop grows based on real time.
The player can close and reopen the game without losing progress.
The player can harvest ready crops.
Harvested crops go to inventory.
The player can sell inventory items.
Coins and XP update correctly.
The project builds successfully.
```

Do not proceed to animals, decorations, or multiplayer until the MVP is complete.

---

## 21. Creative Direction & Personal Touches

This game is for your wife. Make it personal.

### Design Decisions

As you build, make choices that:

* **Feel cozy, not hectic** — no timers, no pressure, no limited-time offers that create anxiety.
* **Reward discovery** — unlocking new crops, decorations, or animals should feel fun, not grindy.
* **Reflect her preferences** — choose crop names, decorations, or UI colors that she likes.
* **Avoid copying Happy Farm visually** — if you're unsure about a visual choice, ask: "Is this inspired by the emotional feeling, or am I copying the exact look?"

### Customization Examples

Before final release, consider:

* **Crop names** — Does she prefer realistic crop names or whimsical ones? ("Strawberry" vs. "Berry Bloom")
* **Currency names** — "Coins," "Seeds," "Hearts," "Stars"?
* **Decoration themes** — What aesthetic appeals to her? Cottage core, fantasy, minimalist?
* **Color palette** — Warm earth tones? Bright pastels? Cool greens and blues?
* **Characters** — Does she want a character avatar or just the farm?

### Original Asset Path

When you're ready to replace placeholders:

1. Commission a pixel artist familiar with farming game aesthetics (not to copy Happy Farm, but to create a unique style).
2. Or use royalty-free asset packs (itch.io has many) and customize them.
3. Or create simple original art that reflects your wife's taste.
4. Document all asset sources in the project (for your own records).

The goal is a game that *feels* like a farming game she'd love, not a reproduction of an existing one.

---

## 22. Future Nice-to-Have Features

After MVP:

```txt
Daily reward
Watering
Pests
Fertilizer
Decorations
Animals
Farm expansion
Background music
Sound effects
Private user accounts
Friend visits
Helping friends
Small crop stealing mechanic
Event log
Seasonal events
Personalized items
Mobile-friendly layout
PWA install support
```

---

## 22. Product Direction

The emotional goal matters more than feature count.

Prioritize:

```txt
cozy feeling
short satisfying sessions
clear progress
simple controls
nostalgic UI
personal touches
```

Avoid:

```txt
overengineering
complex multiplayer too early
too many crops before the core loop works
visual perfection before gameplay
copying existing protected assets
```

The first successful version should make the player feel:

```txt
“I opened my little farm, planted something, came back later, harvested it, earned coins, and want to check it again tomorrow.”
```
