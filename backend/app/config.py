"""App settings loaded from environment / `.env`."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    # Local-dev origin; for production set FRONTEND_ORIGIN to the deployed Vercel URL.
    frontend_origin: str = "http://localhost:3000"
    # Local-dev port; another project squats on 8000 so default to 8001 here.
    # Fly.io overrides this via PORT env at deploy time.
    dev_port: int = 8001

    gemini_model: str = "gemini-3.1-pro-preview"
    claude_model: str = "claude-opus-4-7"

    extract_concurrency: int = 6
    extract_dpi: int = 300

    # Phase 2
    e2b_api_key: str = ""
    # Toggle: "local" runs the agent against /tmp filesystem (fast dev,
    # default), "sandbox" spawns an E2B sandbox (prod, requires E2B_API_KEY).
    # Override via the AGENT_WORKSPACE env var.
    agent_workspace: str = "local"


settings = Settings()
