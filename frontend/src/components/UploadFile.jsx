import React, { useRef, useState } from 'react';
import { uploadFile } from '../services/api';

export default function UploadFile({ onStart, onComplete, onError }) {
  const inputRef = useRef();
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const file = inputRef.current.files[0];
    if (!file) return alert('Selecione um arquivo (.csv, .xlsx, .txt).');

    try {
      setSending(true);
      onStart?.();
      const resp = await uploadFile(file);
      onComplete?.(resp);
    } catch (err) {
      console.error(err);
      onError?.(err);
      alert('Erro ao enviar o arquivo. Verifique o console do navegador/terminal.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          <strong>Envie um arquivo</strong>
          <div><small>Suporta: .csv, .xlsx, .txt — envie registros ou planilhas</small></div>
        </label>

        <input type="file" ref={inputRef} accept=".csv,.txt,.xlsx" style={{ marginTop: 8 }} />
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={sending}>{sending ? 'Enviando...' : 'Enviar para análise'}</button>
        </div>
      </form>
    </div>
  );
}