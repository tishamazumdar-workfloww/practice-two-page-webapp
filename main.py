from fastapi import FastAPI, Request, Form, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlmodel import SQLModel, Field, create_engine, Session, select
from typing import Optional, List
import os
from datetime import datetime, timedelta
# Prevent passlib from trying to initialize bcrypt backend which may be a broken/incorrect
# 'bcrypt' package in some environments. Disable bcrypt handler so we can use pbkdf2_sha256.
os.environ.setdefault("PASSLIB_NO_BCRYPT", "1")
from passlib.context import CryptContext
from jose import JWTError, jwt
import aiofiles
import uuid
from dotenv import load_dotenv

load_dotenv()

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
DB_FILE = os.path.join(BASE_DIR, "database.db")
DATABASE_URL = f"sqlite:///{DB_FILE}"
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 1 day
ALLOWED_EXT = {".pdf": "pdf", ".docx": "docx", ".mp4": "mp4"}

# Use PBKDF2 (pbkdf2_sha256) to avoid bcrypt backend issues and the 72-byte limit
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

app = FastAPI()
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))
engine = create_engine(DATABASE_URL, echo=False)

# Models
class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    hashed_password: str

class FileMeta(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    original_filename: str
    topic: str
    file_type: str
    upload_date: datetime = Field(default_factory=datetime.utcnow)
    user_id: int = Field(foreign_key="user.id")

# DB helper
def create_db_and_tables():
    if not os.path.exists(UPLOAD_DIR):
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    SQLModel.metadata.create_all(engine)
    # create a default user if none exist
    with Session(engine) as session:
        q = select(User)
        existing = session.exec(q).first()
        if not existing:
            user = User(username="testuser", hashed_password=get_password_hash("testpass"))
            session.add(user)
            session.commit()

# Auth helpers
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        return user

# Routes
@app.on_event("startup")
def on_startup():
    create_db_and_tables()

@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return RedirectResponse(url="/login")

@app.get("/login", response_class=HTMLResponse)
async def get_login(request: Request):
    # Render the login page with empty error fields so a plain GET doesn't show previous errors
    return templates.TemplateResponse("login.html", {"request": request, "show_signup": False, "error": None, "error_signup": None})

@app.post("/login")
async def post_login(request: Request, username: str = Form(...), password: str = Form(...)):
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user or not verify_password(password, user.hashed_password):
            # render login with error
            return templates.TemplateResponse("login.html", {"request": request, "error": "Invalid credentials", "show_signup": False})
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        response = RedirectResponse(url="/upload", status_code=status.HTTP_303_SEE_OTHER)
        response.set_cookie(key="access_token", value=access_token, httponly=True, max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        return response


@app.post("/signup")
async def post_signup(request: Request, username: str = Form(...), password: str = Form(...), password2: str = Form(...)):
    # server-side validation
    if not username or not username.strip():
        return templates.TemplateResponse("login.html", {"request": request, "error_signup": "Username is required", "show_signup": True})
    if not password or not password.strip():
        return templates.TemplateResponse("login.html", {"request": request, "error_signup": "Password is required", "show_signup": True})
    if password != password2:
        return templates.TemplateResponse("login.html", {"request": request, "error_signup": "Passwords do not match", "show_signup": True})
    if len(password) < 6:
        return templates.TemplateResponse("login.html", {"request": request, "error_signup": "Password must be at least 6 characters", "show_signup": True})

    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if existing:
            return templates.TemplateResponse("login.html", {"request": request, "error_signup": "Username already exists", "show_signup": True})
        # create user
        user = User(username=username, hashed_password=get_password_hash(password))
        session.add(user)
        session.commit()

    # auto-login after signup
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": username}, expires_delta=access_token_expires)
    response = RedirectResponse(url="/upload", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(key="access_token", value=access_token, httponly=True, max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    return response

@app.get("/logout")
async def logout():
    response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie("access_token")
    return response

@app.get("/upload", response_class=HTMLResponse)
async def get_upload(request: Request, current_user: User = Depends(get_current_user)):
    if not current_user:
        return RedirectResponse(url="/login")
    with Session(engine) as session:
        stmt = select(FileMeta).where(FileMeta.user_id == current_user.id).order_by(FileMeta.upload_date.desc())
        files = session.exec(stmt).all()
    return templates.TemplateResponse("upload.html", {"request": request, "files": files, "user": current_user})

@app.post("/upload")
async def post_upload(request: Request, topic: str = Form(...), upload_file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    if not current_user:
        return RedirectResponse(url="/login")
    # server-side validation
    original_filename = upload_file.filename
    _, ext = os.path.splitext(original_filename.lower())
    if ext not in ALLOWED_EXT:
        return templates.TemplateResponse("upload.html", {"request": request, "error": "Invalid file type", "user": current_user})
    if not topic or not topic.strip():
        return templates.TemplateResponse("upload.html", {"request": request, "error": "Topic cannot be empty", "user": current_user})

    # safe filename
    unique_name = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, unique_name)
    # save file
    async with aiofiles.open(save_path, 'wb') as out_file:
        content = await upload_file.read()
        await out_file.write(content)

    # store metadata
    with Session(engine) as session:
        meta = FileMeta(
            filename=unique_name,
            original_filename=original_filename,
            topic=topic.strip(),
            file_type=ALLOWED_EXT[ext],
            user_id=current_user.id
        )
        session.add(meta)
        session.commit()
    return RedirectResponse(url="/upload", status_code=status.HTTP_303_SEE_OTHER)

# small health check
@app.get("/ping")
async def ping():
    return {"status": "ok"}
