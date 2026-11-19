import os

os.environ["DATABASE_URL"] = "sqlite:///./test_todo.db"
os.environ["JWT_SECRET_KEY"] = "test-only-secret-key-with-at-least-32-bytes"

from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import Base, engine, migrate_legacy_todos
from app.main import app


def register(client: TestClient, email: str) -> str:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": "beginner-password"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def test_users_can_only_manage_their_own_todos():
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as client:
        alice_token = register(client, "alice@example.com")
        bob_token = register(client, "bob@example.com")
        alice_headers = {"Authorization": f"Bearer {alice_token}"}
        bob_headers = {"Authorization": f"Bearer {bob_token}"}

        created = client.post(
            "/api/todos",
            headers=alice_headers,
            json={"title": "Private task"},
        )
        assert created.status_code == 201
        todo_id = created.json()["id"]

        assert client.get("/api/todos", headers=bob_headers).json() == []
        assert client.patch(
            f"/api/todos/{todo_id}",
            headers=bob_headers,
            json={"completed": True},
        ).status_code == 404
        assert client.delete(
            f"/api/todos/{todo_id}", headers=bob_headers
        ).status_code == 404

        completed = client.patch(
            f"/api/todos/{todo_id}",
            headers=alice_headers,
            json={"completed": True},
        )
        assert completed.status_code == 200
        assert completed.json()["completed"] is True
        assert client.delete(
            f"/api/todos/{todo_id}", headers=alice_headers
        ).status_code == 204

    Base.metadata.drop_all(bind=engine)


def test_todo_routes_require_authentication():
    with TestClient(app) as client:
        assert client.get("/api/todos").status_code == 401
        assert client.post("/api/todos", json={"title": "No token"}).status_code == 401


def test_login_checks_password_and_duplicate_registration():
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as client:
        registration = client.post(
            "/api/auth/register",
            json={"email": "learner@example.com", "password": "beginner-password"},
        )
        assert registration.status_code == 201
        assert "password" not in registration.json()["user"]

        duplicate = client.post(
            "/api/auth/register",
            json={"email": "learner@example.com", "password": "beginner-password"},
        )
        assert duplicate.status_code == 409

        login = client.post(
            "/api/auth/login",
            json={"email": "learner@example.com", "password": "beginner-password"},
        )
        assert login.status_code == 200
        assert login.json()["access_token"]

        invalid_login = client.post(
            "/api/auth/login",
            json={"email": "learner@example.com", "password": "wrong-password"},
        )
        assert invalid_login.status_code == 401

    Base.metadata.drop_all(bind=engine)


def test_legacy_todos_are_preserved_without_an_owner():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.tables["users"].create(bind=engine)
    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE todos ("
                "id INTEGER PRIMARY KEY, "
                "title VARCHAR(200) NOT NULL, "
                "completed BOOLEAN NOT NULL DEFAULT 0, "
                "created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)"
            )
        )
        connection.execute(
            text("INSERT INTO todos (title, completed) VALUES ('Old task', 0)")
        )

    Base.metadata.create_all(bind=engine)
    migrate_legacy_todos(engine)

    with engine.connect() as connection:
        legacy_todo = connection.execute(
            text("SELECT title, owner_id FROM todos")
        ).one()
    assert legacy_todo.title == "Old task"
    assert legacy_todo.owner_id is None

    Base.metadata.drop_all(bind=engine)
