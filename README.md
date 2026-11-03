# Quiz & Q&A API with AI Question Generation

A REST API for creating and answering quiz questions, built with Node.js, Express and MySQL. Users can write questions or generate them with Google Gemini, answer them, and compete on a leaderboard. Includes a simple frontend served from `/public`.

## Features
- **Auth:** register and log in with JWT, passwords hashed with bcrypt
- **Questions:** full CRUD with image uploads (Multer), keywords and difficulty levels; only the owner can edit or delete
- **AI generation:** create a question on any topic with Google Gemini (`gemini-2.5-flash`)
- **Attempts & leaderboard:** answers are checked and scored per user
- **Likes & bookmarks:** users can like and save questions
- **Validation & errors:** Zod request validation and a central error handler
- **Logging:** structured request logging with Pino
- **Tests:** integration tests with Vitest and Supertest, with coverage reports
- **Docker:** app and MySQL run together with Docker Compose

## Tech stack
Node.js · Express 5 · Prisma · MySQL · JWT · bcrypt · Zod · Multer · Pino · Google Gemini · Vitest · Supertest · Docker

## API overview
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Log in and get a JWT |
| GET | `/api/questions` | List questions |
| GET | `/api/questions/:id` | Get one question |
| POST | `/api/questions` | Create a question (with optional image) |
| PUT | `/api/questions/:id` | Update a question (owner only) |
| DELETE | `/api/questions/:id` | Delete a question (owner only) |
| POST | `/api/questions/ai-generate` | Generate a question with AI from a topic |
| POST | `/api/questions/:id/attempt` | Submit an answer |
| POST/DELETE | `/api/questions/:id/like` | Like or unlike |
| POST/DELETE | `/api/questions/:id/bookmark` | Bookmark or remove |
| GET | `/api/questions/me/bookmarks` | My bookmarks |
| GET | `/api/leaderboard` | Leaderboard |

## Run locally
```bash
git clone https://github.com/Hillary-Robert/cms-project.git
cd cms-project
npm install
cp .env.example .env
```

Fill in `.env`:
```
DATABASE_URL="mysql://user:password@localhost:3306/cms"
JWT_SECRET="your-secret"
GEMINI_API_KEY="your-gemini-api-key"
PORT=3000
```

Set up the database (with optional sample data) and start the server:
```bash
npm run db:migrate
npm run db:seed
npm run dev
```

The app runs at http://localhost:3000.

## Run with Docker
In `.env`, point the database URL at the Compose MySQL service:
```
DATABASE_URL="mysql://cms_user:cms_password@db:3306/cms"
```
Then:
```bash
docker compose up --build
```
Migrations run automatically when the container starts.

## Run tests
Tests use a separate database configured in `.env.test`:
```bash
npm run test:setup
npm test
npm run test:coverage
```
