import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, onChildAdded, off } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
// Добавляем auth
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDanduCPw3SYiYpSOpLUoGtgjVI3ftg0PQ",
    authDomain: "testradeyka.firebaseapp.com",
    databaseURL: "https://testradeyka-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "testradeyka",
    storageBucket: "testradeyka.appspot.com",
    messagingSenderId: "727422013406",
    appId: "1:727422013406:web:2c1dbdedbb2bceeffd74f",
    measurementId: "G-MCVDS9V931"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app); // Инициализация Auth
const provider = new GoogleAuthProvider(); // Провайдер Google

const regContainer = document.getElementById('regContainer');
const regBtn = document.getElementById('reg');
const radioSidebar = document.getElementById('radioSidebar');
const toggleButton = document.getElementById('toggleButton');
const chatContainer = document.getElementById('chatContainer');
const freq1Display = document.getElementById('freq1');
const freq2Display = document.getElementById('freq2');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');

let currentUser = null; 
let currentFreq1 = 0;
let currentFreq2 = 0;
let userRef = null;
let activeUsersUnsubscribe = null;
let messagesUnsubscribe = null;

// --- Логика входа ---
regBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch((error) => console.error(error));
});

// Отслеживание состояния входа
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Юзер вошел
        currentUser = user.displayName || user.uid; // Используем имя или UID
        regContainer.style.display = 'none';
        radioSidebar.classList.add('open');
        toggleButton.textContent = '<';
        
        userRef = ref(db, 'online_users/' + user.uid); // Используем UID для уникальности
        setupRadio();
    } else {
        // Юзер вышел
        regContainer.style.display = 'flex';
        radioSidebar.classList.remove('open');
    }
});

toggleButton.addEventListener('click', () => {
    radioSidebar.classList.toggle('open');
    toggleButton.textContent = radioSidebar.classList.contains('open') ? '<' : '>';
});

// --- Остальная логика (setupRadio, updateFrequencyOnServer, initChat) без изменений ---
function setupRadio() {
    setupKnob(document.getElementById('knob1'), true);
    setupKnob(document.getElementById('knob2'), false);
}

function setupKnob(knobElement, isFirstFreq) {
    let currentValue = 0;
    let isPressed = false;

    knobElement.addEventListener('mousedown', (e) => { isPressed = true; e.preventDefault(); });
    window.addEventListener('mouseup', () => { isPressed = false; });

    window.addEventListener('wheel', (e) => {
        if (!isPressed) return;
        e.preventDefault();
        const delta = Math.sign(e.deltaY);
        if (delta > 0 && currentValue > 0) currentValue--;
        else if (delta < 0 && currentValue < 12) currentValue++;
        applyRotation();
    }, { passive: false });

    let startY = 0;
    knobElement.addEventListener('touchstart', (e) => {
        isPressed = true;
        startY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchend', () => { isPressed = false; });

    window.addEventListener('touchmove', (e) => {
        if (!isPressed) return;
        let currentY = e.touches[0].clientY;
        let deltaY = startY - currentY;
        if (Math.abs(deltaY) > 15) {
            if (deltaY > 0 && currentValue < 12) currentValue++;
            else if (deltaY < 0 && currentValue > 0) currentValue--;
            startY = currentY;
            applyRotation();
        }
    }, { passive: true });

    function applyRotation() {
        knobElement.style.transform = `translate(-50%, -50%) rotate(${currentValue * 30}deg)`;
        if (isFirstFreq) currentFreq1 = currentValue;
        else currentFreq2 = currentValue;
        updateFrequencyOnServer();
    }
}

function updateFrequencyOnServer() {
    freq1Display.textContent = currentFreq1.toString().padStart(2, '0');
    freq2Display.textContent = currentFreq2.toString().padStart(2, '0');
    const combinedFreq = `${currentFreq1}:${currentFreq2}`;

    set(userRef, {
        name: currentUser,
        frequency: combinedFreq,
        lastActive: Date.now()
    });

    if (activeUsersUnsubscribe) activeUsersUnsubscribe(); 
    
    const usersRef = ref(db, 'online_users');
    activeUsersUnsubscribe = onValue(usersRef, (snapshot) => {
        const users = snapshot.val();
        if (!users) return;
        let usersOnSameFreq = 0;
        for (let userKey in users) {
            if (users[userKey].frequency === combinedFreq) usersOnSameFreq++;
        }
        if (usersOnSameFreq >= 2) {
            chatContainer.classList.remove('hidden');
            initChat(combinedFreq);
        } else {
            chatContainer.classList.add('hidden');
            if (messagesUnsubscribe) messagesUnsubscribe(); 
        }
    });
}

function initChat(freqChannel) {
    const safeChannelName = freqChannel.replace(/:/g, '_'); 
    const channelMessagesRef = ref(db, 'chat_rooms/' + safeChannelName);
    if (messagesUnsubscribe) off(channelMessagesRef); 
    chatMessages.innerHTML = ''; 
    sendButton.onclick = () => sendMessage(channelMessagesRef);
    chatInput.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(channelMessagesRef); };
    messagesUnsubscribe = onChildAdded(channelMessagesRef, (snapshot) => {
        const data = snapshot.val();
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', data.sender === currentUser ? 'sent' : 'received');
        messageDiv.textContent = `${data.sender}: ${data.text}`;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

function sendMessage(refPath) {
    const text = chatInput.value.trim();
    if (text) {
        push(refPath, {
            text: text,
            sender: currentUser,
            timestamp: Date.now()
        });
        chatInput.value = '';
    }
}