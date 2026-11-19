import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .database import Base, engine, get_db, migrate_legacy_todos
from .schemas import AuthResponse, LoginRequest, RegisterRequest, TodoCreate, TodoRead, TodoUpdate, UserRead


JWT_SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY", "local-development-only-change-this-secret"
)
JWT_ALGORITHM = "HS256"
TOKEN_LIFETIME_HOURS = 24
password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    migrate_legacy_todos(engine)
    yield


app = FastAPI(title="Todo List API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def create_access_token(user_id: int) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=TOKEN_LIFETIME_HOURS)
    return jwt.encode(
        {"sub": str(user_id), "exp": expires_at},
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign in to continue",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
        )
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError):
        raise unauthorized

    user = db.get(models.User, user_id)
    if user is None:
        raise unauthorized
    return user


def make_auth_response(user: models.User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserRead(id=user.id, email=user.email),
    )


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post(
    "/api/auth/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    existing_user = db.scalar(select(models.User).where(models.User.email == email))
    if existing_user is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = models.User(email=email, password_hash=password_hash.hash(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return make_auth_response(user)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    user = db.scalar(select(models.User).where(models.User.email == email))
    if user is None or not password_hash.verify(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return make_auth_response(user)


@app.get("/api/auth/me", response_model=UserRead)
def read_current_user(user: models.User = Depends(get_current_user)):
    return user


@app.get("/api/todos", response_model=list[TodoRead])
def list_todos(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return db.scalars(
        select(models.Todo)
        .where(models.Todo.owner_id == user.id)
        .order_by(models.Todo.id.desc())
    ).all()


@app.post("/api/todos", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create_todo(
    todo: TodoCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    title = todo.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Title cannot be empty")
    item = models.Todo(title=title, owner_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.patch("/api/todos/{todo_id}", response_model=TodoRead)
def update_todo(
    todo_id: int,
    changes: TodoUpdate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = db.scalar(
        select(models.Todo).where(
            models.Todo.id == todo_id, models.Todo.owner_id == user.id
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Todo not found")

    updates = changes.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="Provide at least one field to update")
    if "completed" in updates and updates["completed"] is None:
        raise HTTPException(status_code=422, detail="Completed must be true or false")
    if "title" in updates:
        title = updates["title"]
        if title is None or not title.strip():
            raise HTTPException(status_code=422, detail="Title cannot be empty")
        updates["title"] = title.strip()
    for field, value in updates.items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    item = db.scalar(
        select(models.Todo).where(
            models.Todo.id == todo_id, models.Todo.owner_id == user.id
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
