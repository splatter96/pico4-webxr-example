import * as THREE from 'three';
// import { ARButton } from 'three/addons/webxr/ARButton.js';

// Transparent background is essential: the headset displays passthrough behind it.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local');
document.body.appendChild(renderer.domElement);

// Coordinates are in meters relative to the WebXR session's local origin.
// At session start, the origin is near the headset. -Z is forward.
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(0.25, 0.25, 0.25),
  new THREE.MeshBasicMaterial({ color: 0x42a5ff }),
);
cube.position.set(0, 0, -1.5);
scene.add(cube);

// This second object will later be driven by an actual OptiTrack rigid body.
const trackedObject = new THREE.Mesh(
  new THREE.SphereGeometry(0.10, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0xffa12b }),
);
trackedObject.position.set(0.4, -0.2, -1.5);
scene.add(trackedObject);

// Three.js manages the stereo cameras and headset pose during the WebXR session.
//const arButton = ARButton.createButton(renderer);
//document.body.appendChild(arButton);
//
const arButton = document.createElement('button');

arButton.textContent = 'START AR';

Object.assign(arButton.style, {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    background: '#333',
    color: '#fff',
    border: '1px solid #fff',
    borderRadius: '5px',
    cursor: 'pointer',
    zIndex: '1000'
});

document.body.appendChild(arButton);

arButton.addEventListener('click', async () => {
    const currentSession = renderer.xr.getSession();

    if (currentSession) {
        await currentSession.end();
        return;
    }

    let session;

    try {
        console.log('Requesting immersive-ar session');

        session = await navigator.xr.requestSession('immersive-ar');

        console.log('XR session created:', session);

        session.addEventListener('end', () => {
            arButton.textContent = 'START AR';
            console.log('XR session ended');
        });

        renderer.xr.setReferenceSpaceType('local');

        await renderer.xr.setSession(session);

        arButton.textContent = 'STOP AR';

        console.log('Three.js XR session initialized');

    } catch (error) {
        console.error('AR initialization failed:', error);

        if (session) {
            await session.end().catch(console.error);
        }

        alert(`${error.name}: ${error.message}`);
    }
});

const info = document.getElementById('info');
const status = document.getElementById('status');
renderer.xr.addEventListener('sessionstart', () => { info.style.display = 'none'; });
renderer.xr.addEventListener('sessionend', () => { info.style.display = 'block'; });

if (!window.isSecureContext) {
  status.textContent = 'WebXR requires HTTPS on the headset (localhost is an exception).';
} else if (!navigator.xr) {
  status.textContent = 'This browser does not expose the WebXR API.';
} else {
  navigator.xr.isSessionSupported('immersive-ar')
    .then(supported => {
      status.textContent = supported
        ? 'Immersive AR is supported. Press START AR.'
        : 'Immersive AR is unavailable in this browser. Try Wolvic Chromium.';
    })
    .catch(error => { status.textContent = `WebXR check failed: ${error.message}`; });
}

// Server emits a demo pose over WebSockets. For future OptiTrack integration,
// keep this message format and replace the server's simulated position.
const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
const trackingStatus = document.getElementById('tracking-status');
const socket = new WebSocket(`${scheme}//${location.host}/poses`);
socket.onopen = () => { trackingStatus.textContent = 'Pose stream connected (Python / FastAPI).'; };
socket.onclose = () => { trackingStatus.textContent = 'Pose stream disconnected.'; };
socket.onmessage = event => {
  try {
    const message = JSON.parse(event.data);
    if (message.type === 'rigid_body' && message.id === 'demo') {
      const p = message.position;
      trackedObject.position.set(p.x, p.y, p.z);
      if (message.quaternion) {
        const q = message.quaternion;
        trackedObject.quaternion.set(q.x, q.y, q.z, q.w);
      }
    }
  } catch (error) {
    console.warn('Ignoring invalid pose', error);
  }
};
socket.onerror = () => { trackingStatus.textContent = 'Pose stream connection failed.'; console.warn('Pose WebSocket connection failed'); };

renderer.setAnimationLoop((time) => {
  cube.rotation.y = time * 0.0004;
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
