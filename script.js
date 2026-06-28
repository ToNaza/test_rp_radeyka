import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, onChildAdded, off } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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

// Элементы интерфейса
const regContainer = document.getElementById('regContainer'); // Блок регистрации
const user1Btn = document.getElementById('user1Btn');
const user2Btn = document.getElementById('user2Btn');
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

// --- Регистрация (выбор аккаунта) ---
user1Btn.addEventListener('click', () => selectUser('Agent_1'));
user2Btn.addEventListener('click', () => selectUser('Agent_2'));

function selectUser(userName) {
    currentUser = userName;
    regContainer.style.display = 'none'; // Скрываем выбор, открываем рацию
    radioSidebar.classList.add('open');
    toggleButton.textContent = '<';
    
    // Ссылка в базе для текущего юзера
    userRef = ref(db, 'online_users/' + currentUser);
    
    // Запуск логики рации после авторизации
    setupRadio();
}

toggleButton.addEventListener('click', () => {
    radioSidebar.classList.toggle('open');
    toggleButton.textContent = radioSidebar.classList.contains('open') ? '<' : '>';
});

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

// --- Отправка частоты на сервер ---
function updateFrequencyOnServer() {
    freq1Display.textContent = currentFreq1.toString().padStart(2, '0');
    freq2Display.textContent = currentFreq2.toString().padStart(2, '0');

    // Формируем общую частоту как строку, например "3:10"
    const combinedFreq = `${currentFreq1}:${currentFreq2}`;

    // Обновляем состояние текущего пользователя в реальном времени
    set(userRef, {
        name: currentUser,
        frequency: combinedFreq,
        lastActive: Date.now()
    });

    // Слушаем, сколько всего пользователей настроены на ЭТУ ЖЕ частоту
    if (activeUsersUnsubscribe) activeUsersUnsubscribe(); // Отключаем старого слушателя
    
    const usersRef = ref(db, 'online_users');
    activeUsersUnsubscribe = onValue(usersRef, (snapshot) => {
        const users = snapshot.val();
        if (!users) return;

        let usersOnSameFreq = 0;

        for (let userKey in users) {
            if (users[userKey].frequency === combinedFreq) {
                usersOnSameFreq++;
            }
        }

        // Если 2 или более пользователей на одной волне, открываем чат
        if (usersOnSameFreq >= 2) {
            chatContainer.classList.remove('hidden');
            initChat(combinedFreq);
        } else {
            chatContainer.classList.add('hidden');
            if (messagesUnsubscribe) messagesUnsubscribe(); // Отключаем чат, если частоту сбили
        }
    });
}

// --- Логика чата ---
function initChat(freqChannel) {
    const safeChannelName = freqChannel.replace(/:/g, '_'); // Название ветки чата (символ двоеточия запрещен в путях Firebase)
    const channelMessagesRef = ref(db, 'chat_rooms/' + safeChannelName);

    if (messagesUnsubscribe) off(channelMessagesRef); // Снимаем предыдущие подписки

    chatMessages.innerHTML = ''; // Очищаем историю при переключении канала

    sendButton.onclick = () => sendMessage(channelMessagesRef);
    chatInput.onkeypress = (e) => {
        if (e.key === 'Enter') sendMessage(channelMessagesRef);
    };

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