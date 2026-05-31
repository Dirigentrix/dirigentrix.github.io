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

    if (explicitStateUrl) {
        return explicitStateUrl;
    }

    const backendBaseUrl = window.KARTRIX_BACKEND_URL || document.body?.dataset?.backendUrl;
    if (backendBaseUrl) {
        return `${String(backendBaseUrl).replace(/\/$/, '')}/state`;
    }

    return '/state';
})();

const scene = new THREE.Scene();
scene.background = new THREE.Color(FLOW_COLOR);
scene.fog = new THREE.FogExp2(FLOW_COLOR, 0.008);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.2, 3.5);
camera.lookAt(0, 0.8, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.inset = '0';
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';

const stage = document.getElementById('shadow-stage');
if (stage) {
    stage.insertBefore(renderer.domElement, stage.firstChild);
} else {
    document.body.appendChild(renderer.domElement);
}

const ambient = new THREE.AmbientLight(0x22324a, 1.1);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(FLOW_COLOR, 1.4);
keyLight.position.set(2.2, 3.2, 2.2);
keyLight.castShadow = true;
scene.add(keyLight);

const rimLight = new THREE.PointLight(FLOW_COLOR, 0.6, 10);
rimLight.position.set(-1.3, 1.2, -1.6);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x7fd4ff, 0.4, 10);
fillLight.position.set(1.0, 1.5, 2.0);
scene.add(fillLight);

const headGeometry = new THREE.SphereGeometry(0.45, 64, 64);
const headMaterial = new THREE.MeshStandardMaterial({
    color: 0x24324a,
    roughness: 0.34,
    metalness: 0.08,
    emissive: FLOW_COLOR,
    emissiveIntensity: 0.12,
});
const head = new THREE.Mesh(headGeometry, headMaterial);
head.castShadow = true;
head.position.y = 0.75;
scene.add(head);

const auraGeometry = new THREE.SphereGeometry(0.56, 32, 32);
const auraMaterial = new THREE.MeshBasicMaterial({
    color: FLOW_COLOR,
    transparent: true,
    opacity: 0.18,
    side: THREE.BackSide,
});
const aura = new THREE.Mesh(auraGeometry, auraMaterial);
aura.position.y = 0.75;
scene.add(aura);

const shoulderGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.35, 8);
const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x1d2433, roughness: 0.65, metalness: 0.04 });
const shoulders = new THREE.Mesh(shoulderGeo, shoulderMat);
shoulders.position.y = 0.4;
shoulders.castShadow = true;
scene.add(shoulders);

const waveRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.66, 0.03, 16, 160),
    new THREE.MeshBasicMaterial({ color: FLOW_COLOR, transparent: true, opacity: 0.52 })
);
waveRing.rotation.x = Math.PI / 2;
waveRing.position.y = 0.75;
scene.add(waveRing);

const statusDock = document.createElement('div');
statusDock.id = 'signal-dock';
statusDock.style.cssText = [
    'position: fixed',
    'top: 92px',
    'right: 18px',
    'z-index: 25',
    'display: flex',
    'flex-wrap: wrap',
    'gap: 8px',
    'max-width: min(520px, calc(100vw - 36px))',
    'pointer-events: none',
].join(';');

document.body.appendChild(statusDock);

const statusItems = {
    mode: makeBadge('mode_signal', 'SAFE', FLOW_HEX),
    stability: makeBadge('stability_flag', 'TRUE', FLOW_HEX),
    visual: makeBadge('visual', 'flow', FLOW_HEX),
};

Object.values(statusItems).forEach((item) => statusDock.appendChild(item));

const backendState = {
    mode_signal: 'SAFE',
    stability_flag: 'TRUE',
    engine_mode: 'Flow',
    ren12_status: null,
    k12_status: null,
    source: 'local',
};

let visualMode = 'flow';
let visualColors = themeForMode('flow');
let frozen = false;
let baseHeadTilt = 0;
let pulseBoost = 0;

function makeBadge(label, value, color) {
    const el = document.createElement('div');
    el.style.cssText = [
        'padding: 10px 12px',
        'border-radius: 999px',
        'border: 1px solid rgba(127, 180, 255, 0.18)',
        'background: rgba(6, 12, 28, 0.72)',
        'backdrop-filter: blur(10px)',
        'font: 600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        'letter-spacing: 0.08em',
        'text-transform: uppercase',
        'color: #eef4ff',
        `box-shadow: 0 0 0 1px ${color}33 inset`,
    ].join(';');
    el.innerHTML = `<span style="opacity:.72">${label}</span> <span data-value>${value}</span>`;
    return el;
}

function updateBadge(el, value, color) {
    const slot = el.querySelector('[data-value]');
    if (slot) {
        slot.textContent = value;
    }
    el.style.boxShadow = `0 0 0 1px ${color}55 inset, 0 0 18px ${color}22`;
    el.style.borderColor = `${color}55`;
}

function themeForMode(mode) {
    if (mode === 'stop') {
        return {
            color: STOP_COLOR,
            hex: STOP_HEX,
            fog: STOP_COLOR,
            auraOpacity: 0.16,
            headGlow: 0.42,
            ringOpacity: 0.58,
            ambient: 0.82,
            key: 1.0,
            rim: 0.34,
        };
    }
    if (mode === 'alert') {
        return {
            color: ALERT_COLOR,
            hex: ALERT_HEX,
            fog: ALERT_COLOR,
            auraOpacity: 0.22,
            headGlow: 0.58,
            ringOpacity: 0.62,
            ambient: 0.96,
            key: 1.3,
            rim: 0.6,
        };
    }
    return {
        color: FLOW_COLOR,
        hex: FLOW_HEX,
        fog: FLOW_COLOR,
        auraOpacity: 0.18,
        headGlow: 0.26,
        ringOpacity: 0.5,
        ambient: 1.06,
        key: 1.35,
        rim: 0.6,
    };
}

function deriveVisualMode(modeSignal, stabilityFlag) {
    const mode = String(modeSignal || 'SAFE').toUpperCase();
    const stability = String(stabilityFlag || 'TRUE').toUpperCase();

    if (mode === 'ALERT' || stability === 'FALSE') {
        return 'stop';
    }
    if (mode === 'CHECK' || stability === 'PARTIAL') {
        return 'alert';
    }
    return 'flow';
}

function applyTheme(mode) {
    visualMode = mode;
    visualColors = themeForMode(mode);
    frozen = mode === 'stop';

    document.documentElement.style.setProperty('--flow', FLOW_HEX);
    document.documentElement.style.setProperty('--alert', ALERT_HEX);
    document.documentElement.style.setProperty('--stop', STOP_HEX);
    document.documentElement.style.setProperty('--active-signal', visualColors.hex);
    document.documentElement.style.setProperty('--active-glow', visualColors.hex);

    scene.background.setHex(visualColors.color);
    scene.fog.color.setHex(visualColors.fog);
    auraMaterial.color.setHex(visualColors.color);
    auraMaterial.opacity = visualColors.auraOpacity;
    headMaterial.emissive.setHex(visualColors.color);
    headMaterial.emissiveIntensity = visualColors.headGlow;
    waveRing.material.color.setHex(visualColors.color);
    waveRing.material.opacity = visualColors.ringOpacity;
    keyLight.color.setHex(visualColors.color);
    keyLight.intensity = visualColors.key;
    rimLight.color.setHex(visualColors.color);
    rimLight.intensity = visualColors.rim;
    fillLight.color.setHex(mode === 'alert' ? ALERT_COLOR : FLOW_COLOR);
    fillLight.intensity = mode === 'alert' ? 0.45 : 0.4;

    updateBadge(statusItems.visual, mode, visualColors.hex);
}

function refreshStatusDock() {
    updateBadge(statusItems.mode, backendState.mode_signal, visualColors.hex);
    updateBadge(statusItems.stability, backendState.stability_flag, visualColors.hex);
}

function setBackendState(next) {
    if (!next || typeof next !== 'object') return;

    backendState.mode_signal = String(next.mode_signal || next.snet_state?.mode_signal || backendState.mode_signal || 'SAFE').toUpperCase();
    backendState.stability_flag = String(next.stability_flag || next.snet_state?.stability_flag || backendState.stability_flag || 'TRUE').toUpperCase();
    backendState.engine_mode = String(next.engine_mode || next.snet_state?.engine_mode || backendState.engine_mode || 'Flow');
    backendState.ren12_status = next.ren12_status || next.snet_state?.ren12_status || backendState.ren12_status;
    backendState.k12_status = next.k12_status || next.snet_state?.k12_status || backendState.k12_status;
    backendState.source = next.source || 'backend';

    const nextVisualMode = deriveVisualMode(backendState.mode_signal, backendState.stability_flag);
    applyTheme(nextVisualMode);
    refreshStatusDock();
}

async function syncBackendState() {
    if (!backendStateUrl) return;
    try {
        const res = await fetch(backendStateUrl, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setBackendState(data);
    } catch (_error) {
        // Keep the last known visual state if the backend is unreachable.
    }
}

const replies = {
    default: 'Rozumiem. Modul B trzyma sygnał i czeka na REN12 oraz K12.',
    hello: 'Cześć. Modul B jest aktywny. Podaj sygnał albo status.',
    flow: 'Flow: niebieski strumień utrzymany. Ruch jest stabilny.',
    alert: 'Alert: fioletowy puls aktywny. Trzymam kontrolę i obserwuję.',
    stop: 'Stop: bursztynowe zatrzymanie. Czekam bez ruchu.',
    moduleC: 'Module C jest widziany. REN12 i K12 mogą wejść przez port zwrotny.',
};

function replyFor(text) {
    const t = String(text || '').toLowerCase();
    if (t.includes('cześć') || t.includes('hej') || t.includes('witaj')) return replies.hello;
    if (t.includes('flow')) return replies.flow;
    if (t.includes('alert')) return replies.alert;
    if (t.includes('stop')) return replies.stop;
    if (t.includes('ren12') || t.includes('k12') || t.includes('module c')) return replies.moduleC;
    return replies.default;
}

const chatRoot = document.createElement('div');
chatRoot.id = 'dartrix-chat';
chatRoot.style.cssText = [
    'position: fixed',
    'right: 18px',
    'left: auto',
    'bottom: 18px',
    'width: min(420px, calc(100vw - 36px))',
    'z-index: 30',
].join(';');
chatRoot.innerHTML = `
    <div id="chat-messages" style="
        width: 100%; max-height: 220px; overflow-y: auto; margin-bottom: 10px;
        padding: 12px; border-radius: 18px; background: rgba(6, 12, 28, 0.88);
        border: 1px solid rgba(127, 180, 255, 0.18); color: #eef4ff; font: 14px ui-monospace, monospace;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
    "></div>
    <div style="display: flex; gap: 10px; width: 100%;">
        <input id="chat-input" type="text" placeholder="Wpisz sygnał..." style="
            flex: 1; min-width: 0; padding: 12px 14px; border-radius: 999px;
            border: 1px solid rgba(127, 180, 255, 0.3); background: rgba(5, 11, 26, 0.9);
            color: white; outline: none; font: 14px ui-monospace, monospace;
        ">
        <button id="chat-send" style="
            padding: 12px 18px; border: none; border-radius: 999px; cursor: pointer;
            background: linear-gradient(135deg, ${FLOW_HEX}, ${ALERT_HEX}); color: #06111f; font: 700 14px ui-monospace, monospace;
        ">Wyślij</button>
    </div>
    <button id="microphone-btn" style="
        margin-top: 10px; width: 100%; padding: 12px 18px; border: none; border-radius: 18px; cursor: pointer;
        background: linear-gradient(135deg, ${ALERT_HEX}, ${STOP_HEX}); color: #06111f; font: 700 14px ui-monospace, monospace;
    ">🎤 Mów</button>
`;
document.body.appendChild(chatRoot);

const messagesDiv = chatRoot.querySelector('#chat-messages');
const input = chatRoot.querySelector('#chat-input');
const sendBtn = chatRoot.querySelector('#chat-send');
const micBtn = chatRoot.querySelector('#microphone-btn');

function addMessage(text, isUser) {
    const msg = document.createElement('div');
    msg.style.margin = '6px 0';
    msg.style.padding = '8px 10px';
    msg.style.borderRadius = '12px';
    msg.style.wordWrap = 'break-word';
    msg.style.background = isUser ? 'rgba(0, 175, 255, 0.12)' : 'rgba(160, 32, 240, 0.12)';
    msg.style.border = `1px solid ${isUser ? 'rgba(0, 175, 255, 0.3)' : 'rgba(160, 32, 240, 0.3)'}`;
    msg.style.color = '#eef4ff';
    msg.textContent = `${isUser ? 'Ty' : 'Dartrix'}: ${text}`;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pl-PL';
        utterance.rate = 0.92;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }
}

function sendMessage(text) {
    const value = String(text || '').trim();
    if (!value) return;
    addMessage(value, true);
    const reply = replyFor(value);
    setTimeout(() => addMessage(reply, false), 180);
}

sendBtn.addEventListener('click', () => {
    sendMessage(input.value);
    input.value = '';
});

input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        sendMessage(input.value);
        input.value = '';
    }
});

micBtn.addEventListener('click', () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        addMessage('Brak wsparcia dla mikrofonu.', false);
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'pl-PL';
    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        input.value = text;
        sendMessage(text);
    };
    recognition.onerror = () => addMessage('Mikrofon niedostępny.', false);
    recognition.start();
    addMessage('Nasłuchuję...', false);
});

setTimeout(() => addMessage('Moduł B gotowy. Czekam na REN12 i K12.', false), 500);

function animate() {
    requestAnimationFrame(animate);

    const now = performance.now() / 1000;
    const alertPhase = (Math.sin(now * Math.PI * 2 * ALERT_PULSE_HZ) + 1) / 2;
    const flowPhase = (Math.sin(now * 2.8) + 1) / 2;

    if (!frozen) {
        const waveScale = visualMode === 'alert'
            ? 1 + 0.07 * alertPhase
            : 1 + 0.05 * flowPhase;
        waveRing.scale.setScalar(waveScale);
        waveRing.rotation.z += visualMode === 'alert' ? 0.012 : 0.007;
        head.rotation.z = Math.sin(now * 1.15) * (visualMode === 'flow' ? 0.05 : 0.03);
        shoulders.rotation.y = Math.sin(now * 0.5) * 0.03;
    }

    const pulse = visualMode === 'alert' ? (0.35 + 0.65 * alertPhase) : (visualMode === 'flow' ? (0.4 + 0.35 * flowPhase) : 0.18);
    const ambientIntensity = visualMode === 'stop' ? 0.72 : 1.02;

    auraMaterial.opacity = visualMode === 'alert' ? 0.14 + pulse * 0.14 : visualMode === 'flow' ? 0.1 + pulse * 0.12 : 0.14;
    headMaterial.emissiveIntensity = visualMode === 'alert' ? 0.28 + pulse * 0.4 : visualMode === 'flow' ? 0.14 + pulse * 0.22 : 0.12;
    waveRing.material.opacity = visualMode === 'stop' ? 0.26 : visualMode === 'alert' ? 0.28 + pulse * 0.32 : 0.24 + pulse * 0.24;
    ambient.intensity = ambientIntensity;
    fillLight.intensity = visualMode === 'alert' ? 0.42 + pulse * 0.18 : visualMode === 'flow' ? 0.34 + pulse * 0.14 : 0.24;
    if (!frozen) {
        scene.background.setHex(visualColors.color);
        scene.fog.color.setHex(visualColors.fog);
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

applyTheme('flow');
syncBackendState();
setInterval(syncBackendState, 2500);
animate();
