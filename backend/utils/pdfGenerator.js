// backend/utils/pdfGenerator.js
const PDFDocument = require('pdfkit');
const fs = require('fs');

function createReportPDF(outputPath, { originalFileName, analysis }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Cabeçalho
    doc.fontSize(18).text('Relatório - Gestor de Processos Fantasma', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).text(`Arquivo analisado: ${originalFileName}`);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`);
    doc.moveDown();

    // Resumo
    doc.fontSize(12).text('Resumo da Análise', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text(analysis?.resumo || 'Sem resumo gerado.');
    doc.moveDown();

    // Estimativas
    doc.fontSize(12).text('Estimativas', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Tempo desperdiçado total: ${analysis?.tempo_desperdicado_horas_total ?? 'N/A'} h`);
    doc.text(`Custo estimado total: R$ ${analysis?.custo_estimado_reais_total ?? 'N/A'}`);
    doc.moveDown();

    // Tarefas informais
    doc.fontSize(12).text('Tarefas informais detectadas', { underline: true });
    doc.moveDown(0.5);
    const tarefas = analysis?.tarefas_informais || [];
    if (tarefas.length === 0) {
      doc.fontSize(11).text('Nenhuma tarefa informal identificada.');
    } else {
      tarefas.forEach((t, i) => {
        doc.fontSize(11).text(`${i + 1}. ${t.tarefa || 'Sem nome'} — ${t.descricao || ''}`);
        if (t.ocorrencias) doc.text(`   Ocorrências: ${t.ocorrencias}`);
        doc.moveDown(0.3);
      });
    }
    doc.moveDown();

    // Sugestões
    doc.fontSize(12).text('Sugestões de automação / POPs', { underline: true });
    doc.moveDown(0.5);
    const sugestoes = analysis?.sugestoes || [];
    if (sugestoes.length === 0) {
      doc.fontSize(11).text('Nenhuma sugestão encontrada.');
    } else {
      sugestoes.forEach((s, i) => {
        doc.fontSize(11).text(`${i + 1}. ${s.titulo || 'Sem título'} (${s.prioridade || 'N/A'})`);
        doc.text(`   ${s.descricao || ''}`);
        if (s.impacto_percentual !== undefined) {
          doc.text(`   Impacto estimado: ${s.impacto_percentual}%`);
        }
        doc.moveDown(0.3);
      });
    }

    doc.end();
    stream.on('finish', () => resolve(outputPath));
    stream.on('error', reject);
  });
}

module.exports = { createReportPDF };