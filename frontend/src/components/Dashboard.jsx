import React, { useRef } from 'react'; // Importar 'useRef'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';           // Importar jsPDF
import html2canvas from 'html2canvas'; // Importar html2canvas

export default function Dashboard({ analysis }) {
  // 1. Criar a referência para o conteúdo do PDF
  const pdfContentRef = useRef(null); 
  
  const tempoTotal = analysis?.tempo_desperdicado_horas_total ?? 0;
  const custoTotal = analysis?.custo_estimado_reais_total ?? 0;
  const tarefas = analysis?.tarefas_informais ?? [];
  const sugestoes = analysis?.sugestoes ?? [];
  const tempoPorTarefa = analysis?.tempo_desperdicado_horas_por_tarefa ?? [];

  const pieData = tempoPorTarefa.map(t => ({ name: t.tarefa, value: t.horas || 0 }));
  const colors = ['#4e79a7','#f28e2c','#e15759','#76b7b2','#59a14f'];

  // 2. Implementar a função de geração de PDF
  const handleGeneratePdf = () => {
    const input = pdfContentRef.current;
    
    // Configurações básicas do PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const margin = 10; // Margem em mm

    // Oculta o botão de PDF durante a captura para evitar que ele apareça no relatório
    const button = document.querySelector('.pdf-button');
    if (button) button.style.display = 'none'; 

    html2canvas(input, {
        scale: 2, // Aumenta a escala para melhor qualidade de imagem
        logging: true,
        useCORS: true,
        windowWidth: input.scrollWidth,
        windowHeight: input.scrollHeight,
    }).then((canvas) => {
        // 3. Captura a imagem do HTML
        const imgData = canvas.toDataURL('image/png');
        const imgProps = pdf.getImageProperties(imgData);
        
        // Calcula a proporção para caber na página A4, respeitando as margens
        const imgHeight = (imgProps.height * (width - 4 * margin)) / imgProps.width;
        
        let position = 0;
        let pageHeight = height;

        // 4. Adiciona a imagem ao PDF (tratamento para múltiplas páginas, se necessário)
        let renderedHeight = 0;
        
        while (renderedHeight < imgHeight) {
            const pageY = -renderedHeight;
            
            // Adiciona nova página após a primeira
            if (renderedHeight > 0) {
                pdf.addPage();
            }

            // Captura apenas a parte visível da imagem para a página atual
            pdf.addImage(
                imgData, 
                'PNG', 
                margin, 
                margin + (renderedHeight > 0 ? 0 : 0), // Ajuste de margem
                width - 2 * margin, 
                imgHeight,
                null, 
                'NONE', 
                0, 
                0,
                0,
                pageY // Offset Y para mover o conteúdo na imagem
            );

            renderedHeight += pageHeight - 2 * margin; // Avança para o próximo bloco
        }
        
        // 5. Salva o PDF
        pdf.save('relatorio_processos_analise.pdf');
    }).finally(() => {
        // Restaura a visibilidade do botão após a conclusão
        if (button) button.style.display = 'block'; 
    });
  };

  return (
    // 3. Aplicar a referência 'ref' na div principal do conteúdo do PDF
    <div style={{ marginTop: 18 }} ref={pdfContentRef}> 
      <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
        <div className="card" style={{ flex: 1 }}>
          <h3>Tempo desperdiçado</h3>
          <p style={{ fontSize: 22, fontWeight: 700 }}>{tempoTotal} h</p>
          <small>Estimativa total</small>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h3>Custo estimado</h3>
          <p style={{ fontSize: 22, fontWeight: 700 }}>R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <small>Estimativa total</small>
        </div>
        <div className="card" style={{ flex: 1 }}>
          <h3>Tarefas informais</h3>
          <p style={{ fontSize: 22, fontWeight: 700 }}>{tarefas.length}</p>
          <small>Itens detectados</small>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <h4>Distribuição de tempo por tarefa</h4>
          <div style={{ height: 260 }}>
            {pieData.length === 0 ? (
              <p>Nenhum dado de tempo por tarefa.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" label outerRadius={80}>
                    {pieData.map((entry, idx) => <Cell key={idx} fill={colors[idx % colors.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <h4>Principais recomendações</h4>
          {sugestoes.length === 0 ? <p>Nenhuma sugestão estruturada.</p> : (
            <ul>
              {sugestoes.map((s, i) => (
                <li key={i} style={{ marginBottom: 10 }}>
                  <strong>{s.titulo}</strong><br />
                  <small>{s.descricao}</small><br />
                  <small>Prioridade: {s.prioridade} — Impacto: {s.impacto_percentual ?? 'N/A'}%</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16 }} className="card">
        <h4>Detalhes das tarefas</h4>
        {tarefas.length === 0 ? <p>Nenhuma tarefa identificada.</p> : (
          <ol>
            {tarefas.map((t, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <strong>{t.tarefa}</strong> — {t.descricao} <br />
                <small>Ocorrências: {t.ocorrencias ?? 'N/A'}</small>
              </li>
            ))}
          </ol>
        )}
        <div style={{ marginTop: 12 }}>
            <a className="button-link pdf-button" onClick={handleGeneratePdf} style={{ cursor: 'pointer' }}>
                <button>Gerar Relatório (PDF)</button>
            </a>
        </div>
      </div>
    </div>
  );
}