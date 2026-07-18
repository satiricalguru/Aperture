import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.db import engine, Base
from backend.routers import generate, history

# Create SQLite tables if they do not exist
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Aperture API",
    description="Backend service for the Aperture monochrome darkroom AI generation studio.",
    version="1.0.0"
)

# Configure CORS
allowed_origin = os.getenv("ALLOWED_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(generate.router)
app.include_router(history.router)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "aperture"}
