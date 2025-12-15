"""Fork Terminal API - FastAPI backend for agent orchestration."""

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .models import Fork, ForkCreateRequest, Preset, AgentConfig
from .fork_manager import fork_manager
from .cookbook_parser import load_agent_configs


def serialize_fork(fork: Fork) -> dict:
    """Serialize a Fork to a dict with camelCase keys."""
    return fork.model_dump(by_alias=True)


def serialize_agent(agent: AgentConfig) -> dict:
    """Serialize an AgentConfig to a dict with camelCase keys."""
    return agent.model_dump(by_alias=True)


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Register callbacks for fork manager
    def on_fork_update(fork: Fork):
        asyncio.create_task(
            manager.broadcast({
                "type": "fork_update",
                "forkId": fork.id,
                "data": serialize_fork(fork),
            })
        )

    def on_fork_output(fork_id: str, output: str):
        asyncio.create_task(
            manager.broadcast({
                "type": "fork_output",
                "forkId": fork_id,
                "data": {"forkId": fork_id, "output": output},
            })
        )

    fork_manager.on_update(on_fork_update)
    fork_manager.on_output(on_fork_output)

    yield

    # Shutdown: Clean up if needed
    pass


app = FastAPI(
    title="promptbox.pro API",
    description="Backend API for the promptbox.pro agent orchestration system",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Agent endpoints
@app.get("/api/agents")
async def get_agents():
    """Get all available agent configurations."""
    return {key: serialize_agent(agent) for key, agent in fork_manager.agents.items()}


@app.post("/api/agents/reload")
async def reload_agents():
    """Reload agent configurations from cookbook files."""
    fork_manager.reload_agents()
    return {"message": "Agents reloaded successfully", "count": len(fork_manager.agents)}


# Fork endpoints
@app.get("/api/forks")
async def get_forks():
    """Get all forks (active and historical)."""
    return [serialize_fork(fork) for fork in fork_manager.get_all_forks()]


@app.get("/api/forks/{fork_id}")
async def get_fork(fork_id: str):
    """Get a specific fork by ID."""
    fork = fork_manager.get_fork(fork_id)
    if not fork:
        raise HTTPException(status_code=404, detail=f"Fork {fork_id} not found")
    return serialize_fork(fork)


@app.post("/api/forks")
async def create_fork(request: ForkCreateRequest):
    """Create and spawn a new fork."""
    try:
        fork = fork_manager.create_fork(request)
        return serialize_fork(fork)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/forks/{fork_id}")
async def terminate_fork(fork_id: str):
    """Terminate a running fork."""
    success = fork_manager.terminate_fork(fork_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Fork {fork_id} not found")
    return {"message": f"Fork {fork_id} terminated"}


# Presets endpoint
@app.get("/api/presets", response_model=list[Preset])
async def get_presets():
    """Get available quick presets."""
    return [
        Preset(
            name="Code Review",
            icon="⚡",
            agent="claude",
            prompt="Review the codebase for potential improvements and security issues",
        ),
        Preset(
            name="Test Generation",
            icon="🧪",
            agent="codex",
            prompt="Generate comprehensive unit tests for the main modules",
        ),
        Preset(
            name="Documentation",
            icon="📝",
            agent="gemini",
            prompt="Generate documentation for all public APIs",
        ),
        Preset(
            name="Parallel Analysis",
            icon="🔀",
            agent="claude",
            prompt="Analyze the architecture and suggest improvements",
        ),
        Preset(
            name="Bug Hunt",
            icon="🐛",
            agent="claude",
            prompt="Search for potential bugs and edge cases in the codebase",
        ),
        Preset(
            name="Refactoring",
            icon="🔧",
            agent="codex",
            prompt="Identify code that could benefit from refactoring",
        ),
    ]


# WebSocket endpoint for real-time updates
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                # Handle client messages if needed
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# Health check
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "agents": len(fork_manager.agents),
        "active_forks": len([f for f in fork_manager.get_all_forks() if f.status == "running"]),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
