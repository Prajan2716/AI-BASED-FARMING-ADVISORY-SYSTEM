const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatLog = document.getElementById('chat-log');

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  appendMessage('You', userMessage);
  chatInput.value = '';

  appendMessage('AgriAdvisor', '...thinking');

  try {
    const response = await fetch('/api/gemini-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    replaceLastBotMessage(data.reply || "Sorry, I didn't understand that.");
  } catch (error) {
    replaceLastBotMessage('Failed to connect to AI service. Try again later.');
    console.error(error);
  }
});

function appendMessage(sender, message) {
  const div = document.createElement('div');
  div.className = sender === 'You' ? 'chat-msg user-msg' : 'chat-msg bot-msg';
  div.innerHTML = `<strong>${sender}:</strong> ${message}`;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function replaceLastBotMessage(message) {
  const msgs = chatLog.querySelectorAll('.bot-msg');
  if (msgs.length > 0) {
    msgs[msgs.length - 1].innerHTML = `<strong>AgriAdvisor:</strong> ${message}`;
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}

// Voice recognition setup
const micBtn = document.getElementById('mic-btn');
let recognition;

if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = 'en-IN'; // Set language

  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    chatInput.value = transcript;
  };

  recognition.onerror = (event) => {
    alert(`Voice input error: ${event.error}`);
  };

  recognition.onend = () => {
    micBtn.disabled = false;
    micBtn.innerText = '🎤';
  };

  micBtn.addEventListener('click', () => {
    micBtn.disabled = true;
    micBtn.innerText = '🎙️';
    recognition.start();
  });
} else {
  micBtn.style.display = 'none';
}

// Image upload setup
const imgBtn = document.getElementById('img-btn');
const imageUpload = document.getElementById('image-upload');

imgBtn.addEventListener('click', (e) => {
  e.preventDefault(); // prevent default to avoid form submission or other effects
  imageUpload.click();
});

imageUpload.addEventListener('change', async () => {
  const file = imageUpload.files[0];
  if (!file) return;

  appendMessage('You', `[Image Uploaded: ${file.name}]`);

  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/image-upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`Image upload error: ${response.status}`);

    const data = await response.json();
    appendMessage('AgriAdvisor', data.reply || 'Image processed.');
  } catch (error) {
    appendMessage('AgriAdvisor', 'Image upload failed.');
    console.error(error);
  }
});
function scrollToBottom() {
  const chatContainer = document.querySelector('.chat-container');
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// After adding a message to chatMessages:
scrollToBottom();

