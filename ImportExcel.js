// ════════════════════════════════════════════════════════════════
//  IMPORT EXCEL — Importação em massa via planilha para os cadastros
//  (Erros, Fornecedores, Compradores, Comerciais, Lojas, Manifestos,
//  Justificativas) e para o Histórico.
//  Precisa carregar DEPOIS de scripts.js (usa DB, google.script.run,
//  toast, esc, renderTbl2, popSel etc. já definidos lá).
// ════════════════════════════════════════════════════════════════

function _normalizarDataImport(v) {
  if (v === undefined || v === null || v === '') return '';
  if (v instanceof Date && !isNaN(v)) {
    return String(v.getDate()).padStart(2, '0') + '/' + String(v.getMonth() + 1).padStart(2, '0') + '/' + v.getFullYear();
  }
  const s = String(v).trim();
  if (!s) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const p = s.slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  const num = Number(s);
  if (!isNaN(num) && num > 20000 && num < 60000) {
    const dt = new Date(Math.round((num - 25569) * 86400 * 1000));
    return String(dt.getUTCDate()).padStart(2, '0') + '/' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '/' + dt.getUTCFullYear();
  }
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
    dica: 'Colunas esperadas: DANF/NF, Fornecedor, Código Erro, Descrição Erro, Loja, Comprador, Status, Situação, Vencimento, Data (opcional — se vazio, usa a data de hoje).',
    campos: {
      danf: ['danf', 'nf', 'nota', 'numero', 'número'],
      fornecedor: ['fornecedor'],
      codErro: ['codigo erro', 'cod erro', 'código erro'],
      erroDesc: ['descricao erro', 'descrição erro', 'erro'],
      loja: ['loja'],
      comprador: ['comprador'],
      status: ['status'],
      situacao: ['situacao', 'situação'],
      vencimento: ['vencimento'],
      data: ['data', 'data emissão', 'data emissao']
    },
    obrigatorios: ['danf'],
    addFn: 'addHistorico',
    montar: (row, perfil) => {
      const lojaObj = DB.lojas.find(l => l.nome.toLowerCase() === String(row.loja || '').trim().toLowerCase());
      const compObj = DB.compradores.find(c => c.nome.toLowerCase() === String(row.comprador || '').trim().toLowerCase());
      return {
        danf: String(row.danf || '').trim(),
        fornecedor: (row.fornecedor || '').toString().toUpperCase().trim(),
        codErro: (row.codErro || '').toString().toUpperCase().trim(),
        erroDesc: (row.erroDesc || '').toString().toUpperCase().trim(),
        loja: lojaObj ? lojaObj.nome : (row.loja || '').toString().toUpperCase().trim(),
        emailLoja: lojaObj ? lojaObj.email : '',
        comprador: compObj ? compObj.nome : (row.comprador || '').toString().trim(),
        emailComprador: compObj ? compObj.email : '',
        status: (row.status || '').toString().trim(),
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

function onImportExcelFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const cfg = IMPORT_CFG[_importState.tipo];
  if (!cfg) return;
  if (typeof XLSX === 'undefined') { toast('⚠️ Biblioteca de Excel não carregada.', true); return; }

  const reader = new FileReader();
  reader.onload = function (ev) {
    try {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
      if (!raw.length) { toast('Planilha vazia!', true); return; }

      const headers = raw[0].map(h => String(h || '').toLowerCase().trim());
      function acharCol(aliases) {
        for (let i = 0; i < headers.length; i++) {
          for (const a of aliases) { if (headers[i] === a || headers[i].includes(a)) return i; }
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
      prev.innerHTML = '✓ <strong style="color:var(--accent)">' + linhas.length + '</strong> registro(s) prontos para importar.<br>' +
        'Exemplo (1ª linha): <span style="color:var(--text)">' + esc(JSON.stringify(linhas[0])) + '</span>';
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
  pw.style.display = 'block'; pf.style.width = '0%';

  let ok = 0, falha = 0;
  const total = _importState.rows.length;
  const perfil = _perfilAtivo();

  for (let i = 0; i < total; i++) {
    const payload = cfg.montar(_importState.rows[i], perfil);
    try {
      const r = await new Promise((resolve, reject) => {
        google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[cfg.addFn](payload);
      });
      if (r && r.ok) {
        ok++;
        const dbKey = DB_KEY_POR_TIPO[_importState.tipo];
        if (dbKey) DB[dbKey].push(Object.assign({}, payload, { id: r.id }));
      } else falha++;
    } catch (e) {
      falha++;
      console.error('Erro ao importar linha', i, e);
    }
    pf.style.width = Math.round(((i + 1) / total) * 100) + '%';
  }

  btn.textContent = 'Confirmar Importação'; btn.disabled = false;
  cfg.depois();
  fecharImportExcel();
  toast('✓ Importação concluída: ' + ok + ' registro(s) importado(s)' + (falha ? ', ' + falha + ' com falha' : '') + '!');
}

// ════════════════════════════════════════════════════════════════
//  EXPORTAR EXCEL — baixa a lista atual (DB) como .xlsx
// ════════════════════════════════════════════════════════════════
function exportarExcel(tipo) {
  if (typeof XLSX === 'undefined') { toast('⚠️ Biblioteca de Excel não carregada.', true); return; }
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
    codErro: 'codErros', fornecedor: 'fornecedores', comprador: 'compradores',
    comercial: 'comerciais', loja: 'lojas', manifesto: 'manifestos', justificativa: 'justificativas'
  };
  if (tipo === 'historico') {
    return (_perfilAtivo().toLowerCase() === 'matriz') ? 'Historico_Matriz' : 'Historico_Lojas';
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
