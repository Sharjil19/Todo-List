import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .database import Base, engine, get_db
from .schemas import TodoCreate, TodoRead, TodoUpdate


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Todo List API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/todos", response_model=list[TodoRead])
def list_todos(db: Session = Depends(get_db)):
    return db.scalars(select(models.Todo).order_by(models.Todo.id.desc())).all()


@app.post("/api/todos", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create_todo(todo: TodoCreate, db: Session = Depends(get_db)):
    item = models.Todo(title=todo.title.strip())
    if not item.title:
        raise HTTPException(status_code=422, detail="Title cannot be empty")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.patch("/api/todos/{todo_id}", response_model=TodoRead)
def update_todo(todo_id: int, changes: TodoUpdate, db: Session = Depends(get_db)):
    item = db.get(models.Todo, todo_id)
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
def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    item = db.get(models.Todo, todo_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
