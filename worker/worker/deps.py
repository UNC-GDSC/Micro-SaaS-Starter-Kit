"""
deps.py — FastAPI dependency for Bearer token authentication.

All protected routes must declare: `_ = Depends(verify_bearer)`
"""
import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from worker.config import settings

logger = structlog.get_logger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


async def verify_bearer(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> None:
    """
    Validate the Authorization: Bearer <token> header.
    Raises HTTP 401 if the header is missing or the token does not match
    settings.worker_secret.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        logger.warning("auth.missing_bearer_header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if credentials.credentials != settings.worker_secret:
        logger.warning("auth.invalid_token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
