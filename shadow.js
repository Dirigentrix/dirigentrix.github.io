import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050b1a);
scene.fog = new THREE.FogExp2(0x050b1a, 0.008);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.2, 3.5);
camera.lookAt(0, 0.8, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.zIndex = '0';
document.body.appendChild(renderer.domElement);

const mainLight = new THREE.DirectionalLight(0xffcc88, 1.2);
mainLight.position.set(2, 3, 2);
mainLight.castShadow = true;
scene.add(mainLight);

const fillLight = new THREE.PointLight(0x88aaff, 0.5);
fillLight.position.set(1, 1.5, 2);
scene.add(fillLight);

const backLight = new THREE.PointLight(0xffaa66, 0.4);
backLight.position.set(0, 1.2, -1.5);
scene.add(backLight);

const ambient = new THREE.AmbientLight(0x222233);
scene.add(ambient);

const headGeometry = new THREE.SphereGeometry(0.45, 64, 64);
const headMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2c3a,
    roughness: 0.4,
    metalness: 0.1,
    emissive: 0x111122,
    emissiveIntensity: 0.3,
});
const head = new THREE.Mesh(headGeometry, headMaterial);
head.castShadow = true;
head.position.y = 0.75;
scene.add(head);

const glowGeometry = new THREE.SphereGeometry(0.52, 32, 32);
const glowMaterial = new THREE.MeshPhongMaterial({
    color: 0x88aaff,
    transparent: true,
    opacity: 0.15,
    side: THREE.BackSide,
});
const glow = new THREE.Mesh(glowGeometry, glowMaterial);
glow.position.y = 0.75;
scene.add(glow);

const shoulderGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.35, 8);
const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x2a2a36, roughness: 0.6 });
const shoulders = new THREE.Mesh(shoulderGeo, shoulderMat);
shoulders.position.y = 0.4;
shoulders.castShadow = true;
scene.add(shoulders);

const messageLog = document.getElementById('messageLog');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const statusEl = document.getElementById('status');

let targetHeadTilt = 0;
let currentHeadTilt = 0;
let targetGlowIntensity = 0.3;
let currentGlowIntensity = 0.3;
let targetBgHue = 0.6;
let currentBgHue = 0.6;
let targetPulse = 1;
let currentPulse = 1;

function escapeHtml(text) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function addMessage(role, text) {
    if (!messageLog) return;
    const row = document.createElement('div');
    row.className = `message ${role}`;
    row.innerHTML = `<strong>${role === 'user' ? 'Ty' : 'Dartrix'}:</strong> ${escapeHtml(text)}`;
    messageLog.appendChild(row);
    messageLog.scrollTop = messageLog.scrollHeight;
}

function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
}

function analyzeText(text) {
    const lower = text.toLowerCase();
    let tilt = 0;
    let glow = 0.15;
    let hue = 0.6;
    let pulse = 1;

    if (/(cześć|hej|witaj|dzień dobry)/.test(lower)) {
        tilt = 0.05;
        glow = 0.4;
        hue = 0.52;
        pulse = 1.08;
    }
    if (/(uśmiech|radość|super|dobrze|świetnie)/.test(lower)) {
        tilt = 0.08;
        glow = 0.42;
        hue = 0.56;
        pulse = 1.12;
    }
    if (/(smutek|cisza|spokój)/.test(lower)) {
        tilt = -0.04;
        glow = 0.18;
        hue = 0.62;
        pulse = 0.96;
    }
    if (/(złość|frustracja|chaos|hałas)/.test(lower)) {
        tilt = -0.1;
        glow = 0.52;
        hue = 0.03;
        pulse = 1.16;
    }
    if (/(reset|spokojnie|wycisz)/.test(lower)) {
        tilt = 0;
        glow = 0.22;
        hue = 0.6;
        pulse = 1;
    }

    return { tilt, glow, hue, pulse };
}

function reactToText(text, source = 'user') {
    const clean = String(text || '').trim();
    if (!clean) return;

    addMessage(source, clean);

    const { tilt, glow, hue, pulse } = analyzeText(clean);
    targetHeadTilt = tilt;
    targetGlowIntensity = glow;
    targetBgHue = hue;
    targetPulse = pulse;

    const lower = clean.toLowerCase();
    if (/(cześć|hej|witaj|dzień dobry)/.test(lower)) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance('Cześć, jestem Dartrix. Zapraszam.'));
    } else if (/(smutek|chaos|złość|frustracja)/.test(lower)) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance('Wyciszam cień i porządkuję orbitę.'));
    }
}

if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = chatInput.value;
        chatInput.value = '';
        reactToText(text, 'user');
    });
}

setStatus('offline-first • zero-tracking • voice ready');
addMessage('shadow', 'DARTRIX CHAT v1.0 aktywny. Wpisz wiadomość albo użyj głosu.');

if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'pl-PL';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript;
        reactToText(text, 'shadow');
    };
    recognition.onerror = () => setStatus('speech offline • tekst działa lokalnie');
    recognition.onend = () => {
        try {
            recognition.start();
        } catch {
            setStatus('speech paused • tekst działa lokalnie');
        }
    };
    try {
        recognition.start();
    } catch {
        setStatus('speech unavailable • tekst działa lokalnie');
    }
} else {
    setStatus('speech unavailable • tekst działa lokalnie');
}

function animate() {
    requestAnimationFrame(animate);

    currentHeadTilt += (targetHeadTilt - currentHeadTilt) * 0.12;
    head.rotation.z = currentHeadTilt;

    currentGlowIntensity += (targetGlowIntensity - currentGlowIntensity) * 0.08;
    glowMaterial.opacity = 0.1 + currentGlowIntensity * 0.3;

    currentBgHue += (targetBgHue - currentBgHue) * 0.02;
    const bgColor = new THREE.Color().setHSL(currentBgHue, 0.7, 0.08);
    scene.background = bgColor;

    currentPulse += (targetPulse - currentPulse) * 0.06;
    const scale = 1 + (currentPulse - 1) * 0.06;
    head.scale.setScalar(scale);
    glow.scale.setScalar(scale * 1.02);
    shoulders.scale.setScalar(1 + (currentPulse - 1) * 0.03);

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
