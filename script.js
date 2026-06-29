import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, push, remove, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCZt2HX_Mhuv842QqNPwDh-KGNChIPz_NM",
  authDomain: "test-radeyka-rp.firebaseapp.com",
  databaseURL: "https://test-radeyka-rp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "test-radeyka-rp",
  storageBucket: "test-radeyka-rp.firebasestorage.app",
  messagingSenderId: "249575852311",
  appId: "1:249575852311:web:9ba691ffb8c13371d80f52",
  measurementId: "G-4D3V17J1HV"
};

const analytics = getAnalytics(app);

// Инициализация
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

// DOM элементы
const regBtn = document.getElementById('reg');
const regContainer = document.getElementById('regContainer');
const chatContainer = document.getElementById('chatContainer');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');
const toggleButton = document.getElementById('toggleButton');
const radioSidebar = document.getElementById('radioSidebar');
const freq1Display = document.getElementById('freq1');
const freq2Display = document.getElementById('freq2');
const knob1 = document.getElementById('knob1');
const knob2 = document.getElementById('knob2');

// Состояние
let currentUser = null;
let freq1 = 0;
let freq2 = 0;
let currentFrequencyKey = null;
let chatRef = null;

// --- 1. АВТОРИЗАЦИЯ VIA GOOGLE ---
regBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(err => console.error("Ошибка входа:", err));
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        regContainer.classList.add('hidden'); // Скрываем кнопку входа (добавь .hidden {display:none} в CSS если нет)
        regContainer.style.display = 'none';
        updateUserPresence();
    } else {
        currentUser = null;
        regContainer.style.display = 'flex';
        disconnectFromFrequency();
    }
});

// --- 2. СИДЕНЬЕ (РАЦИЯ) ---
toggleButton.addEventListener('click', () => {
    radioSidebar.classList.toggle('open');
    toggleButton.innerText = radioSidebar.classList.contains('open') ? '<' : '>';
});

// --- 3. ВРАЩЕНИЕ КРУТИЛОК ---
function setupKnob(knobElement, isUpperKnob) {
    let angle = 0; 
    let startY = 0;
    let isDragging = false;

    // Лимиты: от 0 до 12 (всего 13 положений: 0, 1, 2... 12)
    const maxVal = 12;

    function updateValue(delta) {
        let currentVal = isUpperKnob ? freq1 : freq2;
        currentVal += delta;
        if (currentVal < 0) currentVal = 0;
        if (currentVal > maxVal) currentVal = maxVal;

        if (isUpperKnob) freq1 = currentVal;
        else freq2 = currentVal;

        // Визуальное вращение: делим 360 градусов на 12 секторов
        angle = currentVal * (360 / maxVal);
        knobElement.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;

        // Обновление цифр на табло (с ведущим нулем)
        if (isUpperKnob) freq1Display.innerText = String(freq1).padStart(2, '0');
        else freq2Display.innerText = String(freq2).padStart(2, '0');

        // Обработка логики частоты
        updateUserPresence();
    }

    // ПК: Колёсико мыши при наведении ИЛИ зажатии
    knobElement.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        updateValue(delta);
    });

    // Смартфон / Мышь: Зажатие и Перетаскивание вверх/вниз
    const startDrag = (e) => {
        isDragging = true;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
    };

    const doDrag = (e) => {
        if (!isDragging) return;
        const currentY = e.touches ? e.touches[0].clientY : e.clientY;
        const diffY = startY - currentY; // Вверх — положительное значение

        // Чувствительность свайпа: каждые 20 пикселей меняют значение
        if (Math.abs(diffY) > 20) {
            const delta = diffY > 0 ? 1 : -1;
            updateValue(delta);
            startY = currentY; 
        }
    };

    const stopDrag = () => { isDragging = false; };

    knobElement.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', doDrag);
    window.addEventListener('mouseup', stopDrag);

    knobElement.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('touchmove', doDrag, { passive: false });
    window.addEventListener('touchend', stopDrag);
}

setupKnob(knob1, true);
setupKnob(knob2, false);

// --- 4. РАБОТА С СЕТЬЮ И ЧАСТОТАМИ ---
function updateUserPresence() {
    if (!currentUser) return;

    // Отключаемся от старой частоты
    disconnectFromFrequency();

    // Если частота 00:00 — рация выключена
    if (freq1 === 0 && freq2 === 0) {
        chatContainer.classList.add('hidden');
        return;
    }

    currentFrequencyKey = `${String(freq1).padStart(2,'0')}_${String(freq2).padStart(2,'0')}`;
    
    // Регистрируем пользователя на этой частоте
    const presenceRef = ref(db, `frequencies/${currentFrequencyKey}/users/${currentUser.uid}`);
    set(presenceRef, {
        name: currentUser.displayName,
        connectedAt: Date.now()
    });

    // Слушаем количество людей на частоте и сообщения
    const usersCountRef = ref(db, `frequencies/${currentFrequencyKey}/users`);
    onValue(usersCountRef, (snapshot) => {
        const users = snapshot.val();
        if (users && Object.keys(users).length >= 2) {
            chatContainer.classList.remove('hidden');
            listenToChat();
        } else {
            chatContainer.classList.add('hidden');
            // Если мы остались одни на частоте, очищаем ветку сообщений в БД, чтобы в следующий раз чат был чист
            if (chatRef) {
                const messagesRef = ref(db, `frequencies/${currentFrequencyKey}/messages`);
                remove(messagesRef);
                off(messagesRef);
                chatRef = null;
            }
        }
    });

    // Удаление из БД при закрытии вкладки браузера
    presenceRef.onDisconnect().remove();
}

function disconnectFromFrequency() {
    if (currentFrequencyKey && currentUser) {
        const presenceRef = ref(db, `frequencies/${currentFrequencyKey}/users/${currentUser.uid}`);
        remove(presenceRef);
        
        const usersCountRef = ref(db, `frequencies/${currentFrequencyKey}/users`);
        off(usersCountRef);
        
        if (chatRef) {
            off(chatRef);
            chatRef = null;
        }
    }
    chatMessages.innerHTML = '';
}

function listenToChat() {
    if (chatRef) return; // Чтобы не вешать дублирующие слушатели

    chatRef = ref(db, `frequencies/${currentFrequencyKey}/messages`);
    onValue(chatRef, (snapshot) => {
        chatMessages.innerHTML = '';
        const data = snapshot.val();
        if (data) {
            Object.values(data).forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.classList.add('message');
                msgDiv.classList.add(msg.senderId === currentUser.uid ? 'sent' : 'received');
                msgDiv.innerText = `${msg.senderName}: ${msg.text}`;
                chatMessages.appendChild(msgDiv);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    });
}

// --- 5. ОТПРАВКА СООБЩЕНИЙ ---
function sendMessage() {
    const text = chatInput.value.trim();
    if (!text || !currentFrequencyKey) return;

    const messagesRef = ref(db, `frequencies/${currentFrequencyKey}/messages`);
    push(messagesRef, {
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        text: text,
        timestamp: Date.now()
    });
    chatInput.value = '';
}

sendButton.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});