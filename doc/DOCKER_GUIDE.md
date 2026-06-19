# Docker Compose Setup Guide

This document explains how to use Docker Compose to run Farmy locally with all services.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Your Computer                              │
├──────────────────────┬──────────────────────┬──────────────────────┤
│                      │                      │                      │
│   Frontend           │   Backend            │   Services           │
│   (Vite/Phaser)      │   (Node.js)          │                      │
│   Port 5173          │   Port 3001          │   PostgreSQL:5432    │
│                      │                      │   Redis:6379         │
│   http://localhost   │   http://localhost   │   RabbitMQ:5672      │
│   :5173              │   :3001              │   nginx:80           │
└──────────────────────┴──────────────────────┴──────────────────────┘
         ↓                      ↓
    Browser Game          API Routes
    - Plant crops         - Get farms
    - Harvest            - Save state
    - View inventory     - User accounts
    - Chat (later)       - Social features
```

## Quick Reference

### Start Everything

```bash
docker-compose up -d
```

All services start in the background. This includes:
- PostgreSQL (database)
- Redis (cache)
- RabbitMQ (message queue)
- Node.js API
- nginx (proxy)

### Check Service Status

```bash
docker-compose ps
```

You should see all services with status "Up".

### View Logs

```bash
docker-compose logs -f api
```

This shows live logs from the API. Replace `api` with:
- `postgres` — Database logs
- `redis` — Cache logs
- `rabbitmq` — Message queue logs
- `nginx` — Web proxy logs

### Stop All Services

```bash
docker-compose down
```

All services stop gracefully.

### Restart a Service

```bash
docker-compose restart api
```

Useful for reloading the API after code changes.

## Accessing Services

### Browser

Open http://localhost:5173 in your browser to see the game.

### API Health Check

```bash
curl http://localhost:3001/health
```

Should return: `{"status":"ok","message":"Server is running"}`

### Database

```bash
docker-compose exec postgres psql -U farmy_user -d farmy_db
```

You're now in the PostgreSQL terminal. Common commands:

```sql
\dt                    -- List all tables
SELECT * FROM farms;   -- List farms
\q                     -- Quit
```

### Redis

```bash
docker-compose exec redis redis-cli
```

You're in the Redis terminal. Common commands:

```
PING                   -- Check connection
KEYS *                 -- List all keys
GET keyname            -- Get value
DEL keyname            -- Delete key
FLUSHDB                -- Clear all data
EXIT                   -- Quit
```

### RabbitMQ Admin

Open http://localhost:15672 in your browser.

Login with:
- Username: `guest`
- Password: `guest`

Here you can:
- View message queues
- Monitor connections
- Check message rates

## File Locations in Docker

When you run `docker exec` or `docker-compose exec`, paths are relative to the container:

```
Container filesystem:

/app                   -- Backend code
├── src/
│   └── index.ts
├── package.json
└── tsconfig.json

/var/lib/postgresql    -- PostgreSQL data (persists)
/var/lib/redis         -- Redis data (persists)
/var/lib/rabbitmq      -- RabbitMQ data (persists)
```

## Volumes

Docker Compose uses volumes to persist data across restarts:

```yaml
volumes:
  postgres_data:      -- Database files
  redis_data:         -- Cache files
  rabbitmq_data:      -- Message queue files
```

If you want to start fresh:

```bash
docker-compose down -v
```

The `-v` flag removes all volumes.

## Environment Variables

Services read from `.env` file. Copy the example:

```bash
cp .env.example .env
```

Edit `.env` to customize:

```
DATABASE_USER=farmy_user
DATABASE_PASSWORD=farmy_password
PORT=3001
NODE_ENV=development
```

Changes take effect on next `docker-compose up`.

## Common Workflows

### Development: Make Code Changes

1. Edit code in `backend/src/`
2. API automatically reloads with `ts-node`
3. Check logs: `docker-compose logs -f api`
4. Test: `curl http://localhost:3001/health`

### Development: Run Database Migration

```bash
docker-compose exec api npm run migrate
```

### Development: Seed Database

```bash
docker-compose exec api npm run seed
```

### Testing: Check API Response

```bash
curl -H "Content-Type: application/json" \
  http://localhost:3001/api/v1/farms
```

### Testing: Check Database

```bash
docker-compose exec postgres psql -U farmy_user -d farmy_db \
  -c "SELECT * FROM farms LIMIT 5;"
```

### Debugging: Live API Logs

```bash
docker-compose logs -f api
```

Watch for errors as you interact with the game.

### Debugging: Clear Redis Cache

```bash
docker-compose exec redis redis-cli FLUSHDB
```

Useful if stale data is cached.

### Cleanup: Remove Old Containers

```bash
docker-compose down
docker system prune -a
```

Warning: This removes unused images/containers.

## Troubleshooting

### "Port 5173 already in use"

Change port in `docker-compose.yml`:

```yaml
services:
  frontend:
    ports:
      - "5174:5173"  # Use 5174 instead
```

Then access http://localhost:5174

### "postgres connection refused"

Wait for PostgreSQL to start:

```bash
docker-compose logs postgres
```

Wait for: `database system is ready to accept connections`

### "redis connection refused"

Redis might not be running:

```bash
docker-compose ps redis
docker-compose restart redis
```

### "API can't connect to database"

Check DATABASE_URL in .env:

```bash
cat .env | grep DATABASE_URL
```

Should be: `postgresql://farmy_user:farmy_password@postgres:5432/farmy_db`

(Note: `postgres` is the service name, not `localhost`)

### "npm modules not installed"

Rebuild the container:

```bash
docker-compose up -d --build api
```

## Performance Tips

### Reduce Memory Usage

Stop unused services:

```bash
docker-compose down
docker-compose up -d api postgres redis
```

### Speed Up Development

Disable RabbitMQ if you don't need it:

```bash
docker-compose up -d api postgres redis nginx
```

(Remove `rabbitmq` from the command)

### Monitor Resource Usage

```bash
docker stats
```

Shows CPU, memory, and I/O for each container.

## Next Steps

1. ✓ Services are running
2. ✓ Frontend loads at http://localhost:5173
3. ✓ API responds at http://localhost:3001/health
4. → Start implementing game logic (see 001-project.md)

Happy farming! 🌾
