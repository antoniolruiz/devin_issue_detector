from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import issues, scoping, execution, config

app = FastAPI(title="Issue Detector Dashboard API")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.include_router(issues.router)
app.include_router(scoping.router)
app.include_router(execution.router)
app.include_router(config.router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
