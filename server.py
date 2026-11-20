"""Python web server and simulated 20 Hz pose stream for the PICO WebXR demo."""

import argparse
import asyncio
import math
import os
import time
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

HERE = Path(__file__).resolve().parent
DIST = HERE / "dist"

app = FastAPI(title="PICO 4 Three.js AR demo")


def demo_pose(t: float) -> dict:
    """A demo rigid body, expressed in the WebXR local reference frame (meters)."""
    return {
        "type": "rigid_body",
        "id": "demo",
        "position": {
            "x": 0.4 + 0.25 * math.sin(t),
            "y": -0.2,
            "z": -1.5,
        },
        "quaternion": {"x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0},
    }


@app.websocket("/poses")
async def poses(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            # Later replace demo_pose() with a pose from an OptiTrack source,
            # transformed into the WebXR local coordinate system.
            await websocket.send_json(demo_pose(time.monotonic()))
            await asyncio.sleep(0.05)  # 20 Hz
    except WebSocketDisconnect:
        pass  # Browser closed the connection normally.


if not DIST.is_dir():
    raise RuntimeError(
        "Missing 'dist/' frontend bundle. Run 'npm install' then 'npm run build'."
    )

# Register after /poses so FastAPI handles WebSocket upgrades at that path.
app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--http",
        action="store_true",
        help="Disable HTTPS even if SSL certificates are available."
    )
    args = parser.parse_args()

    base_dir = Path(__file__).resolve().parent

    cert_file = base_dir / "certs" / "server.pem"
    key_file = base_dir / "certs" / "server-key.pem"

    ssl_config = {}

    if not args.http and cert_file.is_file() and key_file.is_file():
        ssl_config = {
            "ssl_certfile": str(cert_file),
            "ssl_keyfile": str(key_file),
        }
        print("SSL certificates found. Starting HTTPS server.")
    else:
        print("SSL certificates missing. Starting HTTP server.")

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=3000,
        **ssl_config
    )
