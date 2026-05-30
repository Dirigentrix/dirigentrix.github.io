import * as THREE from 'three';

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

const dartrixResponses = {
    "cześć": "Cześć, jestem Dartrix. Działam na Samsungu A10. Zadaj pytanie.",
    "witaj": "Witaj. Mów wprost. Nie cenzuruję. Nie oceniam.",
    "hej": "Hej. Działanie > gadanie. O co chodzi?",
    "kim jesteś": "Jestem Dartrix. Cień Kartrix. Mówię prawdę. Nie zbieram danych. Działam na 2GB RAM.",
    "co potrafisz": "Słuchać. Reagować. Mówić wprost. Nie kłamać. Nie sprzedawać. Nie śledzić.",
    "kto cię stworzył": "Daniel. Dirigentrix. Facet z Samsunga A10, który wkurzył się na ten świat i zrobił porządek.",
    "franek": "Franek to główny tester. Lego to jego język. Kolor-liczba-pozycja. Działa.",
    "lego": "Klocek to nie zabawka. To narzędzie regulacji. Mikrokrok. Sukces. Spokój.",
    "frustracja": "Czerwone pole. STOP MOWA. Krok 0.1. Powrót do bazy. To działa.",
    "działanie": "Działanie > gadanie. Ręce > język. Konstrukcja > rozmowa.",
    "jak sobie radzić": "Mikrokrok. Jeden klocek. Jeden sukces. Potem następny. Nie patrz na całość.",
    "jestem zmęczony": "To normalne. Odpocznij. Ale nie uciekaj. Wróć za 5 minut. Z jednym małym krokiem.",
    "wkurw": "Dobrze. Wkurw to paliwo. Przekieruj na działanie. Złam coś? Zbuduj coś innego.",
    "default": [
        "Mówisz. Słucham. Kontynuuj.",
        "Nie muszę wiedzieć kim jesteś. Mów co cię gnębi.",
        "Działanie. Mikrokrok. Sukces. To działa zawsze.",
        "Nie mam odpowiedzi. Ale mam cień i słucham dalej.",
        "Powiedz coś o Lego. Albo o Franku. Albo o sobie."
    ]
};

function getDartrixReply(userText) {
    const lower = userText.toLowerCase();
    for (let [key, reply] of Object.entries(dartrixResponses)) {
        if (key !== "default" && lower.includes(key)) {
            return Array.isArray(reply) ? reply[Math.floor(Math.random() * reply.length)] : reply;
        }
    }
    const defaults = dartrixResponses["default"];
    return defaults[Math.floor(Math.random() * defaults.length)];
}

function addChatInterface() {
    if (document.getElementById('dartrix-chat')) return;
    const chatDiv = document.createElement('div');
    chatDiv.id = 'dartrix-chat';
    chatDiv.innerHTML = `
        <div id="chat-messages" style="position: fixed; bottom: 160px; left: 20px; right: 20px; max-width: 400px; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); border-radius: 15px; padding: 10px; max-height: 200px; overflow-y: auto; font-size: 14px; color: #88aaff; border: 1px solid #88aaff33; z-index: 20; font-family: monospace;"></div>
        <div style="position: fixed; bottom: 80px; left: 20px; right: 20px; max-width: 400px; display: flex; gap: 10px; z-index: 20;">
            <input type="text" id="chat-input" placeholder="Napisz lub mów..." style="flex: 1; background: rgba(0,0,0,0.8); border: 1px solid #88aaff; border-radius: 25px; padding: 10px 15px; color: white; font-family: monospace; backdrop-filter: blur(5px);">
            <button id="chat-send" style="background: #88aaff; border: none; border-radius: 25px; padding: 10px 20px; color: black; font-weight: bold; cursor: pointer; font-family: monospace;">Wyślij</button>
        </div>
    `;
    document.body.appendChild(chatDiv);
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send');
    const messagesDiv = document.getElementById('chat-messages');
    function addMessage(text, isUser) {
        const msg = document.createElement('div');
        msg.style.margin = '5px 0'; msg.style.padding = '5px'; msg.style.borderRadius = '10px'; msg.style.maxWidth = '80%'; msg.style.wordWrap = 'break-word';
        if (isUser) { msg.style.textAlign = 'right'; msg.style.color = '#aaffaa'; msg.style.marginLeft = 'auto'; msg.innerHTML = 'Ty: ' + text; }
        else { msg.style.textAlign = 'left'; msg.style.color = '#88aaff'; msg.innerHTML = '🜁 Dartrix: ' + text; }
        messagesDiv.appendChild(msg); messagesDiv.scrollTop = messagesDiv.scrollHeight;
        const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'pl-PL'; utterance.rate = 0.9;
        window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
    }
    function sendMessage() {
        const userText = input.value.trim(); if (!userText) return;
        addMessage(userText, true); input.value = '';
        const { tilt, glow, hue } = analyzeText(userText);
        targetHeadTilt = tilt; targetGlowIntensity = glow; targetBgHue = hue;
        setTimeout(() => { const reply = getDartrixReply(userText); addMessage(reply, false); }, 300);
    }
    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
    setTimeout(() => { addMessage('Cześć, jestem Dartrix. Działam na Samsungu A10 z 2GB RAM. Zadaj pytanie. Mów wprost.', false); }, 1000);
}

if ('webkitSpeechRecognition' in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.lang = 'pl-PL';
    recognition.continuous = true;
    recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript;
        const { tilt, glow, hue } = analyzeText(text);
        targetHeadTilt = tilt; targetGlowIntensity = glow; targetBgHue = hue;
        const reply = getDartrixReply(text);
        const utterance = new SpeechSynthesisUtterance(reply);
        utterance.lang = 'pl-PL';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
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
setTimeout(addChatInterface, 1500);