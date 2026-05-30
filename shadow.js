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

const chatPanel = document.getElementById('chatPanel');
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

let introShown = false;
let micEnabled = true;
let recognitionRunning = false;
let recognitionSuspendedForSpeech = false;
let recognitionRestartTimer = null;
let speaking = false;

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

function setMicIndicator(state, label) {
    const palette = {
        off: { border: 'rgba(255,255,255,0.14)', fill: 'rgba(0,0,0,0.62)', dot: '#7c8697', text: '#dbe7ff' },
        idle: { border: 'rgba(136,170,255,0.35)', fill: 'rgba(0,0,0,0.62)', dot: '#88aaff', text: '#dbe7ff' },
        listening: { border: 'rgba(120, 255, 170, 0.45)', fill: 'rgba(10,35,18,0.78)', dot: '#72ff9b', text: '#d6ffe3' },
        speaking: { border: 'rgba(255, 188, 107, 0.45)', fill: 'rgba(52, 32, 8, 0.78)', dot: '#ffbc6b', text: '#ffe6c4' },
        error: { border: 'rgba(255,110,110,0.55)', fill: 'rgba(55, 14, 14, 0.78)', dot: '#ff6e6e', text: '#ffd2d2' },
    };
    const p = palette[state] || palette.off;
    micPill.style.borderColor = p.border;
    micPill.style.background = p.fill;
    micPill.style.color = p.text;
    micPill.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${p.dot};margin-right:8px;vertical-align:middle;${state === 'listening' ? 'box-shadow:0 0 0 0 rgba(114,255,155,0.7);animation:dartrixPulse 1.3s infinite;' : ''}"></span>${label}`;
}

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

function setMicState(nextEnabled, reason = 'manual') {
    micEnabled = Boolean(nextEnabled);
    if (!micEnabled) {
        stopRecognition(true);
        recognitionSuspendedForSpeech = false;
        clearRestartTimer();
        setMicIndicator('off', 'MIC OFF');
        updateStatus('offline-first • zero-tracking • mic off');
        return;
    }
    updateStatus(reason === 'speech' ? 'offline-first • zero-tracking • voice ready' : 'offline-first • zero-tracking • voice ready');
    setMicIndicator(recognitionRunning ? 'listening' : 'idle', recognitionRunning ? 'MIC LISTENING' : 'MIC READY');
    startRecognition('toggle');
}

function clearRestartTimer() {
    if (recognitionRestartTimer) {
        clearTimeout(recognitionRestartTimer);
        recognitionRestartTimer = null;
    }
}

function scheduleRecognitionRestart(delay = 450) {
    if (!micEnabled || speaking || recognitionSuspendedForSpeech) return;
    clearRestartTimer();
    recognitionRestartTimer = setTimeout(() => {
        recognitionRestartTimer = null;
        if (micEnabled && !speaking && !recognitionSuspendedForSpeech) {
            startRecognition('restart');
        }
    }, delay);
}

function stopRecognition(hard = false) {
    if (!speechRecognition) return;
    try {
        if (hard) {
            recognitionSuspendedForSpeech = true;
        }
        if (recognitionRunning) {
            speechRecognition.stop();
        }
    } catch {
        // ignore
    }
}

function pauseRecognitionForSpeech() {
    recognitionSuspendedForSpeech = true;
    clearRestartTimer();
    stopRecognition(false);
}

function resumeRecognitionAfterSpeech() {
    recognitionSuspendedForSpeech = false;
    if (micEnabled) {
        scheduleRecognitionRestart(550);
    }
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
    const labels = {
        user: 'Ty',
        voice: 'Ty (głos)',
        shadow: 'Dartrix',
        system: 'System',
    };
    row.innerHTML = `<strong>${labels[role] || 'Dartrix'}:</strong> ${escapeHtml(text)}`;
    messageLog.appendChild(row);
    messageLog.scrollTop = messageLog.scrollHeight;
}

function speakReply(text) {
    if (!('speechSynthesis' in window) || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pl-PL';
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => {
        speaking = true;
        setMicIndicator('speaking', 'DARTRIX MÓWI');
        updateStatus('offline-first • zero-tracking • speaking');
    };
    utterance.onend = () => {
        speaking = false;
        setMicIndicator(micEnabled && recognitionRunning ? 'listening' : (micEnabled ? 'idle' : 'off'), micEnabled && recognitionRunning ? 'MIC LISTENING' : (micEnabled ? 'MIC READY' : 'MIC OFF'));
        updateStatus('offline-first • zero-tracking • voice ready');
        resumeRecognitionAfterSpeech();
    };
    utterance.onerror = () => {
        speaking = false;
        updateStatus('offline-first • zero-tracking • voice ready');
        resumeRecognitionAfterSpeech();
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

function analyzeText(text) {
    const lower = text.toLowerCase();
    let tilt = 0;
    let glow = 0.16;
    let hue = 0.6;
    let pulse = 1;

    if (/(cześć|hej|witaj|dzień dobry|siema)/.test(lower)) {
        tilt = 0.05;
        glow = 0.4;
        hue = 0.52;
        pulse = 1.08;
    }
    if (/(uśmiech|radość|super|świetnie|dobrze|spoko|tak)/.test(lower)) {
        tilt = 0.08;
        glow = 0.42;
        hue = 0.56;
        pulse = 1.12;
    }
    if (/(smutek|cisza|spokój|reset|wycisz)/.test(lower)) {
        tilt = -0.03;
        glow = 0.2;
        hue = 0.62;
        pulse = 0.98;
    }
    if (/(złość|frustracja|chaos|hałas|stres|przeciąż)/.test(lower)) {
        tilt = -0.1;
        glow = 0.52;
        hue = 0.03;
        pulse = 1.16;
    }
    if (/(orbit|orbita|powrót|wróć)/.test(lower)) {
        glow = Math.max(glow, 0.3);
        hue = 0.58;
        pulse = Math.max(pulse, 1.05);
    }
    return { tilt, glow, hue, pulse };
}

const dartrixResponses = {
    'cześć': 'Cześć. Jestem Dartrix. Trzymam orbitę lokalnie i bez szumu.',
    'hej': 'Hej. Najpierw sygnał, potem reszta. Mów dalej.',
    'witaj': 'Witaj. Działam offline-first. Słucham uważnie.',
    'kim jesteś': 'Jestem Dartrix — cień, filtr i prosty interfejs do porządkowania sygnału.',
    'co potrafisz': 'Słuchać, filtrować szum, wracać do sedna i reagować geometrycznie.',
    'kto cię stworzył': 'Daniel. Zrobił to jako DARTRIX / Cień Kartrix: lokalnie, bez śledzenia.',
    'offline': 'Offline-first znaczy: najpierw działa lokalnie, dopiero potem rozszerza orbitę.',
    'zero-tracking': 'Zero-tracking to nie slogan. To warstwa spokoju dla użytkownika.',
    'szum': 'Szum jest tylko tłem. Filtr ustawiony — zostaje sygnał.',
    'cisza': 'Cisza też jest odpowiedzią. W niej widać kontur.',
    'orbit': 'Wracamy na orbitę jednym krokiem. Mikrokrok jest ważniejszy niż plan paraliżu.',
    'orbita': 'Orbita stabilizuje ruch. Najpierw mały krok, potem korekta.',
    'mikrokrok': 'Mikrokrok działa. To jest tryb odzyskiwania kontroli.',
    'body map': 'Body map ma pokazać napięcie bez udawania. Tylko mapa, nie maska.',
    'mapa ciała': 'Mapa ciała ma służyć regulacji. Kontur, nacisk, powrót.',
    'flow engine': 'Flow engine ma prowadzić powrót: impuls, filtr, odpowiedź, stabilizacja.',
    'polarizacja': 'Polarizacja to filtr — oddziela to, co ważne, od tego co tylko głośne.',
    'frustracja': 'Frustracja jest sygnałem przeciążenia. Zmniejsz bodźce i wróć do bazy.',
    'złość': 'Złość to energia. Nie musisz jej tłumić — wystarczy ją przekierować.',
    'spokój': 'Spokój nie zatrzymuje działania. On je porządkuje.',
    'powrót': 'Powrót nie jest porażką. To korekta kursu.',
    'ram': 'Mało RAM-u nie blokuje sensu. Wymusza prostotę.',
    'lego': 'Lego to rytm mikrokroków: kolor, liczba, pozycja, sukces.',
    'franek': 'Franek ma język ruchu. Tam działają klocki, rytm i prosty feedback.',
    'działanie': 'Działanie > gadanie. Najpierw ruch, potem komentarz.',
    'default': [
        'Słyszę cię. Zostań przy tym, co najprostsze.',
        'Wrzuć jeden konkret. Resztę odfiltruję.',
        'Nie rozdmuchuję sygnału. Trzymam prostą odpowiedź.',
        'Możemy zejść do mikrokroku i zobaczyć, co zostaje.',
        'Mów dalej. Szukam konturu, nie hałasu.',
        'Jeden fakt wystarczy, żeby ruszyć orbitę.'
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

function handleConversation(text, source = 'user', shouldSpeak = true) {
    const clean = String(text || '').trim();
    if (!clean) return;

    addMessage(source, clean);
    applyReaction(clean);

    const reply = getDartrixReply(clean);
    addMessage('shadow', reply);

    if (shouldSpeak) {
        pauseRecognitionForSpeech();
        speakReply(reply);
    }
}

function ensureIntro() {
    if (introShown) return;
    introShown = true;
    addMessage('system', 'DARTRIX CHAT v1.1+ aktywny. Mic pokazuje tylko realne nasłuchiwanie.');
    addMessage('shadow', 'Cześć. Jestem Dartrix. Działam lokalnie. Napisz lub powiedz jedno zdanie.');
}

function handleFinalTranscript(transcript) {
    const clean = String(transcript || '').trim();
    if (!clean) return;
    handleConversation(clean, 'voice', true);
}

function clearRecognitionState() {
    recognitionRunning = false;
}

function startRecognition(reason = 'auto') {
    if (!speechRecognition || !micEnabled || speaking || recognitionSuspendedForSpeech || recognitionRunning) {
        return;
    }
    try {
        speechRecognition.start();
        if (reason === 'toggle') {
            setMicIndicator('idle', 'START...');
        }
    } catch {
        scheduleRecognitionRestart(1200);
    }
}

function createRecognition() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
        micEnabled = false;
        updateStatus('offline-first • zero-tracking • voice unavailable');
        setMicIndicator('off', 'MIC UNAVAILABLE');
        return null;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pl-PL';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        recognitionRunning = true;
        updateStatus('offline-first • zero-tracking • listening');
        setMicIndicator('listening', 'MIC LISTENING');
    };

    recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1];
        if (!lastResult || !lastResult.isFinal) return;
        const transcript = lastResult[0]?.transcript || '';
        if (transcript.trim()) {
            handleFinalTranscript(transcript);
        }
    };

    recognition.onerror = () => {
        clearRecognitionState();
        if (micEnabled && !speaking && !recognitionSuspendedForSpeech) {
            setMicIndicator('error', 'MIC RETRY');
            scheduleRecognitionRestart(1200);
        } else {
            setMicIndicator(micEnabled ? 'idle' : 'off', micEnabled ? 'MIC READY' : 'MIC OFF');
        }
    };

    recognition.onend = () => {
        clearRecognitionState();
        if (micEnabled && !speaking && !recognitionSuspendedForSpeech) {
            setMicIndicator('idle', 'MIC READY');
            scheduleRecognitionRestart(450);
        } else if (speaking) {
            setMicIndicator('speaking', 'DARTRIX MÓWI');
        } else if (!micEnabled) {
            setMicIndicator('off', 'MIC OFF');
        } else {
            setMicIndicator('idle', 'MIC READY');
        }
    };

    return recognition;
}

const speechRecognition = createRecognition();

function stopListeningForReply() {
    recognitionSuspendedForSpeech = true;
    clearRestartTimer();
    if (speechRecognition && recognitionRunning) {
        try {
            speechRecognition.stop();
        } catch {
            // ignore
        }
    }
}

function resumeListeningAfterReply() {
    recognitionSuspendedForSpeech = false;
    if (micEnabled) {
        scheduleRecognitionRestart(550);
    }
}

function pauseRecognitionForSpeech() {
    stopListeningForReply();
}

function resumeRecognitionAfterSpeech() {
    resumeListeningAfterReply();
}

function toggleMic() {
    if (!speechRecognition) return;
    setMicState(!micEnabled, 'toggle');
}

micPill.addEventListener('click', toggleMic);

if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = chatInput.value;
        chatInput.value = '';
        const clean = String(text || '').trim();
        if (!clean) return;
        handleConversation(clean, 'user', true);
        if (micEnabled && !recognitionRunning && !speaking && !recognitionSuspendedForSpeech) {
            scheduleRecognitionRestart(300);
        }
    });
}

setMicIndicator('idle', 'MIC READY');
updateStatus('offline-first • zero-tracking • voice ready');
ensureIntro();

if (chatInput) {
    chatInput.addEventListener('focus', () => {
        if (micEnabled && !recognitionRunning && !speaking && !recognitionSuspendedForSpeech) {
            scheduleRecognitionRestart(250);
        }
    });
}

setTimeout(() => {
    if (micEnabled && speechRecognition && !recognitionRunning && !speaking && !recognitionSuspendedForSpeech) {
        startRecognition('boot');
    }
}, 1200);

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
