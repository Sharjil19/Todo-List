# Learning Guide: React + FastAPI + PostgreSQL

This guide follows the request from the browser to the database. Start the app using the instructions in the [project README](../README.md), then keep the frontend, backend, and database running while you explore.

## 1. The three parts

| Part | Job | Where to look |
| --- | --- | --- |
| React + Vite | Draws the pages, stores temporary UI state, and sends HTTP requests | `frontend/src/App.jsx` |
| FastAPI | Validates requests, checks sign-in, applies the ownership rules, and returns JSON | `backend/app/main.py` |
| PostgreSQL | Persists accounts and tasks after the app closes | `backend/app/models.py` |

The browser never connects directly to PostgreSQL. It talks to the API; the API talks to the database.

## 2. Start at the database models

In `backend/app/models.py`, the `User` class maps to the `users` table. It has a unique email and a password hash. The `Todo` class maps to `todos`; each row has a title, completion flag, and `owner_id`.

`owner_id` is a foreign key to `users.id`. This relationship is the database representation of “a user's tasks.” Passwords are hashed before insertion, so the database does not store the original password.

In `backend/app/database.py`, SQLAlchemy creates the PostgreSQL engine and a session factory. A session is a short-lived connection used by one API request. `get_db` yields a session and closes it when the request is over.

## 3. Follow registration and sign-in

1. The form in `frontend/src/App.jsx` sends email and password as JSON.
2. `POST /api/auth/register` or `POST /api/auth/login` in `backend/app/main.py` checks the account.
3. On registration, `pwdlib` hashes the password before the user row is saved. On login, the submitted password is verified against that hash.
4. The API signs a short-lived JWT. The browser stores it and sends it as a bearer token in later requests.
5. `GET /api/auth/me` verifies the token and returns the account for the page header.

In the FastAPI docs at `/docs`, try registering with a new email, then use the **Authorize** button with the returned access token to call protected endpoints.

## 4. Follow a task request

For example, adding a task works like this:

1. React handles the form submit and calls `POST /api/todos` with the title.
2. The browser adds `Authorization: Bearer <token>` to the request.
3. `get_current_user` decodes the token and loads the matching user.
4. `create_todo` builds a `Todo` with `owner_id=user.id`, then SQLAlchemy commits the row.
5. FastAPI serializes the result through `TodoRead`, and React refreshes its task list.

The same user dependency protects listing, editing, completing, and deleting tasks.

## 5. Understand data ownership

Look at the task queries in `backend/app/main.py`:

- Listing includes `Todo.owner_id == user.id`.
- Editing and deleting match **both** the task ID and the signed-in user's ID.
- Creating sets the task owner from the verified user, never from a browser-supplied owner ID.

That last point is important: hiding another user's task in React is not access control. The API checks ownership on every request.

## 6. Explore the React state

In `frontend/src/App.jsx`, the `useState` values hold the token, signed-in user, tasks, form fields, and error/loading state. `useEffect` restores the session when the page loads. Event handlers submit forms and update tasks.

The `request` helper centralizes `fetch`, JSON headers, bearer tokens, and API error messages. Try following one handler from its button/form to the `request` call, then find the matching FastAPI route.

## 7. Database tables at a glance

```text
users
  id (primary key)
  email (unique)
  password_hash

todos
  id (primary key)
  title
  completed
  created_at
  owner_id (foreign key -> users.id)
```

FastAPI creates these tables at startup for this starter project. It includes a small migration for the earlier version's `todos` table: the API adds the new nullable `owner_id` column and preserves old rows. Since those tasks have no known owner, they stay hidden from account task lists. For a real app with ongoing schema changes, learn migrations (for example Alembic) rather than relying on `create_all`.

## 8. Try it yourself

1. Register two accounts. Create tasks under each, then sign out and confirm each account sees only its own list.
2. Open `/docs` and try creating a task without authorizing. Notice the `401` response.
3. Try editing a task ID while signed in as the other account. The API should return `404`.
4. Add a task filter in React without changing the backend.
5. Add a due date by updating the Pydantic schema, SQLAlchemy model, UI form, and database schema. For a non-empty existing database, use a migration.

## 9. Common setup issues

- **Cannot connect to PostgreSQL:** confirm the PostgreSQL server is running, the database exists, and the values in `.env` are correct.
- **Database authentication failed:** check `DB_USER` and `DB_PASSWORD`; the database user needs permission to connect and create tables.
- **Browser reports a CORS error:** make sure `CORS_ORIGINS` includes the exact frontend origin, usually `http://localhost:5173`.
- **API returns `401`:** sign in again; the token may be missing or expired.
- **API returns `404` for a task:** the task may not exist or may belong to another account.
- **Frontend cannot reach the API:** check that FastAPI is running at the `VITE_API_URL` in `.env` (default `http://localhost:8000`).

## 10. Security and scope

This is a local learning project, not a production authentication template. Use a private random JWT key, keep `.env` out of version control, and do not deploy the local-development key. This example keeps the token in browser `localStorage` for clarity; production applications commonly use secure `HttpOnly` cookies and require additional protections.
