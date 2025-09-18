const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const vision = require('@google-cloud/vision');
require('dotenv').config();
const mongoose = require('mongoose');

const app = express();
const upload = multer({ dest: 'uploads/' });
const client = new vision.ImageAnnotatorClient();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

mongoose.connect('mongodb://localhost:27017/sih_server', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB error:', err));

// User Info schema
const infoSchema = new mongoose.Schema({
  sessionId: String,
  field: String,
  value: String,
  timestamp: { type: Date, default: Date.now }
});
const Info = mongoose.model('Info', infoSchema);

// Feedback schema - new
const feedbackSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Session setup
app.use(session({
  secret: 'yourSecretKey',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

function authMiddleware(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
}

// Login/logout routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'farmer@tam.com' && password === 'krishi123') {
    req.session.user = username;
    res.json({ success: true });
  } else {
    res.status(401).json({ message: 'Invalid username or password.', success: false });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ success: true });
  });
});

// Serve pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/index.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// OpenWeather API
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || 'bd35903b6866064d006d6fc55188f985';

app.get('/api/weather', async (req, res) => {
  const location = req.query.location;
  if (!location) {
    return res.status(400).json({ error: 'Location parameter is required' });
  }
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${OPENWEATHER_API_KEY}&units=metric`;

  try {
    const response = await fetch(weatherUrl);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch weather data' });
    }
    const data = await response.json();
    const weatherSummary = `${data.name}: ${data.weather[0].description}, temperature ${data.main.temp}°C, humidity ${data.main.humidity}%, wind speed ${data.wind.speed} m/s`;
    res.json({ weather: weatherSummary });
  } catch (err) {
    console.error('Error fetching weather:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Gemini chat API with weather detection
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

app.post('/api/gemini-chat', async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (userMessage.toLowerCase().includes('weather')) {
    const locationMatch = userMessage.match(/in ([a-zA-Z\s]+)/i);
    const location = locationMatch ? locationMatch[1].trim() : null;

    if (location) {
      try {
        const weatherResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/api/weather?location=${encodeURIComponent(location)}`);
        const weatherData = await weatherResponse.json();
        if (weatherData.weather) {
          return res.json({ reply: `Weather update for ${location}: ${weatherData.weather}` });
        } else {
          return res.json({ reply: "Sorry, I couldn't retrieve the weather information." });
        }
      } catch (err) {
        console.error('Weather API error:', err);
        return res.json({ reply: 'Sorry, I am having trouble fetching the weather right now.' });
      }
    }
  }

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const prompt = `
You are AgriAdvisor AI, an expert agricultural assistant.
Today's date is ${currentDate}.
Answer the following user question accordingly.
User: ${userMessage}
  `;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: prompt }] }
        ]
      }),
    });

    if (!response.ok) {
      const errData = await response.text();
      return res.status(response.status).json({ error: errData });
    }

    const data = await response.json();
    let reply = 'Sorry, no response from AI';

    if (data.candidates && data.candidates.length > 0 && data.candidates[0].content.parts.length > 0) {
      reply = data.candidates[0].content.parts.map(p => p.text).join(' ');
    }

    return res.json({ reply });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Save user info
app.post('/api/save-info', async (req, res) => {
  const { sessionId, field, value } = req.body;
  try {
    await Info.create({ sessionId, field, value });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Save failed' });
  }
});

// Submit feedback - new
app.post('/api/submit-feedback', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    await Feedback.create({ name, email, message });
    res.json({ success: true });
  } catch (err) {
    console.error('Feedback save error:', err);
    res.status(500).json({ success: false, error: 'Unable to save feedback' });
  }
});

// Image upload & Google Vision
app.post('/api/image-upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ reply: 'No image uploaded' });
  try {
    const [result] = await client.labelDetection(req.file.path);
    if (!result.labelAnnotations || result.labelAnnotations.length === 0) {
      return res.json({ reply: 'No detectable objects found in the image.' });
    }
    const labels = result.labelAnnotations.map(label => label.description).join(', ');
    res.json({ reply: 'Detected in image: ' + labels });
  } catch (error) {
    console.error('Vision API error:', error);
    res.status(500).json({ reply: 'Failed to analyze the image.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
