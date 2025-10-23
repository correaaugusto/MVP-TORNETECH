// backend/routes/analyze.js
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const fetch = global.fetch || require('node-fetch');

const router = express.Router();

// Configuração da pasta de upload
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Configura o multer (upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${unique}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Funções de extração (inalteradas)
function extractTextFromFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  // ... (lógica de extração)
  if (ext === '.txt' || ext === '.log') {
    return fs.readFileSync(filePath, 'utf8');
  } else if (ext === '.csv') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    return records.map(r => JSON.stringify(r)).join('\n');
  } else if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.readFile(filePath);
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return json.map(r => JSON.stringify(r)).join('\n');
  }
  return fs.readFileSync(filePath, 'utf8');
}

// Prompt base (inalterado)
function buildPrompt(content) {
  return `
Você é um analista de processos. Analise o conteúdo a seguir (registros, e-mails, planilhas, logs) e identifique:
1. Atividades informais ou repetitivas.
2. Estimativa de tempo desperdiçado (em horas).
3. Estimativa de custo associado (em reais).
4. Sugestões de automação ou padronização (POPs).
5. Priorize as sugestões (Alta/Média/Baixa) e estime impacto.

Responda **apenas** em JSON, no formato:
{
  "resumo": "",
  "tempo_desperdicado_horas_total": 0,
  "tempo_desperdicado_horas_por_tarefa": [
    {"tarefa": "nome", "horas": 0, "ocorrencias": 0}
  ],
  "custo_estimado_reais_total": 0,
  "tarefas_informais": [
    {"tarefa": "nome", "descricao": "", "ocorrencias": 0}
  ],
  "sugestoes": [
    {"titulo": "", "descricao": "", "prioridade": "Alta", "impacto_percentual": 0}
  ]
}

Conteúdo:
${content}
  `;
}

// Funções auxiliares (inalteradas)
async function listAvailableModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao listar modelos: ${res.status} ${res.statusText} - ${txt}`);
  }
  const data = await res.json();
  return data.models || [];
}

function chooseModel(models) {
  const preferred = [
    'models/gemini-2.5-flash',
  ];

  for (const p of preferred) {
    const found = models.find(m =>
      m.name === p && ((m.supportedMethods || []).includes('generateContent') || (m.supportedGenerationMethods || []).includes('generateContent'))
    );
    if (found) return found.name;
  }

  const any = models.find(m =>
    (m.supportedMethods || []).includes('generateContent') || (m.supportedGenerationMethods || []).includes('generateContent')
  );
  return any ? any.name : null;
}

// CORREÇÃO CRÍTICA: Aumentar o limite de tokens
async function generateWithGemini(apiKey, modelName, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`;
  
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { 
      temperature: 0.2, 
      // AUMENTADO DE 1500 PARA 40960 PARA ACOMODAR RESPOSTAS LONGAS
      maxOutputTokens: 40960, 
      responseMimeType: 'application/json' 
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`Erro generateContent: ${res.status} ${res.statusText} - ${txt}`);
  }
  
  const data = JSON.parse(txt);
  
  if (data.candidates && data.candidates[0]) {
    const candidate = data.candidates[0];
    
    // Verifica se a geração parou devido ao limite de tokens
    if (candidate.finishReason === 'MAX_TOKENS') {
         // Lançar um erro para o bloco catch externo, permitindo um tratamento claro
        console.error("ERRO CRÍTICO: MAX_TOKENS atingido. O output está incompleto. Aumente maxOutputTokens.");
        throw new Error("MAX_TOKENS_LIMIT_REACHED: A análise foi truncada. Aumente o limite de tokens.");
    }

    if (candidate.content && candidate.content.parts) {
      // Extrai o texto do JSON do modelo
      return candidate.content.parts.map(p => p.text).join('\n');
    }
  }

  // Fallback: se não encontrou o conteúdo, retorna o objeto Gemini API como string
  return JSON.stringify(data);
}

// Rota principal: POST /api/analyze
router.post('/', upload.single('file'), async (req, res) => {
  let uploadedFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    
    uploadedFilePath = req.file.path;
    const originalName = req.file.originalname;
    const text = extractTextFromFile(uploadedFilePath, originalName);

    const maxChars = 35000;
    let contentToSend = text;

    // Truncagem Inteligente
    if (text.length > maxChars) {
      const safeEnd = text.lastIndexOf('\n', maxChars);
      if (safeEnd !== -1) {
        contentToSend = text.slice(0, safeEnd);
        console.warn(`Arquivo truncado em ${safeEnd} caracteres para evitar quebra de linha de dados.`);
      } else {
        contentToSend = text.slice(0, maxChars);
        console.warn(`Arquivo truncado no limite máximo de ${maxChars} caracteres.`);
      }
    }
    
    const prompt = buildPrompt(contentToSend);

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY não configurada no .env');

    const models = await listAvailableModels(apiKey);
    const chosenModel = chooseModel(models);
    if (!chosenModel) throw new Error('Nenhum modelo disponível com suporte a generateContent.');

    console.log('Modelo Gemini escolhido:', chosenModel);
    // O generateWithGemini agora lança um erro se MAX_TOKENS for atingido
    const respostaTexto = await generateWithGemini(apiKey, chosenModel, prompt);

    // Parsing JSON Robusto
    let rawJsonText = respostaTexto.trim();

    // Remover marcadores de bloco de código Markdown (```json)
    if (rawJsonText.startsWith('```json')) {
        rawJsonText = rawJsonText.substring('```json'.length);
    }
    if (rawJsonText.endsWith('```')) {
        rawJsonText = rawJsonText.substring(0, rawJsonText.length - '```'.length);
    }
    rawJsonText = rawJsonText.trim(); 

    let respostaJson;
    try {
      respostaJson = JSON.parse(rawJsonText);
    } catch (err) {
      console.error('Falha no JSON. O texto recebido não é um JSON válido após a limpeza.', err);
      // Tentativa final de extração com regex (fallback)
      try {
          const jsonMatch = rawJsonText.match(/\{[\s\S]*\}$/);
          const raw = jsonMatch ? jsonMatch[0] : rawJsonText;
          respostaJson = JSON.parse(raw);
      } catch(e) {
          // Captura a falha crítica e retorna um erro claro
          console.error('Falha crítica ao interpretar JSON do modelo. Output bruto:', respostaTexto);
          return res.status(500).json({ error: 'Falha crítica: O modelo não retornou JSON válido.', rawOutput: respostaTexto });
      }
    }

    // Sucesso
    res.json({
      analysis: respostaJson,
    });
  } catch (err) {
    console.error('Erro na análise:', err.message);
    
    let statusCode = 500;
    let errorMessage = "Erro interno do servidor.";

    if (err.message.includes('MAX_TOKENS_LIMIT_REACHED')) {
        statusCode = 400;
        errorMessage = "A análise falhou porque a resposta do modelo excedeu o limite de tokens. Aumente maxOutputTokens no Backend.";
    }

    res.status(statusCode).json({ error: errorMessage });
  } finally {
      // Limpar o arquivo de upload
      if (uploadedFilePath) {
          fs.unlink(uploadedFilePath, (err) => {
              if (err) console.error("Falha ao deletar arquivo de upload:", uploadedFilePath, err);
          });
      }
  }
});

module.exports = router;