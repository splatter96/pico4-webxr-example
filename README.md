# PICO 4 / Three.js WebXR AR — Python backend

This version replaces the earlier Node.js/Express/WebSocket backend with **Python (FastAPI + Uvicorn)**. The browser rendering is still done with **Three.js + WebXR**.

- Blue cube: fixed at `(0, 0, -1.5)` meters in the WebXR `local` space.
- Orange sphere: moved by a simulated rigid-body position streamed by Python at **20 Hz** over `/poses`.
- Head tracking and stereo AR rendering: performed locally by WebXR on the headset.
- No OptiTrack connection yet. Replace `demo_pose()` in `server.py` once tracking and frame calibration are available.

## Requirements

- Python 3.10+ and pip.
- Node.js compatible with Vite 7 (20.19+ or 22.12+) and npm, **only to build the JavaScript**. Node.js is not used to serve the app.
- PICO browser with `immersive-ar` and passthrough support (verify on your PICO 4 browser / OS build).
- Trusted **HTTPS** origin when opening the app from the headset (ordinary LAN HTTP URLs are not secure contexts for WebXR).

## Build frontend + start Python server (Ubuntu)

```bash
cd pico4-threejs-ar-python
npm install
npm run build
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python server.py
```

Open `http://localhost:3000` in a desktop browser for a basic 3D preview. The desktop browser usually cannot start immersive AR.

To test on the headset with HTTPS, set up a trusted certificate/reverse proxy on your LAN, or **for non-sensitive testing only** run:

```bash
cloudflared tunnel --url http://localhost:3000
```

Open the printed HTTPS URL on the PICO browser. The WebSocket client automatically selects `wss://` when the page is delivered using HTTPS. A temporary public tunnel is **not** appropriate for sensitive OptiTrack data or production.

## What the Python server does

`server.py` serves the Vite-built files in `dist/` and exposes a `/poses` WebSocket. The JSON messages look like:

```json
{
  "type": "rigid_body",
  "id": "demo",
  "position": {"x": 0.4, "y": -0.2, "z": -1.5},
  "quaternion": {"x": 0, "y": 0, "z": 0, "w": 1}
}
```

The frontend creates both Three.js objects and updates the orange sphere for messages with `type="rigid_body"` and `id="demo"`.

Each connected browser receives its own simulated pose stream. The simulator uses Python's monotonic clock; its phase is shared, but no centralized broadcast task is needed for this minimal example.

## OptiTrack integration later

Receive NatNet in a Python task or thread, keep the latest rigid-body pose in a shared state, and send that pose to clients over `/poses`. **Do not directly copy OptiTrack coordinates into Three.js** until you have established the frame transform between Motive/world and WebXR `local`:

`T_XR_object = T_XR_OptiTrack * T_OptiTrack_object`

Account for handedness/axis conventions, object marker offsets, and the headset rigid-body vs. XR viewer relationship. Keep headset rendering tracked by the WebXR runtime to minimize latency.

## Troubleshooting

- `Missing dist/`: run `npm install && npm run build`.
- `AR NOT SUPPORTED`: verify the browser actually supports `immersive-ar` on your PICO firmware; VR support alone is not enough.
- XR unavailable when opening a LAN IP: use a trusted HTTPS site.
- Sphere does not move: check `/poses` WebSocket connectivity and any reverse proxy WebSocket upgrade forwarding.
