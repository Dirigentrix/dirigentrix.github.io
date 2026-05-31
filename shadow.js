import * as THREE from 'three';

// --- SCENA ---
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

// --- OŚWIETLENIE ---
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

// --- KONTUR GŁOWY ---
const headGeometry = new THREE.SphereGeometry(0.45, 64, 64);
const headMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2c3a,
    roughness: 0.4,
    metalness: 0.1,
    emissive: 0x111122,
    emissiveIntensity: 0.3
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
    side: THREE.BackSide
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

// --- ZMIENNE DO ANIMACJI ---
let targetHeadTilt = 0;
let currentHeadTilt = 0;
let targetGlowIntensity = 0.3;
let currentGlowIntensity = 0.3;
let targetBgHue = 0.6;
let currentBgHue = 0.6;

// --- LOGIKA ODPOWIEDZI ---
function getDartrixReply(tekst) {
    const t = tekst.toLowerCase();
    if (t.includes('cześć') || t.includes('witaj') || t.includes('hej')) 
        return "Cześć, jestem Dartrix. Mów wprost. O co chodzi?";
    if (t.includes('jak się masz')) 
        return "Działam. Mam 2GB RAM i cień. To wystarczy.";
    if (t.includes('kim jesteś')) 
        return "Jestem Dartrix. Cień Kartrix. Nie zbieram danych. Nie kłamię. Działam na Samsungu A10.";
    if (t.includes('co potrafisz')) 
        return "Słuchać. Reagować. Mówić prawdę. Nie sprzedawać. Nie śledzić.";
    if (t.includes('kto cię stworzył')) 
        return "Daniel. Dirigentrix. Facet, który wkurzył się na ten świat i zrobił porządek.";
    if (t.includes('franek')) 
        return "Franek to główny tester. Lego to jego język. Kolor, liczba, pozycja. To działa.";
    if (t.includes('lego')) 
        return "Klocek to narzędzie regulacji. Mikrokrok. Sukces. Spokój. Działa za każdym razem.";
    if (t.includes('frustracja')) 
        return "Czerwone pole. Stop mowa. Krok 0.1. Powrót do kolor-liczba-pozycja.";
    if (t.includes('działanie')) 
        return "Działanie > gadanie. Ręce > język. Konstrukcja > rozmowa. To jest Kartrix.";
    if (t.includes('wkurw') || t.includes('zły')) 
        return "Wkurw to paliwo. Przekieruj na działanie. Zbuduj coś. Zepsuj coś. Ale działaj.";
    if (t.includes('smutny') || t.includes('zmęczony')) 
        return "Normalne. Odpocznij 5 minut. Potem jeden mały krok. Tylko jeden.";
    if (t.includes('jak sobie radzić')) 
        return "Mikrokrok. Jeden klocek. Jeden sukces. Potem następny. Nie patrz na całość.";
    return "Mówisz. Słucham. Powiedz coś o Lego, Franku, albo o tym co cię gnębi.";
}

// --- INTERFEJS (POPRAWIONY) ---
function addChat() {
    if (document.getElementById('dartrix-chat')) return;
    
    const chatDiv = document.createElement('div');
    chatDiv.id = 'dartrix-chat';
    chatDiv.innerHTML = `
        <div id="chat-messages" style="
            position: fixed; bottom: 180px; left: 20px; right: 20px;
            max-width: 400px; background: rgba(0,0,0,0.85);
            backdrop-filter: blur(10px); border-radius: 15px; padding: 10px;
            max-height: 200px; overflow-y: auto; font-size: 14px;
            color: #88aaff; border: 1px solid #88aaff33; z-index: 20;
            font-family: monospace;
        "></div>
        <div style="position: fixed; bottom: 100px; left: 20px; right: 20px;
            max-width: 400px; display: flex; gap: 10px; z-index: 20;">
            <input type="text" id="chat-input" placeholder="Napisz..." style="
                flex: 1; background: rgba(0,0,0,0.85); border: 1px solid #88aaff;
                border-radius: 25px; padding: 10px 15px; color: white;
                font-family: monospace;
            ">
            <button id="chat-send" style="
                background: #88aaff; border: none; border-radius: 25px;
                padding: 10px 20px; color: black; font-weight: bold; cursor: pointer;
            ">Wyślij</button>
        </div>
        <button id="microphone-btn" style="
            position: fixed; bottom: 20px; left: 20px;
            background: #ff6688; border: none; border-radius: 50px;
            padding: 10px 20px; color: white; font-weight: bold; cursor: pointer;
            z-index: 20; font-family: monospace;
        ">🎤 Mów</button>
    `;
    document.body.appendChild(chatDiv);
    
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const messagesDiv = document.getElementById('chat-messages');
    const micBtn = document.getElementById('microphone-btn');
    
    function addMessage(text, isUser) {
        const msg = document.createElement('div');
        msg.style.margin = '5px 0';
        msg.style.padding = '5px';
        msg.style.borderRadius = '10px';
        msg.style.wordWrap = 'break-word';
        if (isUser) {
            msg.style.textAlign = 'right';
            msg.style.color = '#aaffaa';
            msg.innerHTML = `Ty: ${text}`;
        } else {
            msg.style.textAlign = 'left';
            msg.style.color = '#88aaff';
            msg.innerHTML = `🜁 Dartrix: ${text}`;
        }
        messagesDiv.appendChild(msg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pl-PL';
        utterance.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }
    
    function sendMessage(text) {
        if (!text.trim()) return;
        addMessage(text, true);
        
        const t = text.toLowerCase();
        if (t.includes('cześć') || t.includes('witaj')) targetHeadTilt = 0.1;
        else if (t.includes('wkurw')) targetHeadTilt = -0.1;
        else targetHeadTilt = 0.05;
        targetGlowIntensity = 0.4;
        setTimeout(() => { targetHeadTilt = 0; targetGlowIntensity = 0.3; }, 800);
        
        const reply = getDartrixReply(text);
        setTimeout(() => addMessage(reply, false), 200);
    }
    
    sendBtn.onclick = () => { sendMessage(input.value); input.value = ''; };
    input.onkeypress = (e) => { if (e.key === 'Enter') { sendMessage(input.value); input.value = ''; } };
    
    micBtn.onclick = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            addMessage("Brak wsparcia dla mikrofonu.", false);
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'pl-PL';
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript;
            input.value = text;
            sendMessage(text);
        };
        recognition.start();
        addMessage("🎤 Nasłuchuję...", false);
    };
    
    setTimeout(() => {
        addMessage("Cześć, jestem Dartrix. Działam na Samsungu A10. Napisz lub kliknij mikrofon i mów.", false);
    }, 500);
}

// --- ANIMACJA ---
function animate() {
    requestAnimationFrame(animate);
    currentHeadTilt += (targetHeadTilt - currentHeadTilt) * 0.12;
    head.rotation.z = currentHeadTilt;
    currentGlowIntensity += (targetGlowIntensity - currentGlowIntensity) * 0.08;
    glowMaterial.opacity = 0.1 + currentGlowIntensity * 0.3;
    currentBgHue += (targetBgHue - currentBgHue) * 0.02;
    scene.background.setHSL(currentBgHue, 0.7, 0.08);
    renderer.render(scene, camera);
}
animate();
addChat();