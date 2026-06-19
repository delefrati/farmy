# Farmy — A Private Nostalgic Farming Game

A browser-based 2D farming game inspired by classic Orkut-era farming games, built with **Vite + Phaser (frontend)** and **Node.js + Docker Compose (backend)**.

## Project Structure

```
farmy/
├── frontend/                 # Vite + Phaser 2D game
│   ├── src/
│   │   └── game/
│   │   └── ui/
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Node.js + Express API
│   ├── src/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── docker-compose.yml        # Orchestrate all services
├── nginx.conf.example        # Reverse proxy config
├── .env.example              # Environment variables template
└── doc/
    └── 001-project.md        # Full project plan
```

## Quick Start

### Option 1: Local Development (Full Stack with Docker)

Prerequisites: Docker & Docker Compose

1. Clone and navigate to project:

```bash
cd farmy
```

2. Start all services:

```bash
docker-compose up -d
```

3. Check services are healthy:

```bash
docker-compose ps
```

4. Access the game:

- **Frontend**: http://localhost:5173 (Vite dev server)
- **API**: http://localhost:3001
- **Database**: localhost:5432
- **Redis**: localhost:6379
- **RabbitMQ Admin**: http://localhost:15672 (guest/guest)

### Option 2: Frontend Only (No Backend)

Skip Docker and use localStorage:

```bash
cd frontend
npm install
npm run dev
```

The game works offline with `localStorage` only. Backend integration comes in Phase 3+.

## Services

### PostgreSQL (Port 5432)

Stores:
- User accounts
- Farm state
- Inventory
- Social graph (later)

Access:

```bash
docker-compose exec postgres psql -U farmy_user -d farmy_db
```

### Redis (Port 6379)

Caching, session management, and real-time updates.

Access:

```bash
docker-compose exec redis redis-cli
```

### RabbitMQ (Port 5672, Admin 15672)

Message queue for async tasks:
- Crop growth notifications
- Harvest reminders
- Friend requests (later)

Admin panel: http://localhost:15672 (guest/guest)

### Node.js API (Port 3001)

Express server with health checks and initial CRUD endpoints.

Health check:

```bash
curl http://localhost:3001/health
```

### nginx (Port 80)

Reverse proxy that routes `/api/` requests to the Node.js backend.

## Development

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

Server runs at http://localhost:5173

### Backend Development

With Docker:

```bash
docker-compose up -d api
docker-compose logs -f api
```

Or locally:

```bash
cd backend
npm install
npm run dev
```

### Database Migrations

```bash
npm run migrate
```

### Seed Sample Data

```bash
npm run seed
```

## Building

### Build Frontend

```bash
cd frontend
npm run build
```

Output: `frontend/dist/`

### Build Backend

```bash
cd backend
npm run build
```

Output: `backend/dist/`

## Environment Variables

Copy and customize:

```bash
cp .env.example .env
```

Key variables:

- `DATABASE_URL` — PostgreSQL connection
- `REDIS_URL` — Redis connection
- `RABBITMQ_URL` — RabbitMQ connection
- `PORT` — API server port (default: 3001)
- `CORS_ORIGIN` — Frontend URL for CORS

## Docker Compose Commands

Start services:

```bash
docker-compose up -d
```

Stop services:

```bash
docker-compose down
```

View logs:

```bash
docker-compose logs -f [service_name]
```

Example: `docker-compose logs -f api`

Rebuild service:

```bash
docker-compose up -d --build api
```

Restart service:

```bash
docker-compose restart api
```

## Project Phases

See [doc/001-project.md](doc/001-project.md) for full details.

### Phase 1 — Project Base ✓

Frontend project setup with Vite + Phaser.

### Phase 2 — Docker Compose Backend (Optional)

Deploy scalable infrastructure locally.

### Phase 3 — Farm Grid

Clickable 6x4 farm grid.

### Phase 4 — Save System

localStorage persistence.

### Phase 5 — Planting

Plant crops and spend coins.

### Phase 6 — Real-Time Growth

Crops grow based on elapsed time.

### Phase 7 — Harvesting

Harvest ready crops and collect items.

### Phase 8 — Inventory & Selling

Sell crops for coins and XP.

### Phase 9 — Leveling

Unlock new crops by reaching level milestones.

### Phase 10 — Shop

Select and purchase seeds.

### Phase 11 — Watering & Pests

Add care mechanics.

### Phase 12 — Decorations

Personalize the farm.

### Phase 13 — Animals

Add chickens, cows, pigs with product collection.

### Phase 14 — Private Social Features

User accounts, friend visits, helping friends.

## MVP Definition

Core gameplay loop works locally with localStorage:

- ✓ Open farm
- ✓ Plant crops (spend coins)
- ✓ Crops grow in real time
- ✓ Harvest ready crops
- ✓ Sell crops for coins & XP
- ✓ Unlock new crops by leveling
- ✓ Game state persists

## Architecture

### Client → Server

```
Frontend (Phaser + localStorage)
    ↓ (HTTP API calls)
nginx (reverse proxy)
    ↓
Node.js API (Express)
    ↓
PostgreSQL (persistent data)
Redis (cache & sessions)
RabbitMQ (async jobs)
```

### Local-First Strategy

1. Game starts with localStorage only (no backend required).
2. Client syncs state to backend when available.
3. Server is authoritative for user accounts and transactions.
4. Gracefully handles offline mode.

## Development Rules

1. **Implement incrementally** — One phase at a time.
2. **Keep it simple** — Avoid premature optimization.
3. **No copyrighted assets** — Create original graphics.
4. **Test manually** — Run checklist after each phase.
5. **Commit frequently** — One feature per commit.

## Testing

### Manual Testing

See "Manual Test Checklist" in [doc/001-project.md](doc/001-project.md).

### Automated Testing

```bash
# Frontend
cd frontend && npm test

# Backend
cd backend && npm test
```

## Troubleshooting

### Services not starting

Check Docker daemon is running:

```bash
docker ps
```

### Port conflicts

Change ports in `docker-compose.yml` if needed.

### Database connection error

Verify PostgreSQL is healthy:

```bash
docker-compose logs postgres
docker-compose exec postgres psql -U farmy_user -c "SELECT 1"
```

### Frontend can't reach API

Check CORS settings and API URL in frontend code.

## License

MIT

## Credit

Inspired by classic Orkut-era farming games like Happy Farm.

This is an original game with its own visual identity and mechanics.
# farmy
