// frontend/src/services/api.js
import axios from 'axios';

//  Usa a variável do .env, e se não existir, usa o backend local
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

export async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);

  try {
    const resp = await axios.post(`${API_BASE}/api/analyze`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // até 2 minutos para arquivos grandes
    });

    return resp.data;
  } catch (err) {
    console.error('❌ Erro ao enviar arquivo para API:', err);
    throw err;
  }
}