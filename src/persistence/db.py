"""SQLite engine/session setup.

SQLite is the demo-scale data layer per docs/architecture-review.md Section 3.
Models are plain SQLAlchemy so swapping in PostgreSQL later (Section 11,
"Simulation-to-Production Map") is a connection-string change.
"""

from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from src.persistence.models import Base


def make_engine(db_path: Path):
    return create_engine(f"sqlite:///{db_path}", future=True)


def init_db(db_path: Path):
    engine = make_engine(db_path)
    Base.metadata.create_all(engine)
    return engine


@contextmanager
def session_scope(engine) -> Session:
    SessionLocal = sessionmaker(bind=engine, future=True)
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
