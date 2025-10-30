// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const analyzeRouter = require('./routes/analyze');

const app = express();
const allowedOrigins = [
  'https://mvp-tornetech-jygl.vercel.app', // frontend da Vercel
  'http://localhost:5173' // opcional: ambiente local (Vite)
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS bloqueado para esta origem'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json());

// rota de teste
app.get('/', (req, res) => res.send('TorneTech MVP backend OK'));

// rota de análise (usará IA)
app.use('/api/analyze', analyzeRouter);

// servir PDFs gerados
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Backend rodando na porta ${PORT}`));