// ════════════════════════════════════════════════════════════════
//  POLYFILL — Intercepta google.script.run e redireciona para o
//  Firestore (substitui totalmente o backend /api do Next.js).
//  Precisa carregar DEPOIS de: firebase-app-compat, firebase-firestore-compat,
//  firebase-init.js (que expõe window.db).
// ════════════════════════════════════════════════════════════════

(function () {
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  function getDb() {
    if (!window.dbTenant) throw new Error('Nenhum cliente logado ainda — faça login antes de usar o sistema.');
    return window.dbTenant;
  }

  // ── Coleções simples (mesma lista para os dois perfis) ──
  const COLLECTIONS = {
    comprador: 'compradores',
    comercial: 'comerciais',
    loja: 'lojas',
    manifesto: 'manifestos',
    codErro: 'codErros',
    fornecedor: 'fornecedores',
    justificativa: 'justificativas',
    regra: 'regras',
    grupoLoja: 'gruposLoja'
  };

  function _histColl(perfil) {
    return (String(perfil || '').toLowerCase() === 'matriz') ? 'Historico_Matriz' : 'Historico_Lojas';
  }
  function _compradoresColl(perfil) {
    return (String(perfil || '').toLowerCase() === 'matriz') ? 'Compradores_Matriz' : 'Compradores_Lojas';
  }
  function _codErrosColl(perfil) {
    return (String(perfil || '').toLowerCase() === 'matriz') ? 'Cod_Erros_Matriz' : 'Cod_Erros_Lojas';
  }

  // ── Gera próximo ID numérico (equivalente ao auto-incremento das planilhas) ──
  async function _nextId(collName) {
    const db = getDb();
    const ref = db.collection('_counters').doc(collName);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const next = (snap.exists ? (Number(snap.data().value) || 0) : 0) + 1;
      tx.set(ref, { value: next });
      return next;
    });
  }

  async function _loadColl(collName) {
    const db = getDb();
    const snap = await db.collection(collName).get();
    const rows = snap.docs.map(d => d.data());
    rows.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
    return rows;
  }

  async function _add(collName, data) {
    const db = getDb();
    const id = await _nextId(collName);
    const payload = Object.assign({}, data, { id });
    delete payload.__proto__;
    await db.collection(collName).doc(String(id)).set(payload);
    return { ok: true, id };
  }

  async function _update(collName, data) {
    if (!data || data.id == null) return { ok: false };
    const db = getDb();
    await db.collection(collName).doc(String(data.id)).set(data, { merge: true });
    return { ok: true };
  }

  async function _delete(collName, id) {
    const db = getDb();
    await db.collection(collName).doc(String(id)).delete();
    return { ok: true };
  }

  // ── Histórico (particionado por perfil) ──
  function _hojeBR() {
    const d = new Date();
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  function _dataBRparaISO(s) {
    if (!s || typeof s !== 'string') return null;
    const p = s.trim().split('/');
    if (p.length === 3 && p[2].length === 4) {
      return `${p[2]}-${String(p[0]).padStart(2,'0')}-${String(p[1]).padStart(2,'0')}`;
    }
    return null;
  }
  async function addHistorico(data) {
    const payload = Object.assign({}, data);
    if (!payload.data) payload.data = _hojeBR();
    payload.dataISO = _dataBRparaISO(payload.data) || new Date().toISOString().split('T')[0];
    const r = await _add(_histColl(payload.perfil), payload);
    _histCacheClear();
    return r;
  }
  async function updateHistorico(data) {
    const r = await _update(_histColl(data && data.perfil), data);
    _histCacheClear();
    return r;
  }
  async function deleteHistorico(id, perfil) {
    const r = await _delete(_histColl(perfil), id);
    _histCacheClear();
    return r;
  }
  function _parseDataBR(s) {
    if (!s || typeof s !== 'string') return '1900-01-01';
    const p = s.trim().split('/');
    if (p.length === 3) {
      const dia = String(p[0]).padStart(2, '0');
      const mes = String(p[1]).padStart(2, '0');
      const ano = String(p[2]);
      if (ano.length === 4) return `${ano}-${mes}-${dia}`;
    }
    return '1900-01-01';
  }
  // ── Cache em memória do histórico por período ──
  // Reaproveita o resultado já baixado quando a mesma consulta é pedida
  // de novo (Dashboard e Histórico com o mesmo período, re-clique em
  // "Buscar", troca de aba). Expira em 60s para nunca mostrar dado velho
  // depois de uma edição — e é limpo na hora quando algo é gravado.
  const _histCache = new Map();
  const HIST_CACHE_TTL_MS = 60000;
  function _histCacheKey(perfil, de, ate) { return perfil + '|' + de + '|' + ate; }
  function _histCacheGet(key) {
    const hit = _histCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.t > HIST_CACHE_TTL_MS) { _histCache.delete(key); return null; }
    return hit.rows;
  }
  function _histCacheSet(key, rows) { _histCache.set(key, { rows, t: Date.now() }); }
  function _histCacheClear() { _histCache.clear(); }

  async function loadHistFiltrado(de, ate, perfil) {
    const cacheKey = _histCacheKey(perfil, de, ate);
    const cached = _histCacheGet(cacheKey);
    if (cached) return cached; // reaproveitado — 0 leituras no Firestore

    const db = getDb();
    const coll = _histColl(perfil);

    // Consulta só os documentos do período (campo dataISO, já existente
    // nos seus documentos), em vez de ler a coleção inteira. Um teto de
    // segurança evita que um período gigantesco leia demais de uma vez.
    const LIMITE_SEGURANCA = 6000;
    const snap = await db.collection(coll)
      .where('dataISO', '>=', de)
      .where('dataISO', '<=', ate)
      .orderBy('dataISO', 'desc')
      .limit(LIMITE_SEGURANCA + 1)
      .get();

    if (snap.docs.length > LIMITE_SEGURANCA) {
      const err = new Error(
        'Este período tem mais de ' + LIMITE_SEGURANCA + ' registro(s) — reduza o ' +
        'intervalo de datas para não gastar a cota gratuita de uma vez.'
      );
      err.code = 'periodo-grande-demais';
      throw err;
    }

    const rows = snap.docs.map(d => d.data());
    _histCacheSet(cacheKey, rows);
    return rows;
  }

  // ── Busca direta por DANF: só traz os documentos que batem (leitura barata) ──
  async function buscarDanfNoHistorico(danf, perfil) {
    const db = getDb();
    const coll = _histColl(perfil);
    const snap = await db.collection(coll).where('danf', '==', String(danf || '').trim()).get();
    return snap.docs.map(d => d.data());
  }

  // ── Carrega só os últimos N registros do histórico, ordenado por id ──
  // (evita ler a coleção inteira; usado no login e no "Carregar Mais")
  async function loadHistUltimos(perfil, limite, cursorId) {
    const db = getDb();
    let q = db.collection(_histColl(perfil)).orderBy('id', 'desc');
    if (cursorId) q = q.where('id', '<', Number(cursorId));
    q = q.limit(Number(limite) || 100);
    const snap = await q.get();
    const rows = snap.docs.map(d => d.data());
    rows.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    return rows;
  }
  async function updateHistoricoSituacaoPorDANF(danf, loja, perfil) {
    const db = getDb();
    const coll = _histColl(perfil);
    const snap = await db.collection(coll).where('danf', '==', danf).get();
    const batch = db.batch();
    let total = 0;
    snap.forEach(doc => {
      const row = doc.data();
      const bate = !loja || String(row.loja || '').trim().toLowerCase() === String(loja).trim().toLowerCase();
      if (bate) { batch.update(doc.ref, { situacao: 'Lançada' }); total++; }
    });
    if (total > 0) { await batch.commit(); _histCacheClear(); }
    return { ok: total > 0, totalMarcadas: total };
  }

  // ── Assinatura / config por perfil ──
  async function loadAssinatura(perfil) {
    const db = getDb();
    const snap = await db.collection('config').doc(String(perfil)).get();
    return snap.exists ? snap.data() : null;
  }
  async function saveAssinatura(data, perfil) {
    const db = getDb();
    await db.collection('config').doc(String(perfil)).set(data, { merge: true });
    return { ok: true };
  }

  // ── Senha única do sistema ──
  async function loadSenhaSistema() {
    const db = getDb();
    const snap = await db.collection('config').doc('sistema').get();
    return snap.exists ? (snap.data().senha || null) : null;
  }
  async function saveSenhaSistema(atual, nova) {
    const db = getDb();
    const ref = db.collection('config').doc('sistema');
    const snap = await ref.get();
    const senhaSalva = snap.exists ? (snap.data().senha || '@mudar') : '@mudar';
    if (String(atual) !== String(senhaSalva)) return { ok: false, msg: 'Senha atual incorreta!' };
    await ref.set({ senha: nova }, { merge: true });
    // Espelha a senha atualizada no diretório central, pra o ADM sempre
    // ver a senha em dia sem precisar entrar no banco de cada cliente.
    if (window.dbCentral && window.CURRENT_USUARIO_ID) {
      try {
        await window.dbCentral.collection('usuarios').doc(window.CURRENT_USUARIO_ID)
          .update({ senhaSistemaAtual: nova, senhaSistemaAtualizadaEm: new Date().toISOString() });
      } catch (e) { console.error('[Polyfill] Falha ao espelhar senha para o diretório central:', e); }
    }
    return { ok: true };
  }

  // ── E-mail de recuperação da senha do sistema ──
  async function loadEmailRecuperacao() {
    const db = getDb();
    const snap = await db.collection('config').doc('sistema').get();
    return snap.exists ? (snap.data().emailRecuperacao || null) : null;
  }
  async function saveEmailRecuperacao(email) {
    const db = getDb();
    await db.collection('config').doc('sistema').set({ emailRecuperacao: String(email || '').trim() }, { merge: true });
    return { ok: true };
  }

  // ── Regras de destinatários por erro ──
  async function saveAllRegras(regrasArray) {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const existentes = await _loadColl('regras');
    let saved = 0;
    for (const nova of (regrasArray || [])) {
      const match = existentes.find(r => r.codErro === nova.codErro && r.descErro === nova.descErro);
      if (match) {
        await _update('regras', Object.assign({}, match, { destinatarios: nova.destinatarios, criadoEm: hoje }));
        saved++;
      } else if (nova.destinatarios) {
        await _add('regras', { codErro: nova.codErro, descErro: nova.descErro, destinatarios: nova.destinatarios, criadoEm: hoje });
        saved++;
      }
    }
    return { ok: true, saved };
  }

  // ── Grupos de loja (add e update pela mesma função) ──
  async function saveGrupoLoja(data) {
    if (!data || !data.id) {
      return _add(COLLECTIONS.grupoLoja, { grupo: data.grupo, lojas: data.lojas || '' });
    }
    return _update(COLLECTIONS.grupoLoja, data);
  }

  // ── Importação em massa (usada pelo botão "Importar Excel") ──
  // Reserva um bloco de IDs numa única transação e grava tudo em lotes de
  // até 450 documentos por chamada de batch, em vez de 1 transação + 1
  // gravação por linha (o que travava com milhares de registros).
  async function importarEmMassa(collName, rows) {
    const db = getDb();
    if (!rows || !rows.length) return { ok: true, importados: 0 };

    const counterRef = db.collection('_counters').doc(collName);
    const idInicial = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const atual = snap.exists ? (Number(snap.data().value) || 0) : 0;
      tx.set(counterRef, { value: atual + rows.length });
      return atual + 1;
    });

    const CHUNK = 450; // limite do Firestore é 500 operações por batch
    let importados = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = db.batch();
      const parte = rows.slice(i, i + CHUNK);
      parte.forEach((row, j) => {
        const id = idInicial + i + j;
        const payload = Object.assign({}, row, { id });
        batch.set(db.collection(collName).doc(String(id)), payload);
      });
      await batch.commit();
      importados += parte.length;
    }
    _histCacheClear();
    return { ok: true, importados, idInicial };
  }

  // ── Limpeza em lote de uma coleção inteira (usado pelo botão "Limpar Base") ──
  async function limparColecao(collName) {
    const db = getDb();
    const snap = await db.collection(collName).get();
    const docs = snap.docs;
    const CHUNK = 450; // limite do Firestore é 500 operações por batch
    for (let i = 0; i < docs.length; i += CHUNK) {
      const batch = db.batch();
      docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    // Reseta o contador de ID para essa coleção, para a próxima importação começar do 1
    await db.collection('_counters').doc(collName).delete().catch(() => {});
    _histCacheClear();
    return { ok: true, removidos: docs.length };
  }

  // ── loadAll: junta todas as coleções + histórico do perfil ativo ──
  async function loadAll(perfil) {
    const [compradores, comerciais, lojas, manifestos, codErros, fornecedores, historico, regras, justificativas, gruposLoja] =
      await Promise.all([
        _loadColl(_compradoresColl(perfil)),
        _loadColl(COLLECTIONS.comercial),
        _loadColl(COLLECTIONS.loja),
        _loadColl(COLLECTIONS.manifesto),
        _loadColl(_codErrosColl(perfil)),
        _loadColl(COLLECTIONS.fornecedor),
        loadHistUltimos(perfil, 100), // só os 100 mais recentes — evita ler a coleção inteira em todo login
        _loadColl(COLLECTIONS.regra),
        _loadColl(COLLECTIONS.justificativa),
        _loadColl(COLLECTIONS.grupoLoja)
      ]);
    return { compradores, comerciais, lojas, manifestos, codErros, fornecedores, historico, regras, justificativas, gruposLoja };
  }

  // ── Tabela de despacho: nome do método (chamado por google.script.run.X(...)) → handler ──
  const HANDLERS = {
    loadAll,
    loadHistFiltrado,
    loadHistUltimos,
    buscarDanfNoHistorico,
    addHistorico, updateHistorico, deleteHistorico, updateHistoricoSituacaoPorDANF,
    loadAssinatura, saveAssinatura,
    addComprador: (d) => _add(_compradoresColl(d && d.perfil), d),
    updateComprador: (d) => _update(_compradoresColl(d && d.perfil), d),
    deleteComprador: (id, perfil) => _delete(_compradoresColl(perfil), id),
    addComercial: (d) => _add(COLLECTIONS.comercial, d),
    updateComercial: (d) => _update(COLLECTIONS.comercial, d),
    deleteComercial: (id) => _delete(COLLECTIONS.comercial, id),
    addLoja: (d) => _add(COLLECTIONS.loja, d),
    updateLoja: (d) => _update(COLLECTIONS.loja, d),
    deleteLoja: (id) => _delete(COLLECTIONS.loja, id),
    addManifesto: (d) => _add(COLLECTIONS.manifesto, d),
    updateManifesto: (d) => _update(COLLECTIONS.manifesto, d),
    deleteManifesto: (id) => _delete(COLLECTIONS.manifesto, id),
    addCodErro: (d) => _add(_codErrosColl(d && d.perfil), d),
    updateCodErro: (d) => _update(_codErrosColl(d && d.perfil), d),
    deleteCodErro: (id, perfil) => _delete(_codErrosColl(perfil), id),
    addFornecedor: (d) => _add(COLLECTIONS.fornecedor, d),
    updateFornecedor: (d) => _update(COLLECTIONS.fornecedor, d),
    deleteFornecedor: (id) => _delete(COLLECTIONS.fornecedor, id),
    saveAllRegras,
    deleteRegra: (id) => _delete(COLLECTIONS.regra, id),
    addJustificativa: (d) => _add(COLLECTIONS.justificativa, d),
    updateJustificativa: (d) => _update(COLLECTIONS.justificativa, d),
    deleteJustificativa: (id) => _delete(COLLECTIONS.justificativa, id),
    saveGrupoLoja,
    deleteGrupoLoja: (id) => _delete(COLLECTIONS.grupoLoja, id),
    loadSenhaSistema, saveSenhaSistema,
    loadEmailRecuperacao, saveEmailRecuperacao,
    limparColecao, importarEmMassa
  };

  // ── Proxy que imita a API do google.script.run ──
  function makeProxy() {
    const proxy = {
      withSuccessHandler(cb) { this._ok = cb; return this; },
      withFailureHandler(cb) { this._fail = cb; return this; }
    };
    Object.keys(HANDLERS).forEach(name => {
      proxy[name] = function (...args) {
        const ok = this._ok, fail = this._fail;
        Promise.resolve()
          .then(() => HANDLERS[name].apply(null, args))
          .then(result => { if (ok) ok(result); })
          .catch(err => {
            console.error(`[Polyfill/Firestore] Erro em ${name}:`, err);
            if (err && (err.code === 'resource-exhausted' || /quota/i.test(String(err.message || err)))) {
              err.message = 'A cota gratuita diária do Firebase foi atingida. Tente novamente mais tarde (ela reseta por volta da meia-noite no horário do Pacífico — geralmente 4h–5h da manhã no horário de Brasília) ou faça upgrade do projeto para o plano Blaze no Console do Firebase.';
            }
            if (fail) fail(err); else throw err;
          });
        return makeProxy(); // nova instância limpa para a próxima chamada encadeada
      };
    });
    return proxy;
  }

  window.google.script.run = makeProxy();

  console.log('[Polyfill] google.script.run redirecionado para Firestore com sucesso!');
})();
