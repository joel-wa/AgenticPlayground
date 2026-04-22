# Backend FastAPI Server

This directory contains a minimal FastAPI application.

## Setup

1. Create and activate a Python virtual environment:

```bash
python -m venv .venv
source .venv/Scripts/activate  # Windows
# or
source .venv/bin/activate      # macOS/Linux
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- GET `/` - returns a welcome message
- GET `/health` - returns service health status
