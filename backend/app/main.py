"""FastAPI entrypoint for EPL Predictor backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import fixtures, history, predictions
from .config import ensure_data_directories, settings


def create_app() -> FastAPI:
    ensure_data_directories()

    app = FastAPI(title=settings.app_name, version=settings.app_version)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(fixtures.router, prefix="/api", tags=["fixtures"])
    app.include_router(predictions.router, prefix="/api", tags=["predictions"])
    app.include_router(history.router, prefix="/api", tags=["history"])
    return app


app = create_app()

