# Farmy Backend API

Scalable Node.js + Express backend for the Farmy farming game.

## Quick Start

### Prerequisites

- Docker & Docker Compose (recommended)
- Node.js 18+ (if running locally)

### Local Development (with Docker)

1. From project root, start all services:

```bash
docker-compose up -d
```

2. Check all services are healthy:

```bash
docker-compose ps
```

3. Verify API is responding:

```bash
curl http://localhost:53001/health
curl http://localhost:53001/api/health/db
curl http://localhost:53001/api/health/redis
```

### Local Development (without Docker)

1. Install dependencies:

```bash
npm install
```

2. Create `.env` file:

```bash
cp ../../.env.example .env
```

3. Update `.env` with local database credentials.

4. Start the server:

```bash
npm run dev
```

## Environment Variables

See `../../.env.example` for all available variables.

Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `RABBITMQ_URL`: RabbitMQ connection string
- `PORT`: API server port (default: 53001 for local .env)
- `NODE_ENV`: Environment (development/production)
- `JWT_SECRET`: Secret key for JWT tokens
- `CORS_ORIGIN`: Allowed origins for CORS

## Database

### Create Database

From Docker:

```bash
docker-compose exec postgres psql -U farmy_user -d farmy_db
```

### Run Migrations

```bash
npm run migrate
```

### Seed Data

```bash
npm run seed
```

## API Endpoints

### Health Checks

- `GET /health` — Server status
- `GET /api/health/db` — Database connection
- `GET /api/health/redis` — Redis connection

### Farms

- `GET /api/v1/farms` — List farms
- `GET /api/v1/farms/:id` — Get farm by ID
- `POST /api/v1/farms` — Create farm
- `PUT /api/v1/farms/:id` — Update farm
- `DELETE /api/v1/farms/:id` — Delete farm

### (Add more endpoints as you implement features)

## Services

### PostgreSQL

- Host: `postgres` (or `localhost` if running locally)
- Port: `5432`
- User: `farmy_user`
- Password: `farmy_password`
- Database: `farmy_db`

### Redis

- Host: `redis` (or `localhost`)
- Port: `6379`

Access Redis CLI:

```bash
docker-compose exec redis redis-cli
```

### RabbitMQ

- Host: `rabbitmq` (or `localhost`)
- Port: `55672` (AMQP host port)
- Admin UI: `http://localhost:55673`
- Default credentials: `guest` / `guest`

## Scripts

- `npm run dev` — Start development server
- `npm run build` — Build TypeScript to JavaScript
- `npm start` — Run compiled server
- `npm test` — Run tests
- `npm run migrate` — Run database migrations
- `npm run seed` — Seed database with sample data

## Development Workflow

1. Edit code in `src/`
2. TypeScript is automatically compiled with `ts-node` in dev mode
3. Changes are hot-reloaded (or restart with `docker-compose restart api`)
4. Test with `curl` or Postman

## Testing

Run tests:

```bash
npm test
```

## Deployment

### Build Docker Image

```bash
docker build -t farmy-api:latest .
```

### Push to Registry

```bash
docker tag farmy-api:latest yourusername/farmy-api:latest
docker push yourusername/farmy-api:latest
```

### Production Deployment

Update `docker-compose.yml` to use the pushed image and set `NODE_ENV=production`.

## Troubleshooting

### API can't connect to database

- Check PostgreSQL is running: `docker-compose logs postgres`
- Verify `DATABASE_URL` in `.env`
- Ensure database exists: `docker-compose exec postgres psql -U farmy_user -l`

### Redis connection errors

- Check Redis is running: `docker-compose logs redis`
- Verify `REDIS_URL` in `.env`

### Port already in use

- Change port in `docker-compose.yml` and `.env`
- Or kill the process: `lsof -i :3001` then `kill <PID>`

## License

MIT
