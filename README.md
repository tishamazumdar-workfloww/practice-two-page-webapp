# 📘 Two-Page Web Application — Login & Upload System

## Two-Page Web App (FastAPI)

Simple two-page app with Login and Upload pages using FastAPI, Jinja2 templates, and SQLite (SQLModel).

Features:
- Login with username/password (default user: testuser / testpass)
- JWT-based auth stored as HttpOnly cookie
- Upload PDFs, DOCX, MP4 files (server + client validation)
- Store files in /uploads and metadata in SQLite `database.db`
- Preview PDFs in iframe and MP4 using video tag
- Search/filter by filename or topic

Quick start (Windows PowerShell):

1. Create virtualenv and install dependencies

```powershell
python -m venv .venv; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Run the app

```powershell
python -m uvicorn main:app --reload
```

3. Open http://127.0.0.1:8000/login

Notes:
- Uploaded files go to the `uploads` directory.
- Change `SECRET_KEY` in `main.py` to a secure random value in production.
- This is a minimal demo—consider adding CSRF protection, stronger session handling, and production-ready file scanning for untrusted uploads.
