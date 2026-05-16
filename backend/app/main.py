"""FastAPI app entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import extract as extract_api
from .api import plan as plan_api
from .config import settings

app = FastAPI(title="annotator backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract_api.router)
app.include_router(plan_api.router)


@app.get("/api/health")
def health() -> dict:
    """Basic liveness + key-presence check (NOT key validity)."""
    return {
        "ok": True,
        "gemini_key": bool(settings.gemini_api_key),
        "anthropic_key": bool(settings.anthropic_api_key),
        "gemini_model": settings.gemini_model,
        "claude_model": settings.claude_model,
    }
