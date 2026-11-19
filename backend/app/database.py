import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


load_dotenv(Path(__file__).resolve().parents[2] / ".env")

database_url = os.getenv("DATABASE_URL")
if database_url:
    engine_options = {"pool_pre_ping": True}
    if database_url.startswith("sqlite"):
        engine_options["connect_args"] = {"check_same_thread": False}
    engine = create_engine(database_url, **engine_options)
else:
    engine = create_engine(
        URL.create(
            "postgresql+psycopg",
            username=os.getenv("DB_USER", "postgres"),
            password=os.getenv("DB_PASSWORD", "root"),
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            database=os.getenv("DB_NAME", "todo_db"),
        ),
        pool_pre_ping=True,
    )

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def migrate_legacy_todos(db_engine=engine):
    inspector = inspect(db_engine)
    if "todos" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("todos")}
    if "owner_id" not in column_names:
        with db_engine.begin() as connection:
            connection.execute(
                text(
                    "ALTER TABLE todos "
                    "ADD COLUMN owner_id INTEGER REFERENCES users (id)"
                )
            )

    index_names = {index["name"] for index in inspect(db_engine).get_indexes("todos")}
    if "ix_todos_owner_id" not in index_names:
        with db_engine.begin() as connection:
            connection.execute(
                text("CREATE INDEX ix_todos_owner_id ON todos (owner_id)")
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
