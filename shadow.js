import * as THREE from 'three';

const FLOW_COLOR = 0x00AFFF;
const ALERT_COLOR = 0xA020F0;
const STOP_COLOR = 0xFFB300;
const FLOW_HEX = '#00AFFF';
const ALERT_HEX = '#A020F0';
const STOP_HEX = '#FFB300';
const ALERT_PULSE_HZ = 1.2;

const backendStateUrl = (() => {
    const explicitStateUrl = [
        window.KARTRIX_STATE_URL,
        window.KARTRIX_BACKEND_STATE_URL,
        document.body?.dataset?.backendStateUrl,
    ].find(Boolean);

    if (explicitStateUrl) return explicitStateUrl;
    const backendBaseUrl = window.KARTRIX_BACKEND_URL || document.body?.dataset?.backendUrl;
    return backendBaseUrl ? `${String(backendBaseUrl).replace(/\/$/, '')}/state` : '/state';
})();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050b1a);
scene.fog = new THREE.FogExp2(0x050b1a, 0.002);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.inset = '0';

const stage = document.getElementById('shadow-stage');
if (stage) {
    stage.insertBefore(renderer.domElement, stage.firstChild);
} else {
    document.body.appendChild(renderer.domElement);
}

const ambient = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambient);

const pointLight = new THREE.PointLight(FLOW_COLOR, 1, 10);
pointLight.position.set(2, 3, 4);
scene.add(pointLight);

// DARTRIX Orbital Model
const dartrixGroup = new THREE.Group();
scene.add(dartrixGroup);

const coreGeo = new THREE.IcosahedronGeometry(0.8, 1);
const coreMat = new THREE.MeshStandardMaterial({
    color: FLOW_COLOR,
    wireframe: true,
    transparent: true,
    opacity: 0.8,
    emissive: FLOW_COLOR,
    emissiveIntensity: 0.5
});
const core = new THREE.Mesh(coreGeo, coreMat);
dartrixGroup.add(core);

const createOrbit = (radius, color, rotationSpeed) => {
    const geo = new THREE.TorusGeometry(radius, 0.01, 16, 100);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4 });
    const orbit = new THREE.Mesh(geo, mat);
    orbit.rotation.x = Math.random() * Math.PI;
    orbit.rotation.y = Math.random() * Math.PI;
    return { mesh: orbit, speed: rotationSpeed };
};

const orbits = [
    createOrbit(1.2, FLOW_COLOR, 0.01),
    createOrbit(1.5, ALERT_COLOR, -0.015),
    createOrbit(1.8, STOP_COLOR, 0.008)
];
orbits.forEach(o => dartrixGroup.add(o.mesh));

const starGeo = new THREE.BufferGeometry();
const starCount = 500;
const starPos = new Float32Array(starCount * 3);
for(let i=0; i<starCount*3; i++) starPos[i] = (Math.random() - 0.5) * 10;
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.02, transparent: true, opacity: 0.5 });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// --- Backend and UI Logic ---

const statusDock = document.createElement('div');
statusDock.id = 'signal-dock';
statusDock.style.cssText = 'position:fixed;top:92px;right:18px;z-index:25;display:flex;flex-wrap:wrap;gap:8px;pointer-events:none;';
document.body.appendChild(statusDock);

const makeBadge = (label, value, color) => {
    const el = document.createElement('div');
    el.style.cssText = `padding:10px 12px;border-radius:999px;border:1px solid ${color}55;background:rgba(6,12,28,0.72);backdrop-filter:blur(10px);font:600 12px ui-monospace,monospace;color:#eef4ff;box-shadow:0 0 10px ${color}22;`;
    el.innerHTML = `<span style="opacity:.72">${label}</span> <span data-value>${value}</span>`;
    return el;
};

const statusItems = {
    mode: makeBadge('mode', 'SAFE', FLOW_HEX),
    stability: makeBadge('stability', 'TRUE', FLOW_HEX)
};
Object.values(statusItems).forEach(i => statusDock.appendChild(i));

const backendState = { mode_signal: 'SAFE', stability_flag: 'TRUE' };
let visualMode = 'flow';

const applyTheme = (mode) => {
    visualMode = mode;
    const color = mode === 'stop' ? STOP_COLOR : (mode === 'alert' ? ALERT_COLOR : FLOW_COLOR);
    const hex = mode === 'stop' ? STOP_HEX : (mode === 'alert' ? ALERT_HEX : FLOW_HEX);
    
    core.material.color.setHex(color);
    core.material.emissive.setHex(color);
    pointLight.color.setHex(color);
    
    const statusSlotMode = statusItems.mode.querySelector('[data-value]');
    if (statusSlotMode) statusSlotMode.textContent = backendState.mode_signal;
    statusItems.mode.style.borderColor = `${hex}55`;
};

async function syncBackendState() {
    if (!backendStateUrl || backendStateUrl === '/state') return;
    try {
        const res = await fetch(backendStateUrl);
        if (res.ok) {
            const data = await res.json();
            backendState.mode_signal = (data.mode_signal || 'SAFE').toUpperCase();
            backendState.stability_flag = (data.stability_flag || 'TRUE').toUpperCase();
            applyTheme(backendState.mode_signal === 'ALERT' ? 'alert' : (backendState.mode_signal === 'STOP' ? 'stop' : 'flow'));
        }
    } catch(e) {}
}

// --- Chat Logic ---
const chatRoot = document.createElement('div');
chatRoot.id = 'dartrix-chat';
chatRoot.style.cssText = 'position:fixed;right:18px;bottom:18px;width:min(400px,90vw);z-index:30;';
chatRoot.innerHTML = `
    <div id="chat-messages" style="max-height:200px;overflow-y:auto;margin-bottom:10px;padding:12px;border-radius:18px;background:rgba(6,12,28,0.9);border:1px solid ${FLOW_HEX}33;color:#eef4ff;font:14px monospace;"></div>
    <div style="display:flex;gap:10px;">
        <input id="chat-input" type="text" placeholder="Signal..." style="flex:1;padding:12px;border-radius:999px;border:1px solid ${FLOW_HEX}55;background:rgba(5,11,26,0.9);color:white;outline:none;">
        <button id="chat-send" style="padding:12px 20px;border-radius:999px;border:none;background:linear-gradient(135deg,${FLOW_HEX},${ALERT_HEX});color:#06111f;font-weight:700;cursor:pointer;">Send</button>
    </div>
`;
document.body.appendChild(chatRoot);

const addMessage = (text, isUser) => {
    const msg = document.createElement('div');
    msg.style.cssText = `margin:5px 0;padding:8px 12px;border-radius:12px;background:${isUser ? 'rgba(0,175,255,0.1)' : 'rgba(160,32,240,0.1)'};border:1px solid ${isUser ? '#00AFFF33' : '#A020F033'};`;
    msg.textContent = `${isUser ? 'User' : 'Dartrix'}: ${text}`;
    const container = document.getElementById('chat-messages');
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
};

document.getElementById('chat-send').onclick = () => {
    const input = document.getElementById('chat-input');
    if(!input.value) return;
    addMessage(input.value, true);
    setTimeout(() => addMessage("Signal received. DARTRIX core stable.", false), 500);
    input.value = '';
};

// --- Animation ---
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now() * 0.001;

    core.rotation.y += 0.005;
    core.rotation.z += 0.003;
    
    orbits.forEach((o, i) => {
        o.mesh.rotation.x += o.speed;
        o.mesh.rotation.y += o.speed * 0.5;
    });

    dartrixGroup.position.y = Math.sin(now) * 0.1;
    
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
setInterval(syncBackendState, 5000);
addMessage("DARTRIX Orbital System Initialized.", false);