# Daymark To-Do

A beginner-friendly full-stack CRUD app built with React, FastAPI, and PostgreSQL. Users can register, sign in, and manage only their own tasks.

## What you need

- Python 3.10 or newer
- Node.js 20.19+ and npm
- PostgreSQL running locally
- pgAdmin 4 (optional; useful for viewing the database)

## Run it locally (Windows PowerShell)

### 1. Configure the database

Copy the example environment file and set `DB_PASSWORD` to your PostgreSQL password. Set `JWT_SECRET_KEY` to a long, random value for your local environment.

```powershell
Copy-Item .env.example .env
```

In pgAdmin, create a database named `todo_db` (or use the name in `.env`) and assign it to the configured PostgreSQL user. The API creates the tables when it starts for the first time.

### 2. Start the FastAPI backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Set-Location backend
uvicorn app.main:app --reload
```

The API is at <http://localhost:8000>. Explore and try the endpoints at <http://localhost:8000/docs>.

### 3. Start the React frontend

Open another PowerShell terminal in the project folder:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open <http://localhost:5173>, register an account, and add your first task.

## Run the backend tests

From the project folder:

```powershell
python -m pip install -r backend\requirements-dev.txt
Set-Location backend
python -m pytest
```

The tests use an isolated SQLite database, so they do not need a running PostgreSQL server.

## How it works

1. React sends a registration or login request to FastAPI.
2. FastAPI stores a password hash (not the original password) and returns a signed access token.
3. React sends that token with each task request.
4. FastAPI verifies the token, identifies the signed-in user, and filters task queries by that user's ID.
5. SQLAlchemy reads and writes the rows in PostgreSQL.

For a step-by-step explanation of the files, request flow, database tables, and practice ideas, see [the learning guide](docs/LEARNING_GUIDE.md).

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account and sign in |
| `POST` | `/api/auth/login` | Sign in |
| `GET` | `/api/auth/me` | Get the signed-in account |
| `GET` | `/api/todos` | List the signed-in user's tasks |
| `POST` | `/api/todos` | Create a task |
| `PATCH` | `/api/todos/{todo_id}` | Edit or complete a task |
| `DELETE` | `/api/todos/{todo_id}` | Delete a task |

Task endpoints require an `Authorization: Bearer <token>` header. Requests for another user's task return `404`.

## Notes

- The API creates new tables with SQLAlchemy `create_all`. On startup it also adds `owner_id` to a legacy `todos` table if needed. Old tasks remain in the database with no owner and are hidden from user lists; they are not automatically assigned to any account.
- The default JWT key is only a local-development fallback. Set a private random `JWT_SECRET_KEY` in `.env`; never use the fallback or commit `.env` for a deployed app.
- The frontend stores its access token in `localStorage` to keep this small example easy to follow. Production apps should consider secure, `HttpOnly` cookies and add additional protections.
- pgAdmin is an optional tool for managing PostgreSQL; it does not install or run the PostgreSQL server itself.
