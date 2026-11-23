import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from breathewise.core.errors import ServiceError
from breathewise.core.time import utc
from breathewise.db.models import SessionToken, User
from breathewise.db.session import get_db
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

bearer = HTTPBearer(auto_error=False)


def provision_session(db: Session, user_id: str | None = None):
    if user_id is None:
        user_id = str(uuid4())
        db.add(User(id=user_id, preferences={}))
        db.flush()
    elif db.get(User, user_id) is None:
        raise ValueError("Unknown user")
    token = secrets.token_urlsafe(32)
    db.add(
        SessionToken(
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            user_id=user_id,
            expires_at=datetime.now(UTC) + timedelta(days=7),
        )
    )
    db.flush()
    return user_id, token


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise ServiceError(401, "AUTH_REQUIRED", "A provisioned bearer session is required")
    digest = hashlib.sha256(credentials.credentials.encode()).hexdigest()
    session = db.get(SessionToken, digest)
    if session is None or utc(session.expires_at) <= datetime.now(UTC):
        raise ServiceError(401, "SESSION_INVALID", "Session is invalid or expired")
    user = db.get(User, session.user_id)
    if user is None:
        raise ServiceError(401, "SESSION_INVALID", "Session user no longer exists")
    return user
