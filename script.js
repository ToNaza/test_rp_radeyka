import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDanduCPw3SYiYpSOPloUQgtjYI3ftg0PQ",
  authDomain: "testradeyka.firebaseapp.com",
  projectId: "testradeyka",
  storageBucket: "testradeyka.firebasestorage.app",
  messagingSenderId: "727422013406",
  appId: "1:727422013406:web:2c1dbdedbb2bceecffd74f",
  measurementId: "G-MCVDS5V931"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const messagesRef = ref(db, 'radio_chat');

const radioSidebar = document.getElementById('radioSidebar');
const toggleButton = document.getElementById('toggleButton');
const chatContainer = document.getElementById('chatContainer');
const freq1Display = document.getElementById('freq1');
const freq2Display = document.getElementById('freq2');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendButton = document.getElementById('sendButton');

let freq1 = 0;
let freq2 = 0;
const targetFreq1 = 3;
const targetFreq2 = 10;

toggleButton.addEventListener('click', () => {
    radioSidebar.classList.toggle('open');
    toggleButton.textContent = radioSidebar.classList.contains('open') ? '<' : '>';
});

function updateRadioState() {
    freq1Display.textContent = freq1.toString().padStart(2, '0');
    freq2Display.textContent = freq2.toString().padStart(2, '0');
    
    if (freq1 === targetFreq1 && freq2 === targetFreq2) {
        chatContainer.classList.remove('hidden');
    } else {
        chatContainer.classList.add('hidden');
    }
}

function setupKnob(knobElement, isFirstFreq) {
    let currentValue = 0;
    let isPressed = false;

    // --- Логика для ПК (Зажать ЛКМ + Колесико мыши) ---
    knobElement.addEventListener('mousedown', (e) => {
        isPressed = true;
        e.preventDefault(); // Предотвращаем выделение элементов
    });

    window.addEventListener('mouseup', () => {
        isPressed = false;
    });

    window.addEventListener('wheel', (e) => {
        if (!isPressed) return;
        
        if (e.deltaY > 0 && currentValue > 0) {
            currentValue--; // Колесико вниз
        } else if (e.deltaY < 0 && currentValue < 12) {
            currentValue++; // Колесико вверх
        }
        
        applyRotation();
    });

    // --- Логика для телефонов (Зажать + Свайп вверх/вниз) ---
    let startY = 0;
    knobElement.addEventListener('touchstart', (e) => {
        isPressed = true;
        startY = e.touches[0].clientY;
    }, {passive: true});

    window.addEventListener('touchend', () => {
        isPressed = false;
    });

    window.addEventListener('touchmove', (e) => {
        if (!isPressed) return;
        
        let currentY = e.touches[0].clientY;
        let deltaY = startY - currentY;
        
        if (Math.abs(deltaY) > 15) { // Чувствительность
            if (deltaY > 0 && currentValue < 12) {
                currentValue++;
            } else if (deltaY < 0 && currentValue > 0) {
                currentValue--;
            }
            startY = currentY;
            applyRotation();
        }
    }, {passive: true});

    function applyRotation() {
        // Обязательно сохраняем translate, иначе крутилки улетят при повороте
        knobElement.style.transform = `translate(-50%, -50%) rotate(${currentValue * 30}deg)`;
        
        if (isFirstFreq) {
            freq1 = currentValue;
        } else {
            freq2 = currentValue;
        }
        updateRadioState();
    }
}

setupKnob(document.getElementById('knob1'), true);
setupKnob(document.getElementById('knob2'), false);

sendButton.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
    const text = chatInput.value.trim();
    if (text) {
        push(messagesRef, {
            text: text,
            timestamp: Date.now(),
            sender: 'user1' 
        });
        chatInput.value = '';
    }
}

onChildAdded(messagesRef, (snapshot) => {
    const data = snapshot.val();
    const messageDiv = document.createElement('div');
    
    messageDiv.classList.add('message', data.sender === 'user1' ? 'sent' : 'received');
    messageDiv.textContent = data.text;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});
