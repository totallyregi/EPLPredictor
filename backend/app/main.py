"""FastAPI entrypoint for EPL Predictor backend."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import admin, fixtures, history, predictions
from .config import ensure_data_directories, settings
from .model import store


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

    @app.on_event("startup")
    def warm_up() -> None:
        # Load match data in the background so the first visitor is not kept waiting.
        store.warm_up_async()

    @app.get("/health")
    def health() -> dict[str, object]:
        return {"status": "ok", "data_loaded": store.df is not None}

    app.include_router(fixtures.router, prefix="/api", tags=["fixtures"])
    app.include_router(predictions.router, prefix="/api", tags=["predictions"])
    app.include_router(history.router, prefix="/api", tags=["history"])
    app.include_router(admin.router, prefix="/api", tags=["admin"])
    return app


app = create_app()

