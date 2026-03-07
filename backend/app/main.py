from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import Base, engine, get_db
from .models import User
from .schemas import AuthResponse, Token, UserCreate, UserLogin, UserOut
from .security import create_access_token, decode_token, hash_password, verify_password

settings = get_settings()

app = FastAPI(title=settings.app_name)
security = HTTPBearer(auto_error=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(select(1))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database not ready") from exc
    return {"status": "ready"}


@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)) -> AuthResponse:
    existing_user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing_user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")

    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    token = Token(access_token=create_access_token(subject=user.email))
    return AuthResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))


@app.post("/auth/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = Token(access_token=create_access_token(subject=user.email))
    return AuthResponse(token=token, user=UserOut.model_validate(user, from_attributes=True))


@app.get("/auth/me", response_model=UserOut)
def me(
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> UserOut:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")

    subject = decode_token(credentials.credentials)
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.scalar(select(User).where(User.email == subject))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    return UserOut.model_validate(user, from_attributes=True)
