import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AgenticPlayground API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def read_root():
    return {"message": "Hello from FastAPI!"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/api/chat")
async def chat(request: Request):
    body = await request.body()
    if body:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                payload = await request.json()
            except Exception:
                payload = body.decode(errors="replace")
        else:
            payload = body.decode(errors="replace")
    else:
        payload = None

    print("Received /api/chat payload:", payload)
    return {"message": "hello", "payload": payload}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


