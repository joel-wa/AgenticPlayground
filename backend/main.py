import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from google import genai
from google.genai import types

app = FastAPI(title="AgenticPlayground API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)



GEMINI_API_KEY = "AIzaSyA9d8YKCgIIN_wu9GPKYZUsJcexX4CL3tY" # Replace with environment variable for security

client = genai.Client(api_key=GEMINI_API_KEY)


def generate_gemini_response(prompt_text):
    model = "gemini-3-flash-preview"
    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt_text)],
        )
    ]
    # Thinking config validation varies by SDK version, simplified for broad compatibility
    config = types.GenerateContentConfig(
        # Remove thinking_level if your model/SDK version doesn't support it directly
        thinking_config=types.ThinkingConfig(
            thinking_level="low",
        ),
    )

    result = []
    # Blocking call to generate content
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=config,
    ):
        if chunk.text:
            result.append(chunk.text)
    return "".join(result)



@app.get("/")
async def read_root():
    return {"message": "Hello from FastAPI!"}


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/api/chat")
async def chat(request: Request):
    payload = None
    try:
        payload = await request.json()
    except Exception:
        body = await request.body()
        payload = body.decode(errors="replace") if body else None

    print("Received /api/chat payload:", payload)

    if isinstance(payload, dict):
        prompt_text = payload.get("prompt", "")
        system_text = payload.get("system")
        if system_text:
            prompt_text = f"{system_text}\n\n{prompt_text}"

        if prompt_text:
            gemini_response = generate_gemini_response(prompt_text)
            return {"message":gemini_response, "response": gemini_response}

    return {"message": "invalid payload", "payload": payload}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


