// ════════════════════════════════════════════════════════════════
//  IMPORT EXCEL — Importação em massa via planilha para os cadastros
//  (Erros, Fornecedores, Compradores, Comerciais, Lojas, Manifestos,
//  Justificativas) e para o Histórico.
//  Precisa carregar DEPOIS de scripts.js (usa DB, google.script.run,
//  toast, esc, renderTbl2, popSel etc. já definidos lá).
// ════════════════════════════════════════════════════════════════

function _normalizarDataImport(v) {
  if (v === undefined || v === null || v === '') return '';

  // Já veio como objeto Date (quando lemos com cellDates:true) — caminho mais confiável
  if (v instanceof Date && !isNaN(v)) {
    return String(v.getDate()).padStart(2, '0') + '/' + String(v.getMonth() + 1).padStart(2, '0') + '/' + v.getFullYear();
  }

  // Veio como número de série do Excel (dias desde 1899-12-30)
  if (typeof v === 'number' && v > 20000 && v < 60000) {
    if (typeof XLSX !== 'undefined' && XLSX.SSF && XLSX.SSF.parse_date_code) {
      const dc = XLSX.SSF.parse_date_code(v);
      if (dc) return String(dc.d).padStart(2, '0') + '/' + String(dc.m).padStart(2, '0') + '/' + dc.y;
    }
    const dt = new Date(Math.round((v - 25569) * 86400 * 1000));
    return String(dt.getUTCDate()).padStart(2, '0') + '/' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '/' + dt.getUTCFullYear();
  }

  const s = String(v).trim();
  if (!s) return '';

  // yyyy-mm-dd (ISO)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const p = s.slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  // dd/mm/aaaa OU mm/dd/aaaa (ano com 4 dígitos) — detecta formato americano pelo 2º número > 12
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    let a = Number(m[1]), b = Number(m[2]), ano = m[3];
    if (a <= 12 && b > 12) { const t = a; a = b; b = t; } // era M/D/AAAA (americano) → inverte
    return String(a).padStart(2, '0') + '/' + String(b).padStart(2, '0') + '/' + ano;
  }

  // dd/mm/aa OU mm/dd/aa (ano com 2 dígitos) — ex: "4/28/26"
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    let a = Number(m[1]), b = Number(m[2]);
    const ano = (Number(m[3]) <= 79 ? '20' : '19') + m[3].padStart(2, '0');
    if (a <= 12 && b > 12) { const t = a; a = b; b = t; } // era M/D/AA (americano) → inverte
    return String(a).padStart(2, '0') + '/' + String(b).padStart(2, '0') + '/' + ano;
  }

  return s;
}

function _normalizarHoraImport(v) {
  if (v === undefined || v === null || v === '') return '';

  // Veio como objeto Date (Excel guarda campo "só hora" como data-base 30/12/1899 + horário)
  if (v instanceof Date && !isNaN(v)) {
    return String(v.getHours()).padStart(2, '0') + ':' + String(v.getMinutes()).padStart(2, '0');
  }

  // Veio como número serial do Excel (fração do dia — ex: 0.34444 = 08:16)
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const totalMin = Math.round(v * 24 * 60);
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  const s = String(v).trim();
  if (!s) return '';

  // já veio como texto "HH:MM" ou "HH:MM:SS"
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return String(Number(m[1])).padStart(2, '0') + ':' + m[2];

  return s;
}

const DB_KEY_POR_TIPO = {
  codErro: 'codErros', fornecedor: 'fornecedores', comprador: 'compradores',
  comercial: 'comerciais', loja: 'lojas', manifesto: 'manifestos',
  justificativa: 'justificativas', historico: 'historico'
};

const IMPORT_CFG = {
  codErro: {
    titulo: 'Importar Erros Cadastrados',
    dica: 'Colunas esperadas: Código, Descrição.',
    campos: { codigo: ['codigo', 'código', 'cod'], descricao: ['descricao', 'descrição', 'desc'] },
    obrigatorios: ['descricao'],
    addFn: 'addCodErro',
    montar: (row, perfil) => ({
      codigo: (row.codigo || '').toString().toUpperCase().trim() || (row.descricao || '').toString().substring(0, 5).toUpperCase(),
      descricao: (row.descricao || '').toString().toUpperCase().trim(),
      perfil
    }),
    depois: () => { renderTbl2('tb-erros', DB.codErros, 'codErro', ['codigo', 'descricao'], true); renderRegrasEditor(); }
  },
  fornecedor: {
    titulo: 'Importar Fornecedores',
    dica: 'Colunas esperadas: Código, Nome.',
    campos: { codigo: ['codigo', 'código', 'cod'], nome: ['nome', 'fornecedor', 'razao social', 'razão social'] },
    obrigatorios: ['nome'],
    addFn: 'addFornecedor',
    montar: (row) => ({
      codigo: (row.codigo || '—').toString().toUpperCase().trim() || '—',
      nome: (row.nome || '').toString().toUpperCase().trim()
    }),
    depois: () => renderTbl2('tb-forn', DB.fornecedores, 'forn', ['codigo', 'nome'], false)
  },
  comprador: {
    titulo: 'Importar Compradores',
    dica: 'Colunas esperadas: Nome, E-mail.',
    campos: { nome: ['nome'], email: ['email', 'e-mail'] },
    obrigatorios: ['nome'],
    addFn: 'addComprador',
    montar: (row, perfil) => ({ nome: (row.nome || '').toString().trim(), email: (row.email || '').toString().trim(), perfil }),
    depois: () => { renderTbl2('tb-comp', DB.compradores, 'comp', ['nome', 'email'], false); popSel('sel_comp', DB.compradores); }
  },
  comercial: {
    titulo: 'Importar Comerciais',
    dica: 'Colunas esperadas: Nome, E-mail.',
    campos: { nome: ['nome'], email: ['email', 'e-mail'] },
    obrigatorios: ['nome'],
    addFn: 'addComercial',
    montar: (row) => ({ nome: (row.nome || '').toString().trim(), email: (row.email || '').toString().trim() }),
    depois: () => { renderTbl2('tb-comerc', DB.comerciais, 'comerc', ['nome', 'email'], false); popSel('sel_comerc', DB.comerciais); }
  },
  loja: {
    titulo: 'Importar Lojas',
    dica: 'Colunas esperadas: Nome, E-mail.',
    campos: { nome: ['nome', 'loja'], email: ['email', 'e-mail'] },
    obrigatorios: ['nome'],
    addFn: 'addLoja',
    montar: (row) => ({ nome: (row.nome || '').toString().trim(), email: (row.email || '').toString().trim() }),
    depois: () => { renderTbl2('tb-loja', DB.lojas, 'loja', ['nome', 'email'], false); popSel('sel_loja', DB.lojas); }
  },
  manifesto: {
    titulo: 'Importar Manifestos',
    dica: 'Colunas esperadas: Nome, E-mail.',
    campos: { nome: ['nome', 'manifesto'], email: ['email', 'e-mail'] },
    obrigatorios: ['nome'],
    addFn: 'addManifesto',
    montar: (row) => ({ nome: (row.nome || '').toString().trim(), email: (row.email || '').toString().trim() }),
    depois: () => { renderTbl2('tb-manif', DB.manifestos, 'manif', ['nome', 'email'], false); popSel('sel_manif', DB.manifestos); }
  },
  justificativa: {
    titulo: 'Importar Justificativas',
    dica: 'Coluna esperada: Texto.',
    campos: { texto: ['texto', 'justificativa'] },
    obrigatorios: ['texto'],
    addFn: 'addJustificativa',
    montar: (row) => ({ texto: (row.texto || '').toString().toUpperCase().trim() }),
    depois: () => { renderTblJust(); popSelJust(); }
  },
  historico: {
    titulo: 'Importar Histórico',
    dica: 'Colunas esperadas (mesmas da Exportação): ID, Data, DANF, Fornecedor, Cod.Erro, Desc.Erro, Comprador, Email Comprador, Comercial, Email Comercial, Loja, Email Loja, Manifesto, Email Manifesto, Destinatarios PARA, STATUS, ST, Hora, Validade.',
    campos: {
      danf: ['danf', 'nf', 'nota', 'numero', 'número'],
      fornecedor: ['fornecedor'],
      codErro: ['codigo erro', 'cod erro', 'código erro', 'cod.erro'],
      erroDesc: ['descricao erro', 'descrição erro', 'erro', 'desc.erro'],
      loja: ['loja'],
      emailLoja: ['email loja', 'e-mail loja'],
      comprador: ['comprador'],
      emailComprador: ['email comprador', 'e-mail comprador'],
      comercial: ['comercial'],
      emailComercial: ['email comercial', 'e-mail comercial'],
      manifesto: ['manifesto'],
      emailManifesto: ['email manifesto', 'e-mail manifesto'],
      para: ['destinatarios para', 'destinatários para', 'para'],
      status: ['status'],
      situacao: ['situacao', 'situação', 'st'],
      hora: ['hora'],
      vencimento: ['vencimento', 'validade'],
      data: ['data', 'data emissão', 'data emissao']
    },
    obrigatorios: ['danf'],
    addFn: 'addHistorico',
    montar: (row, perfil) => {
      const lojaObj = DB.lojas.find(l => l.nome.toLowerCase() === String(row.loja || '').trim().toLowerCase());
      const compObj = DB.compradores.find(c => c.nome.toLowerCase() === String(row.comprador || '').trim().toLowerCase());
      const comercObj = DB.comerciais.find(c => c.nome.toLowerCase() === String(row.comercial || '').trim().toLowerCase());
      const manifObj = DB.manifestos.find(m => m.nome.toLowerCase() === String(row.manifesto || '').trim().toLowerCase());
      return {
        danf: String(row.danf || '').trim(),
        fornecedor: (row.fornecedor || '').toString().toUpperCase().trim(),
        codErro: (row.codErro || '').toString().toUpperCase().trim(),
        erroDesc: (row.erroDesc || '').toString().toUpperCase().trim(),
        loja: lojaObj ? lojaObj.nome : (row.loja || '').toString().toUpperCase().trim(),
        emailLoja: lojaObj ? lojaObj.email : (row.emailLoja || '').toString().trim(),
        comprador: compObj ? compObj.nome : (row.comprador || '').toString().trim(),
        emailComprador: compObj ? compObj.email : (row.emailComprador || '').toString().trim(),
        comercial: comercObj ? comercObj.nome : (row.comercial || '').toString().trim(),
        emailComercial: comercObj ? comercObj.email : (row.emailComercial || '').toString().trim(),
        manifesto: manifObj ? manifObj.nome : (row.manifesto || '').toString().trim(),
        emailManifesto: manifObj ? manifObj.email : (row.emailManifesto || '').toString().trim(),
        para: (row.para || '').toString().trim(),
        status: (row.status || '').toString().trim(),
        hora: _normalizarHoraImport(row.hora),
        situacao: (row.situacao || 'Pendente').toString().trim() || 'Pendente',
        vencimento: _normalizarDataImport(row.vencimento),
        data: _normalizarDataImport(row.data) || _hojeBR(),
        perfil
      };
    },
    depois: () => { if (typeof filtrarHist === 'function') { filtrarHist(); } else { renderTblHist(); } gerarDash(); }
  }
};

function _hojeBR() {
  const d = new Date();
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

let _importState = { tipo: null, rows: [] };

function abrirImportExcel(tipo) {
  const cfg = IMPORT_CFG[tipo];
  if (!cfg) return;
  _importState = { tipo, rows: [] };
  document.getElementById('import-title').textContent = '📥 ' + cfg.titulo;
  document.getElementById('import-hint').textContent = cfg.dica;
  document.getElementById('import-file-input').value = '';
  const dropLabel = document.getElementById('import-drop-label');
  if (dropLabel) dropLabel.textContent = 'Arraste a planilha aqui ou clique para selecionar';
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('import-preview').innerHTML = '';
  document.getElementById('import-progress-wrap').style.display = 'none';
  document.getElementById('import-progress-fill').style.width = '0%';
  document.getElementById('import-confirm-btn').disabled = true;
  document.getElementById('import-confirm-btn').textContent = 'Confirmar Importação';
  document.getElementById('modal-import').classList.add('open');
}

function fecharImportExcel() {
  document.getElementById('modal-import').classList.remove('open');
  _importState = { tipo: null, rows: [] };
}

function importDragOver(e) { e.preventDefault(); const d = document.getElementById('import-drop'); if (d) d.classList.add('drag-over'); }
function importDragLeave(e) { const d = document.getElementById('import-drop'); if (d) d.classList.remove('drag-over'); }
function importDrop(e) {
  e.preventDefault();
  importDragLeave(e);
  const files = e.dataTransfer.files;
  if (files && files.length) processarArquivoImport(files[0]);
}

function onImportExcelFile(e) {
  const file = e.target.files && e.target.files[0];
  if (file) processarArquivoImport(file);
}

function processarArquivoImport(file) {
  const cfg = IMPORT_CFG[_importState.tipo];
  if (!cfg) return;
  if (typeof XLSX === 'undefined') { toast('⚠️ Biblioteca de Excel não carregada.', true); return; }
  const lbl = document.getElementById('import-drop-label');
  if (lbl) lbl.textContent = '📄 ' + file.name;
  const reader = new FileReader();
  reader.onload = function (ev) {
    try {
      // cellDates:true faz o SheetJS entregar células de data como objeto Date real,
      // em vez de texto formatado no idioma da planilha (era isso que causava datas
      // tipo "4/28/26" — formato americano — aparecerem trocadas).
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
      if (!raw.length) { toast('Planilha vazia!', true); return; }

      const headers = raw[0].map(h => String(h || '').toLowerCase().trim());
      function acharCol(aliases) {
        // 1ª passada: casamento exato (evita que "ST" pegue a coluna "STATUS" por conter as letras "st")
        for (const a of aliases) {
          for (let i = 0; i < headers.length; i++) { if (headers[i] === a) return i; }
        }
        // 2ª passada: casamento parcial, só se não achou exato
        for (const a of aliases) {
          for (let i = 0; i < headers.length; i++) { if (headers[i].includes(a)) return i; }
        }
        return -1;
      }
      const colMap = {};
      Object.keys(cfg.campos).forEach(campo => { colMap[campo] = acharCol(cfg.campos[campo]); });

      const linhas = [];
      for (let r = 1; r < raw.length; r++) {
        const rowArr = raw[r];
        if (!rowArr || rowArr.every(c => c === '' || c == null)) continue;
        const obj = {};
        Object.keys(colMap).forEach(campo => { obj[campo] = colMap[campo] >= 0 ? rowArr[colMap[campo]] : ''; });
        const faltaObrig = cfg.obrigatorios.some(campo => !String(obj[campo] || '').trim());
        if (faltaObrig) continue;
        linhas.push(obj);
      }

      _importState.rows = linhas;
      const prev = document.getElementById('import-preview');
      prev.style.display = 'block';
      if (!linhas.length) {
        prev.innerHTML = '⚠️ Nenhuma linha válida encontrada. Verifique se as colunas obrigatórias (' + cfg.obrigatorios.join(', ') + ') estão preenchidas e se os cabeçalhos batem com o esperado.';
        document.getElementById('import-confirm-btn').disabled = true;
        return;
      }
      const exemploMontado = cfg.montar(linhas[0], _perfilAtivo());
      prev.innerHTML = '✓ <strong style="color:var(--accent)">' + linhas.length + '</strong> registro(s) prontos para importar.<br>' +
        'Exemplo (1ª linha): <span style="color:var(--text)">' + esc(JSON.stringify(exemploMontado)) + '</span>';
      document.getElementById('import-confirm-btn').disabled = false;
    } catch (err) {
      console.error(err);
      toast('Erro ao ler o arquivo: ' + err.message, true);
    }
  };
  reader.onerror = function () { toast('Falha ao ler o arquivo.', true); };
  reader.readAsArrayBuffer(file);
}

async function confirmarImportExcel() {
  const cfg = IMPORT_CFG[_importState.tipo];
  if (!cfg || !_importState.rows.length) return;
  const btn = document.getElementById('import-confirm-btn');
  btn.disabled = true; btn.textContent = '⏳ Importando…';
  const pw = document.getElementById('import-progress-wrap'), pf = document.getElementById('import-progress-fill');
  pw.style.display = 'block'; pf.style.width = '15%';

  const perfil = _perfilAtivo();
  const payloads = _importState.rows.map(row => cfg.montar(row, perfil));
  const coll = _colecaoFirestore(_importState.tipo);

  try {
    const r = await new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).importarEmMassa(coll, payloads);
    });
    pf.style.width = '100%';

    const dbKey = DB_KEY_POR_TIPO[_importState.tipo];
    if (r && r.ok) {
      const idIni = r.idInicial || 1;
      payloads.forEach((p, i) => DB[dbKey].push(Object.assign({}, p, { id: idIni + i })));
    }

    btn.textContent = 'Confirmar Importação'; btn.disabled = false;
    cfg.depois();
    fecharImportExcel();
    toast('✓ Importação concluída: ' + ((r && r.importados) || 0) + ' registro(s) importado(s)!');
  } catch (e) {
    console.error('Erro ao importar em massa:', e);
    btn.textContent = 'Confirmar Importação'; btn.disabled = false;
    toast('Erro ao importar: ' + (e && e.message ? e.message : e), true);
  }
}

// ════════════════════════════════════════════════════════════════
//  EXPORTAR EXCEL — baixa a lista atual (DB) como .xlsx
// ════════════════════════════════════════════════════════════════
function _linhasExportHistorico(lista) {
  return (lista || []).map(r => ({
    'ID': r.id || '',
    'Data': r.data || '',
    'DANF': r.danf || '',
    'Fornecedor': r.fornecedor || '',
    'Cod.Erro': r.codErro || '',
    'Desc.Erro': r.erroDesc || '',
    'Comprador': r.comprador || '',
    'Email Comprador': r.emailComprador || '',
    'Comercial': r.comercial || '',
    'Email Comercial': r.emailComercial || '',
    'Loja': r.loja || '',
    'Email Loja': r.emailLoja || '',
    'Manifesto': r.manifesto || '',
    'Email Manifesto': r.emailManifesto || '',
    'Destinatarios PARA': r.para || '',
    'STATUS': r.status || '',
    'ST': r.situacao || '',
    'Hora': r.hora || '',
    'Validade': r.vencimento || ''
  }));
}

function _baixarXlsxHistorico(rows, nomeAba) {
  if (!rows.length) { toast('Nada para exportar — nenhum registro no período selecionado.', true); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, nomeAba.slice(0, 31));
  const nomeArquivo = nomeAba + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  XLSX.writeFile(wb, nomeArquivo);
  toast('✓ Exportado: ' + nomeArquivo);
}

async function exportarExcel(tipo) {
  if (typeof XLSX === 'undefined') { toast('⚠️ Biblioteca de Excel não carregada.', true); return; }

  // Histórico usa cabeçalhos "amigáveis" — os MESMOS que a Importação de Histórico reconhece,
  // para que um arquivo exportado possa ser reimportado sem nenhum ajuste manual de colunas.
  //
  // Em vez de usar DB.historico (que pode ter sido sobrescrito pelo Dashboard NFS, cujo
  // gerarDash() roda logo após buscarHistPeriodo() e recarrega DB.historico com o período do
  // Dashboard — normalmente só o dia atual), buscamos direto no banco usando o período
  // selecionado NA PRÓPRIA aba Histórico (hist-de / hist-ate). Isso garante que a exportação
  // sempre reflete o período que você está vendo/pesquisando ali, não o do Dashboard.
  if (tipo === 'historico') {
    const deEl = document.getElementById('hist-de');
    const ateEl = document.getElementById('hist-ate');
    const de = deEl ? deEl.value : '';
    const ate = ateEl ? ateEl.value : '';
    if (!de || !ate) { toast('Selecione o período na aba Histórico antes de exportar!', true); return; }

    const nomeAba = (_perfilAtivo().toLowerCase() === 'matriz') ? 'Historico_Matriz' : 'Historico_Lojas';
    try {
      toast('⏳ Buscando período para exportar...');
      const lista = await new Promise((resolve, reject) => {
        google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)
          .loadHistFiltrado(de, ate, _perfilAtivo());
      });
      _baixarXlsxHistorico(_linhasExportHistorico(lista), nomeAba);
    } catch (e) {
      console.error('Erro ao exportar histórico:', e);
      toast('Erro ao buscar dados para exportar: ' + (e && e.message ? e.message : e), true);
    }
    return;
  }

  const dbKey = DB_KEY_POR_TIPO[tipo];
  const rows = (DB[dbKey] || []).map(r => {
    const copia = Object.assign({}, r);
    delete copia.perfil; // campo interno, não precisa ir pra planilha
    return copia;
  });
  if (!rows.length) { toast('Nada para exportar — a lista está vazia.', true); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const nomeAba = (IMPORT_CFG[tipo] ? IMPORT_CFG[tipo].titulo.replace('Importar ', '') : tipo).slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  const nomeArquivo = nomeAba.replace(/\s+/g, '_') + '_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  XLSX.writeFile(wb, nomeArquivo);
  toast('✓ Exportado: ' + nomeArquivo);
}

// ════════════════════════════════════════════════════════════════
//  LIMPAR BASE — apaga todos os registros de uma coleção no Firestore,
//  exigindo a senha do sistema (a mesma usada para entrar em modo Edição).
// ════════════════════════════════════════════════════════════════
function _colecaoFirestore(tipo) {
  const map = {
    fornecedor: 'fornecedores',
    comercial: 'comerciais', loja: 'lojas', manifesto: 'manifestos', justificativa: 'justificativas'
  };
  if (tipo === 'historico') {
    return (_perfilAtivo().toLowerCase() === 'matriz') ? 'Historico_Matriz' : 'Historico_Lojas';
  }
  if (tipo === 'comprador') {
    return (_perfilAtivo().toLowerCase() === 'matriz') ? 'Compradores_Matriz' : 'Compradores_Lojas';
  }
  if (tipo === 'codErro') {
    return (_perfilAtivo().toLowerCase() === 'matriz') ? 'Cod_Erros_Matriz' : 'Cod_Erros_Lojas';
  }
  return map[tipo];
}

let _limparTipoAtual = null;

function abrirLimparBanco(tipo) {
  _limparTipoAtual = tipo;
  const dbKey = DB_KEY_POR_TIPO[tipo];
  const total = (DB[dbKey] || []).length;
  const nomeLista = IMPORT_CFG[tipo] ? IMPORT_CFG[tipo].titulo.replace('Importar ', '') : tipo;
  document.getElementById('limpar-msg').textContent =
    'Isso vai apagar PERMANENTEMENTE ' + total + ' registro(s) de "' + nomeLista + '". Essa ação não pode ser desfeita. Digite a senha do sistema para confirmar.';
  document.getElementById('limpar-senha-inp').value = '';
  document.getElementById('limpar-senha-erro').style.display = 'none';
  document.getElementById('limpar-confirm-btn').disabled = false;
  document.getElementById('limpar-confirm-btn').textContent = 'Confirmar Limpeza';
  document.getElementById('modal-limpar').classList.add('open');
  setTimeout(() => document.getElementById('limpar-senha-inp').focus(), 80);
}

function fecharLimparBanco() {
  document.getElementById('modal-limpar').classList.remove('open');
  _limparTipoAtual = null;
}

async function confirmarLimparBanco() {
  const senha = document.getElementById('limpar-senha-inp').value;
  if (senha !== SENHA_EDICAO) {
    document.getElementById('limpar-senha-erro').style.display = 'block';
    return;
  }
  const tipo = _limparTipoAtual;
  if (!tipo) return;
  const btn = document.getElementById('limpar-confirm-btn');
  btn.disabled = true; btn.textContent = '⏳ Limpando…';
  try {
    const coll = _colecaoFirestore(tipo);
    const r = await new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).limparColecao(coll);
    });
    const dbKey = DB_KEY_POR_TIPO[tipo];
    DB[dbKey] = [];
    if (IMPORT_CFG[tipo]) IMPORT_CFG[tipo].depois();
    toast('✓ Base limpa! ' + ((r && r.removidos) || 0) + ' registro(s) removido(s).');
    fecharLimparBanco();
  } catch (e) {
    toast('Erro ao limpar: ' + e.message, true);
    btn.disabled = false; btn.textContent = 'Confirmar Limpeza';
  }
}
