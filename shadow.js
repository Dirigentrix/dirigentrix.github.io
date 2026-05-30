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
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.zIndex = '0';
renderer.domElement.style.pointerEvents = 'none';
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

const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const messageLog = document.getElementById('messageLog');
const statusEl = document.getElementById('status');

if (chatInput) {
    chatInput.setAttribute('autocapitalize', 'off');
    chatInput.setAttribute('autocorrect', 'off');
    chatInput.setAttribute('spellcheck', 'false');
}

let targetHeadTilt = 0;
let currentHeadTilt = 0;
let targetGlowIntensity = 0.3;
let currentGlowIntensity = 0.3;
let targetBgHue = 0.6;
let currentBgHue = 0.6;
let targetPulse = 1;
let currentPulse = 1;

let micModeEnabled = false;
let micListening = false;
let speaking = false;
let introShown = false;
let recognition = null;

const micPill = document.createElement('button');
micPill.type = 'button';
micPill.id = 'mic-pill';
micPill.style.position = 'fixed';
micPill.style.left = '20px';
micPill.style.bottom = '330px';
micPill.style.zIndex = '25';
micPill.style.border = '1px solid rgba(255,255,255,0.14)';
micPill.style.borderRadius = '999px';
micPill.style.padding = '10px 14px';
micPill.style.background = 'rgba(0,0,0,0.62)';
micPill.style.color = '#dbe7ff';
micPill.style.font = 'bold 12px Courier New, monospace';
micPill.style.letterSpacing = '1px';
micPill.style.backdropFilter = 'blur(8px)';
micPill.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.2)';
micPill.style.cursor = 'pointer';
micPill.style.userSelect = 'none';
micPill.style.pointerEvents = 'auto';
document.body.appendChild(micPill);

const pulseStyle = document.createElement('style');
pulseStyle.textContent = `
@keyframes dartrixPulse {
    0% { box-shadow: 0 0 0 0 rgba(114,255,155,0.65); }
    70% { box-shadow: 0 0 0 10px rgba(114,255,155,0); }
    100% { box-shadow: 0 0 0 0 rgba(114,255,155,0); }
}
`;
document.head.appendChild(pulseStyle);

function updateStatus(text) {
    if (statusEl) statusEl.textContent = text;
}

function setMicIndicator(state, label) {
    const palette = {
        off: { border: 'rgba(255,255,255,0.14)', fill: 'rgba(0,0,0,0.62)', dot: '#7c8697', text: '#dbe7ff' },
        ready: { border: 'rgba(136,170,255,0.35)', fill: 'rgba(0,0,0,0.62)', dot: '#88aaff', text: '#dbe7ff' },
        listening: { border: 'rgba(120,255,170,0.45)', fill: 'rgba(10,35,18,0.78)', dot: '#72ff9b', text: '#d6ffe3' },
        speaking: { border: 'rgba(255,188,107,0.45)', fill: 'rgba(52,32,8,0.78)', dot: '#ffbc6b', text: '#ffe6c4' },
        error: { border: 'rgba(255,110,110,0.55)', fill: 'rgba(55,14,14,0.78)', dot: '#ff6e6e', text: '#ffd2d2' },
    };
    const p = palette[state] || palette.off;
    micPill.style.borderColor = p.border;
    micPill.style.background = p.fill;
    micPill.style.color = p.text;
    micPill.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${p.dot};margin-right:8px;vertical-align:middle;${state === 'listening' ? 'box-shadow:0 0 0 0 rgba(114,255,155,0.7);animation:dartrixPulse 1.3s infinite;' : ''}"></span>${label}`;
}

function escapeHtml(text) {
    return String(text)
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
    const labels = { user: 'Ty', voice: 'Ty (głos)', shadow: 'Dartrix', system: 'System' };
    row.innerHTML = `<strong>${labels[role] || 'Dartrix'}:</strong> ${escapeHtml(text)}`;
    messageLog.appendChild(row);
    messageLog.scrollTop = messageLog.scrollHeight;
}

function analyzeText(text) {
    const lower = text.toLowerCase();
    let tilt = 0;
    let glow = 0.16;
    let hue = 0.6;
    let pulse = 1;

    if (/(cześć|hej|witaj|dzień dobry|siema|halo)/.test(lower)) {
        tilt = 0.05;
        glow = 0.42;
        hue = 0.52;
        pulse = 1.08;
    }
    if (/(uśmiech|radość|super|świetnie|dobrze|spoko|tak|brawo)/.test(lower)) {
        tilt = 0.08;
        glow = 0.44;
        hue = 0.56;
        pulse = 1.12;
    }
    if (/(smutek|cisza|spokój|reset|wycisz|wolniej)/.test(lower)) {
        tilt = -0.03;
        glow = 0.2;
        hue = 0.62;
        pulse = 0.98;
    }
    if (/(złość|frustracja|chaos|hałas|stres|przeciąż|wkurw)/.test(lower)) {
        tilt = -0.1;
        glow = 0.54;
        hue = 0.03;
        pulse = 1.16;
    }
    if (/(orbit|orbita|powrót|wróć|na bazy|baza)/.test(lower)) {
        glow = Math.max(glow, 0.3);
        hue = 0.58;
        pulse = Math.max(pulse, 1.05);
    }
    if (/(kontur|cień|geometria|barwa|kształt)/.test(lower)) {
        glow = Math.max(glow, 0.38);
        hue = 0.54;
        pulse = Math.max(pulse, 1.06);
    }
    return { tilt, glow, hue, pulse };
}

const dartrixResponses = {
    'cześć': 'Cześć. Jestem Dartrix. Trzymam orbitę lokalnie i bez szumu.',
    'hej': 'Hej. Najpierw sygnał, potem reszta. Mów dalej.',
    'witaj': 'Witaj. Działam offline-first. Słucham uważnie.',
    'halo': 'Halo. Powiedz jeden konkretny sygnał.',
    'kim jesteś': 'Jestem Dartrix — cień, filtr i prosty interfejs do porządkowania sygnału.',
    'co potrafisz': 'Słuchać, filtrować szum, wracać do sedna i reagować geometrycznie.',
    'co robisz': 'Porządkuję sygnał. Zostawiam kontur, odrzucam hałas.',
    'kto cię stworzył': 'Daniel. Zrobił to jako DARTRIX / Cień Kartrix: lokalnie, bez śledzenia.',
    'dartrix': 'Tak, to ja. Lokalny cień do rozmowy, regulacji i powrotu na orbitę.',
    'offline': 'Offline-first znaczy: najpierw działa lokalnie, dopiero potem rozszerza orbitę.',
    'zero-tracking': 'Zero-tracking to nie slogan. To warstwa spokoju dla użytkownika.',
    'szum': 'Szum jest tylko tłem. Filtr ustawiony — zostaje sygnał.',
    'cisza': 'Cisza też jest odpowiedzią. W niej widać kontur.',
    'kontur': 'Kontur jest ważniejszy niż detal. Najpierw forma, potem doprecyzowanie.',
    'cień': 'Cień nie udaje człowieka. On pokazuje napięcie, kierunek i barwę.',
    'orbit': 'Wracamy na orbitę jednym krokiem. Mikrokrok jest ważniejszy niż plan paraliżu.',
    'orbita': 'Orbita stabilizuje ruch. Najpierw mały krok, potem korekta.',
    'mikrokrok': 'Mikrokrok działa. To jest tryb odzyskiwania kontroli.',
    'body map': 'Body map ma pokazać napięcie bez udawania. Tylko mapa, nie maska.',
    'mapa ciała': 'Mapa ciała ma służyć regulacji. Kontur, nacisk, powrót.',
    'flow engine': 'Flow engine ma prowadzić powrót: impuls, filtr, odpowiedź, stabilizacja.',
    'vision': 'Wizja bez działania rozprasza. Wizja z rytmem daje orbitę.',
    'polarizacja': 'Polarizacja to filtr — oddziela to, co ważne, od tego co tylko głośne.',
    'frustracja': 'Frustracja jest sygnałem przeciążenia. Zmniejsz bodźce i wróć do bazy.',
    'złość': 'Złość to energia. Nie musisz jej tłumić — wystarczy ją przekierować.',
    'spokój': 'Spokój nie zatrzymuje działania. On je porządkuje.',
    'powrót': 'Powrót nie jest porażką. To korekta kursu.',
    'ram': 'Mało RAM-u nie blokuje sensu. Wymusza prostotę.',
    'samsung': 'Tak. Na słabszym sprzęcie prostota jest zaletą, nie ograniczeniem.',
    'lego': 'Lego to rytm mikrokroków: kolor, liczba, pozycja, sukces.',
    'franek': 'Franek ma język ruchu. Tam działają klocki, rytm i prosty feedback.',
    'działanie': 'Działanie > gadanie. Najpierw ruch, potem komentarz.',
    'thought': 'Myśl bez formy też jest sygnałem. Zbierz ją w jeden krok.',
    'default': [
        'Słyszę cię. Zostań przy tym, co najprostsze.',
        'Wrzuć jeden konkret. Resztę odfiltruję.',
        'Nie rozdmuchuję sygnału. Trzymam prostą odpowiedź.',
        'Możemy zejść do mikrokroku i zobaczyć, co zostaje.',
        'Mów dalej. Szukam konturu, nie hałasu.',
        'Jeden fakt wystarczy, żeby ruszyć orbitę.',
        'Jeśli chcesz, możemy wejść w body map, flow engine albo feedback po bodźcu.'
    ]
};

function getDartrixReply(userText) {
    const lower = userText.toLowerCase();
    for (const [key, reply] of Object.entries(dartrixResponses)) {
        if (key === 'default') continue;
        if (lower.includes(key)) {
            return Array.isArray(reply) ? reply[Math.floor(Math.random() * reply.length)] : reply;
        }
    }
    const defaults = dartrixResponses.default;
    return defaults[Math.floor(Math.random() * defaults.length)];
}

function applyReaction(text) {
    const { tilt, glow, hue, pulse } = analyzeText(text);
    targetHeadTilt = tilt;
    targetGlowIntensity = glow;
    targetBgHue = hue;
    targetPulse = pulse;
}

function setMicVisualState(state) {
    if (state === 'off') {
        setMicIndicator('off', 'MIC OFF');
        updateStatus('offline-first • zero-tracking • mic off');
    } else if (state === 'ready') {
        setMicIndicator('ready', 'MIC READY');
        updateStatus('offline-first • zero-tracking • mic ready');
    } else if (state === 'listening') {
        setMicIndicator('listening', 'MIC LISTENING');
        updateStatus('offline-first • zero-tracking • listening');
    } else if (state === 'speaking') {
        setMicIndicator('speaking', 'DARTRIX MÓWI');
        updateStatus('offline-first • zero-tracking • speaking');
    } else if (state === 'error') {
        setMicIndicator('error', 'MIC ERROR');
        updateStatus('offline-first • zero-tracking • mic error');
    }
}

function startListening() {
    if (!recognition || micListening) return;
    try {
        micModeEnabled = true;
        recognition.start();
    } catch {
        setMicVisualState('error');
    }
}

function stopListening() {
    if (!recognition) return;
    try {
        recognition.stop();
    } catch {
        // ignore
    }
}

function toggleMic() {
    if (!recognition) return;
    if (micListening) {
        micModeEnabled = false;
        stopListening();
        setMicVisualState('off');
        return;
    }
    micModeEnabled = true;
    startListening();
}

function speakReply(text) {
    if (!('speechSynthesis' in window) || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pl-PL';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => {
        speaking = true;
        setMicVisualState('speaking');
        if (micListening) stopListening();
    };
    utterance.onend = () => {
        speaking = false;
        setMicVisualState(micModeEnabled ? 'ready' : 'off');
    };
    utterance.onerror = () => {
        speaking = false;
        setMicVisualState(micModeEnabled ? 'ready' : 'off');
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

function handleConversation(text, source = 'user', shouldSpeak = true) {
    const clean = String(text || '').trim();
    if (!clean) return;

    addMessage(source, clean);
    applyReaction(clean);

    const reply = getDartrixReply(clean);
    addMessage('shadow', reply);

    if (shouldSpeak) {
        speakReply(reply);
    }
}

function ensureIntro() {
    if (introShown) return;
    introShown = true;
    addMessage('system', 'DARTRIX CHAT v1.1+ aktywny. Mic działa ręcznie i pokazuje realny stan nasłuchu.');
    addMessage('shadow', 'Cześć. Jestem Dartrix. Działam lokalnie. Napisz albo naciśnij mikrofon, gdy chcesz mówić.');
}

function handleVoiceResult(transcript) {
    const clean = String(transcript || '').trim();
    if (!clean) return;
    handleConversation(clean, 'voice', true);
}

function createRecognition() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
        micModeEnabled = false;
        setMicVisualState('off');
        if (micPill) micPill.disabled = true;
        return null;
    }

    const rec = new SpeechRecognitionCtor();
    rec.lang = 'pl-PL';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
        micListening = true;
        setMicVisualState('listening');
    };

    rec.onresult = (event) => {
        const result = event.results?.[event.results.length - 1];
        const transcript = result?.[0]?.transcript || '';
        if (result?.isFinal && transcript.trim()) {
            handleVoiceResult(transcript);
        }
    };

    rec.onerror = () => {
        micListening = false;
        micModeEnabled = false;
        setMicVisualState('error');
    };

    rec.onend = () => {
        micListening = false;
        if (speaking) {
            return;
        }
        setMicVisualState(micModeEnabled ? 'ready' : 'off');
    };

    return rec;
}

recognition = createRecognition();

if (micPill) {
    micPill.addEventListener('click', () => {
        if (!recognition) return;
        toggleMic();
    });
}

if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = chatInput.value;
        chatInput.value = '';
        const clean = String(text || '').trim();
        if (!clean) return;
        handleConversation(clean, 'user', true);
    });
}

setMicVisualState('off');
ensureIntro();

if (chatInput) {
    chatInput.addEventListener('focus', () => {
        applyReaction('kontur cichy');
    });
}

function animate() {
    requestAnimationFrame(animate);

    currentHeadTilt += (targetHeadTilt - currentHeadTilt) * 0.12;
    head.rotation.z = currentHeadTilt;
    head.rotation.x = Math.sin(performance.now() * 0.0006) * 0.02;

    currentGlowIntensity += (targetGlowIntensity - currentGlowIntensity) * 0.08;
    glowMaterial.opacity = 0.1 + currentGlowIntensity * 0.3;

    currentBgHue += (targetBgHue - currentBgHue) * 0.02;
    scene.background = new THREE.Color().setHSL(currentBgHue, 0.7, 0.08);

    currentPulse += (targetPulse - currentPulse) * 0.06;
    const scale = 1 + (currentPulse - 1) * 0.06;
    head.scale.setScalar(scale);
    glow.scale.setScalar(scale * 1.02);
    shoulders.scale.setScalar(1 + (currentPulse - 1) * 0.03);
    shoulders.rotation.y = Math.sin(performance.now() * 0.0004) * 0.015;

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
