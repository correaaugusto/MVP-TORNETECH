import React, { useState } from 'react';
import UploadFile from './components/UploadFile';
import Dashboard from './components/Dashboard';

export default function App() {
  const [analysis, setAnalysis] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="container">
      <h1>Gestor de Processos Fantasma — MVP</h1>

      <UploadFile
        onStart={() => { setLoading(true); setAnalysis(null); setPdfUrl(null); }}
        onComplete={(data) => {
          setLoading(false);
          setAnalysis(data.analysis);
          setPdfUrl(data.pdfUrl);
        }}
        onError={() => setLoading(false)}
      />

      {loading && <div className="card"><p>Processando... isso pode levar até 1-2 minutos dependendo do arquivo e do modelo.</p></div>}

      {analysis && <Dashboard analysis={analysis} pdfUrl={pdfUrl} />}
    </div>
  );
}