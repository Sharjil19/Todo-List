# Todo List

A small full-stack CRUD app: React and Vite for the UI, FastAPI for the API, and PostgreSQL for storage. Use pgAdmin 4 to administer the local PostgreSQL server.

## Prerequisites

- Python 3.10 or newer
- Node.js and npm
- PostgreSQL server installed and running locally
- pgAdmin 4 (optional, for managing the database)

pgAdmin is a database administration tool; it does not install or run the PostgreSQL server.

## Setup

1. Copy `.env.example` to `.env` and set `DB_PASSWORD` to the password for your PostgreSQL user. Adjust the host, port, user, and database name if needed.

   ```powershell
   Copy-Item .env.example .env
   ```

2. In pgAdmin, connect to your local PostgreSQL server and create a database named by `DB_NAME` (`todo_db` by default). Set its owner to `DB_USER`. You can also create it in the Query Tool while connected to the `postgres` database:

   ```sql
   CREATE DATABASE todo_db;
   ```

3. Create and activate a virtual environment, then install the backend packages:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r backend\requirements.txt
   ```

4. Start the API from the `backend` directory:

   ```powershell
   Set-Location backend
   uvicorn app.main:app --reload
   ```

5. In another terminal, install frontend packages and start Vite:

   ```powershell
   Set-Location frontend
   npm install
   npm run dev
   ```

Open the app at [http://localhost:5173](http://localhost:5173). FastAPI's interactive docs are at [http://localhost:8000/docs](http://localhost:8000/docs).

## Database setup

The database itself must exist before the API starts. The API creates the `todos` table automatically at startup; you do not need to create that table manually. In pgAdmin, refresh `todo_db`, then look under **Schemas** → **public** → **Tables**.

The backend and Vite load the root `.env` file. `.env` is ignored by git; use `.env.example` as the template and do not commit your database password.

## Features

- Create, edit, complete, and delete todos
- Persistent PostgreSQL storage
- Interactive API docs from FastAPI
- Configuration through environment variables in `.env`

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/todos` | List todos |
| `POST` | `/api/todos` | Create a todo |
| `PATCH` | `/api/todos/{todo_id}` | Update a todo |
| `DELETE` | `/api/todos/{todo_id}` | Delete a todo |

