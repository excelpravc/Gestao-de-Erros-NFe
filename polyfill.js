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
    if (!window.db) throw new Error('Firestore não inicializado (firebase-init.js não carregou antes do polyfill.js)');
    return window.db;
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
  async function addHistorico(data) {
    const payload = Object.assign({}, data);
    if (!payload.data) payload.data = _hojeBR();
    return _add(_histColl(payload.perfil), payload);
  }
  async function updateHistorico(data) {
    return _update(_histColl(data && data.perfil), data);
  }
  async function deleteHistorico(id, perfil) {
    return _delete(_histColl(perfil), id);
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
  async function loadHistFiltrado(de, ate, perfil) {
    const rows = await _loadColl(_histColl(perfil));
    return rows.filter(r => {
      const d = _parseDataBR(r.data);
      return d >= de && d <= ate;
    });
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
    if (total > 0) await batch.commit();
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
    const senhaSalva = snap.exists ? (snap.data().senha || '@MANIFESTO') : '@MANIFESTO';
    if (String(atual) !== String(senhaSalva)) return { ok: false, msg: 'Senha atual incorreta!' };
    await ref.set({ senha: nova }, { merge: true });
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
    return { ok: true, removidos: docs.length };
  }

  // ── loadAll: junta todas as coleções + histórico do perfil ativo ──
  async function loadAll(perfil) {
    const [compradores, comerciais, lojas, manifestos, codErros, fornecedores, historico, regras, justificativas, gruposLoja] =
      await Promise.all([
        _loadColl(COLLECTIONS.comprador),
        _loadColl(COLLECTIONS.comercial),
        _loadColl(COLLECTIONS.loja),
        _loadColl(COLLECTIONS.manifesto),
        _loadColl(COLLECTIONS.codErro),
        _loadColl(COLLECTIONS.fornecedor),
        _loadColl(_histColl(perfil)),
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
    addHistorico, updateHistorico, deleteHistorico, updateHistoricoSituacaoPorDANF,
    loadAssinatura, saveAssinatura,
    addComprador: (d) => _add(COLLECTIONS.comprador, d),
    updateComprador: (d) => _update(COLLECTIONS.comprador, d),
    deleteComprador: (id) => _delete(COLLECTIONS.comprador, id),
    addComercial: (d) => _add(COLLECTIONS.comercial, d),
    updateComercial: (d) => _update(COLLECTIONS.comercial, d),
    deleteComercial: (id) => _delete(COLLECTIONS.comercial, id),
    addLoja: (d) => _add(COLLECTIONS.loja, d),
    updateLoja: (d) => _update(COLLECTIONS.loja, d),
    deleteLoja: (id) => _delete(COLLECTIONS.loja, id),
    addManifesto: (d) => _add(COLLECTIONS.manifesto, d),
    updateManifesto: (d) => _update(COLLECTIONS.manifesto, d),
    deleteManifesto: (id) => _delete(COLLECTIONS.manifesto, id),
    addCodErro: (d) => _add(COLLECTIONS.codErro, d),
    updateCodErro: (d) => _update(COLLECTIONS.codErro, d),
    deleteCodErro: (id) => _delete(COLLECTIONS.codErro, id),
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
    limparColecao
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
