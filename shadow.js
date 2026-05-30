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
const headMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2c3a, roughness: 0.4, metalness: 0.1, emissive: 0x111122, emissiveIntensity: 0.3 });
const head = new THREE.Mesh(headGeometry, headMaterial);
head.castShadow = true;
head.position.y = 0.75;
scene.add(head);
const glowGeometry = new THREE.SphereGeometry(0.52, 32, 32);
const glowMaterial = new THREE.MeshPhongMaterial({ color: 0x88aaff, transparent: true, opacity: 0.15, side: THREE.BackSide });
const glow = new THREE.Mesh(glowGeometry, glowMaterial);
glow.position.y = 0.75;
scene.add(glow);
const shoulderGeo = new THREE.CylinderGeometry(0.55, 0.6, 0.35, 8);
const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x2a2a36, roughness: 0.6 });
const shoulders = new THREE.Mesh(shoulderGeo, shoulderMat);
shoulders.position.y = 0.4;
shoulders.castShadow = true;
scene.add(shoulders);
let targetHeadTilt = 0;
let currentHeadTilt = 0;
let targetGlowIntensity = 0.3;
let currentGlowIntensity = 0.3;
let targetBgHue = 0.6;
let currentBgHue = 0.6;
function analyzeText(text) {
    const lower = text.toLowerCase();
    let tilt = 0, glow = 0.15, hue = 0.6;
    if (lower.includes('uśmiech')) { tilt = 0.08; glow = 0.35; hue = 0.55; }
    if (lower.includes('cześć')) { tilt = 0.05; glow = 0.4; hue = 0.52; }
    return { tilt, glow, hue };
}
if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'pl-PL';
    recognition.continuous = true;
    recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript;
        const { tilt, glow, hue } = analyzeText(text);
        targetHeadTilt = tilt; targetGlowIntensity = glow; targetBgHue = hue;
        if (text.includes('cześć')) { window.speechSynthesis.speak(new SpeechSynthesisUtterance('Cześć, jestem Dartrix. Zapraszam.')); }
    };
    recognition.start();
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
    renderer.render(scene, camera);
}
animate();
