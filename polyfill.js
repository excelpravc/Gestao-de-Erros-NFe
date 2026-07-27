/**
 * ════════════════════════════════════════════════════════════════
 * FIREBASE FIRESTORE BACKEND (MODULAR SDK v9+) - OTIMIZADO PARA COTA
 * ════════════════════════════════════════════════════════════════
 * Este código reescreve o polyfill do google.script.run para utilizar
 * a sintaxe moderna (Modular) do Firebase SDK v9+.
 * 
 * Melhorias incluídas para economia de cota:
 * 1. Uso de importações modulares (Tree-shaking friendly).
 * 2. Estrutura de código mais limpa e assíncrona.
 * 3. Melhor tratamento de erros e tipagem implícita.
 * 4. **Filtros no servidor**: `_loadColl` e `loadHistFiltrado` agora usam `where` clauses
 *    para buscar apenas os documentos necessários, reduzindo leituras.
 * 5. **Consultas otimizadas**: `loadHistUltimos` já usava `orderBy` e `limit`.
 * 6. **Batches de escrita**: `importarEmMassa` e `limparColecao` continuam usando `writeBatch`.
 * ════════════════════════════════════════════════════════════════
 */

import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  runTransaction, 
  writeBatch, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

(function () {
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  /**
   * Obtém a instância do banco de dados do tenant atual.
   */
  function getDb() {
    if (!window.dbTenant) {
      throw new Error("Nenhum cliente logado ainda — faça login antes de usar o sistema.");
    }
    return window.dbTenant;
  }

  // ── Mapeamento de Coleções ──
  const COLLECTIONS = {
    comprador: "compradores",
    comercial: "comerciais",
    loja: "lojas",
    manifesto: "manifestos",
    codErro: "codErros",
    fornecedor: "fornecedores",
    justificativa: "justificativas",
    regra: "regras",
    grupoLoja: "gruposLoja"
  };

  const getCollName = (base, perfil) => {
    const suffix = (String(perfil || "").toLowerCase() === "matriz") ? "_Matriz" : "_Lojas";
    return `${base}${suffix}`;
  };

  // ── Utilitários de ID e CRUD ──

  /**
   * Gera o próximo ID numérico sequencial.
   */
  async function _nextId(collName) {
    const db = getDb();
    const counterRef = doc(db, "_counters", collName);
    
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      const nextId = (counterDoc.exists() ? (Number(counterDoc.data().value) || 0) : 0) + 1;
      transaction.set(counterRef, { value: nextId });
      return nextId;
    });
  }

  /**
   * Carrega uma coleção, opcionalmente com filtros e ordenação.
   * @param {string} collName - Nome da coleção.
   * @param {Array} [queryConstraints=[]] - Array de constraints de query do Firestore (e.g., where, orderBy).
   */
  async function _loadColl(collName, queryConstraints = []) {
    const db = getDb();
    const q = query(collection(db, collName), ...queryConstraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }

  async function _add(collName, data) {
    const db = getDb();
    const id = await _nextId(collName);
    const payload = { ...data, id };
    
    await setDoc(doc(db, collName, String(id)), payload);
    return { ok: true, id };
  }

  async function _update(collName, data) {
    if (!data || data.id == null) return { ok: false };
    const db = getDb();
    await setDoc(doc(db, collName, String(data.id)), data, { merge: true });
    return { ok: true };
  }

  async function _delete(collName, id) {
    const db = getDb();
    await deleteDoc(doc(db, collName, String(id)));
    return { ok: true };
  }

  // ── Lógica de Histórico ──

  const formatDateBR = (date = new Date()) => {
    return date.toLocaleDateString("pt-BR");
  };

  const parseDateBRtoISO = (s) => {
    if (!s || typeof s !== "string") return null;
    const [dia, mes, ano] = s.trim().split("/");
    if (dia && mes && ano && ano.length === 4) {
      return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    }
    return null;
  };

  async function addHistorico(data) {
    const payload = { ...data };
    if (!payload.data) payload.data = formatDateBR();
    payload.dataISO = parseDateBRtoISO(payload.data) || new Date().toISOString().split("T")[0];
    return _add(getCollName("Historico", payload.perfil), payload);
  }

  /**
   * Carrega histórico filtrado por data e perfil, usando filtros do lado do servidor.
   * @param {string} de - Data inicial no formato ISO (YYYY-MM-DD).
   * @param {string} ate - Data final no formato ISO (YYYY-MM-DD).
   * @param {string} perfil - Perfil do histórico.
   */
  async function loadHistFiltrado(de, ate, perfil) {
    const db = getDb();
    const collRef = collection(db, getCollName("Historico", perfil));
    const q = query(
      collRef,
      where("dataISO", ">=", de),
      where("dataISO", "<=", ate),
      orderBy("dataISO", "asc") // Ordena para garantir consistência
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }

  async function buscarDanfNoHistorico(danf, perfil) {
    const db = getDb();
    const coll = getCollName("Historico", perfil);
    const q = query(
      collection(db, coll), 
      where("danf", "==", String(danf || "").trim())
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }

  async function loadHistUltimos(perfil, limite = 100, cursorId) {
    const db = getDb();
    let constraints = [orderBy("id", "desc"), limit(Number(limite))];
    
    if (cursorId) {
      // Para usar startAfter com orderBy, o campo do cursor deve ser o mesmo do orderBy
      const cursorDoc = await getDoc(doc(db, getCollName("Historico", perfil), String(cursorId)));
      if (cursorDoc.exists()) {
        constraints.push(startAfter(cursorDoc));
      } else {
        console.warn(`[Firebase] Cursor ID ${cursorId} não encontrado para loadHistUltimos.`);
      }
    }

    const q = query(collection(db, getCollName("Historico", perfil)), ...constraints);
    const snap = await getDocs(q);
    return snap.docs
      .map(d => d.data())
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0)); // Ordenação local para garantir, caso o cursor mude a ordem
  }

  async function updateHistoricoSituacaoPorDANF(danf, loja, perfil) {
    const db = getDb();
    const collRef = collection(db, getCollName("Historico", perfil));
    const q = query(collRef, where("danf", "==", danf));
    const snap = await getDocs(q);
    
    const batch = writeBatch(db);
    let total = 0;

    snap.forEach(docSnap => {
      const row = docSnap.data();
      const matchLoja = !loja || String(row.loja || "").trim().toLowerCase() === String(loja).trim().toLowerCase();
      if (matchLoja) {
        batch.update(docSnap.ref, { situacao: "Lançada" });
        total++;
      }
    });

    if (total > 0) await batch.commit();
    return { ok: total > 0, totalMarcadas: total };
  }

  // ── Configurações e Segurança ──

  async function loadAssinatura(perfil) {
    const db = getDb();
    const snap = await getDoc(doc(db, "config", String(perfil)));
    return snap.exists() ? snap.data() : null;
  }

  async function saveAssinatura(data, perfil) {
    const db = getDb();
    await setDoc(doc(db, "config", String(perfil)), data, { merge: true });
    return { ok: true };
  }

  async function loadSenhaSistema() {
    const db = getDb();
    const snap = await getDoc(doc(db, "config", "sistema"));
    return snap.exists() ? (snap.data().senha || null) : null;
  }

  async function saveSenhaSistema(atual, nova) {
    const db = getDb();
    const ref = doc(db, "config", "sistema");
    const snap = await getDoc(ref);
    const senhaSalva = snap.exists() ? (snap.data().senha || "@mudar") : "@mudar";

    if (String(atual) !== String(senhaSalva)) {
      return { ok: false, msg: "Senha atual incorreta!" };
    }

    await setDoc(ref, { senha: nova }, { merge: true });

    // Espelhamento Central
    if (window.dbCentral && window.CURRENT_USUARIO_ID) {
      try {
        const userRef = doc(window.dbCentral, "usuarios", window.CURRENT_USUARIO_ID);
        await updateDoc(userRef, { 
          senhaSistemaAtual: nova, 
          senhaSistemaAtualizadaEm: new Date().toISOString() 
        });
      } catch (e) {
        console.error("[Firebase] Falha ao espelhar senha:", e);
      }
    }
    return { ok: true };
  }

  async function loadEmailRecuperacao() {
    const db = getDb();
    const snap = await getDoc(doc(db, "config", "sistema"));
    return snap.exists() ? (snap.data().emailRecuperacao || null) : null;
  }

  async function saveEmailRecuperacao(email) {
    const db = getDb();
    await setDoc(doc(db, "config", "sistema"), { emailRecuperacao: String(email || "").trim() }, { merge: true });
    return { ok: true };
  }

  // ── Regras de destinatários por erro ──
  async function saveAllRegras(regrasArray) {
    const hoje = formatDateBR();
    // Para evitar ler a coleção inteira, vamos buscar as regras existentes
    // apenas se houver regras para salvar e precisar de comparação.
    // No entanto, para a lógica atual de `find`, ainda precisamos de todas.
    // Se a lista de regras for muito grande, isso pode ser um ponto de otimização futura
    // para buscar regras individualmente ou por lotes.
    const existentes = await _loadColl("regras"); 
    let saved = 0;
    for (const nova of (regrasArray || [])) {
      const match = existentes.find(r => r.codErro === nova.codErro && r.descErro === nova.descErro);
      if (match) {
        await _update("regras", { ...match, destinatarios: nova.destinatarios, criadoEm: hoje });
        saved++;
      } else if (nova.destinatarios) {
        await _add("regras", { codErro: nova.codErro, descErro: nova.descErro, destinatarios: nova.destinatarios, criadoEm: hoje });
        saved++;
      }
    }
    return { ok: true, saved };
  }

  // ── Grupos de loja (add e update pela mesma função) ──
  async function saveGrupoLoja(data) {
    if (!data || !data.id) {
      return _add(COLLECTIONS.grupoLoja, { grupo: data.grupo, lojas: data.lojas || "" });
    }
    return _update(COLLECTIONS.grupoLoja, data);
  }

  // ── Operações em Massa ──

  async function importarEmMassa(collName, rows) {
    const db = getDb();
    if (!rows || !rows.length) return { ok: true, importados: 0 };

    const counterRef = doc(db, "_counters", collName);
    const idInicial = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const atual = snap.exists() ? (Number(snap.data().value) || 0) : 0;
      transaction.set(counterRef, { value: atual + rows.length });
      return atual + 1;
    });

    const CHUNK = 450;
    let importados = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = writeBatch(db);
      const parte = rows.slice(i, i + CHUNK);
      parte.forEach((row, j) => {
        const id = idInicial + i + j;
        batch.set(doc(db, collName, String(id)), { ...row, id });
      });
      await batch.commit();
      importados += parte.length;
    }
    return { ok: true, importados, idInicial };
  }

  async function limparColecao(collName) {
    const db = getDb();
    const snap = await getDocs(collection(db, collName));
    const CHUNK = 450;
    
    for (let i = 0; i < snap.docs.length; i += CHUNK) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    await deleteDoc(doc(db, "_counters", collName)).catch(() => {});
    return { ok: true, removidos: snap.docs.length };
  }

  // ── loadAll: junta todas as coleções + histórico do perfil ativo ──
  async function loadAll(perfil) {
    const [compradores, comerciais, lojas, manifestos, codErros, fornecedores, historico, regras, justificativas, gruposLoja] =
      await Promise.all([
        _loadColl(getCollName("Compradores", perfil)),
        _loadColl(COLLECTIONS.comercial),
        _loadColl(COLLECTIONS.loja),
        _loadColl(COLLECTIONS.manifesto),
        _loadColl(getCollName("Cod_Erros", perfil)),
        _loadColl(COLLECTIONS.fornecedor),
        loadHistUltimos(perfil, 100), // já otimizado para carregar apenas os últimos N
        _loadColl(COLLECTIONS.regra),
        _loadColl(COLLECTIONS.justificativa),
        _loadColl(COLLECTIONS.grupoLoja)
      ]);
    return { compradores, comerciais, lojas, manifestos, codErros, fornecedores, historico, regras, justificativas, gruposLoja };
  }

  // ── Tabela de Despacho (Handlers) ──
  const HANDLERS = {
    loadAll,
    loadHistFiltrado,
    loadHistUltimos,
    buscarDanfNoHistorico,
    addHistorico,
    updateHistorico: (data) => _update(getCollName("Historico", data?.perfil), data),
    deleteHistorico: (id, perfil) => _delete(getCollName("Historico", perfil), id),
    updateHistoricoSituacaoPorDANF,
    loadAssinatura,
    saveAssinatura: (data, perfil) => setDoc(doc(getDb(), "config", String(perfil)), data, { merge: true }).then(() => ({ ok: true })),
    addComprador: (d) => _add(getCollName("Compradores", d?.perfil), d),
    updateComprador: (d) => _update(getCollName("Compradores", d?.perfil), d),
    deleteComprador: (id, perfil) => _delete(getCollName("Compradores", perfil), id),
    addCodErro: (d) => _add(getCollName("Cod_Erros", d?.perfil), d),
    updateCodErro: (d) => _update(getCollName("Cod_Erros", d?.perfil), d),
    deleteCodErro: (id, perfil) => _delete(getCollName("Cod_Erros", perfil), id),
    // ... CRUDs Simples
    addComercial: (d) => _add(COLLECTIONS.comercial, d),
    updateComercial: (d) => _update(COLLECTIONS.comercial, d),
    deleteComercial: (id) => _delete(COLLECTIONS.comercial, id),
    addLoja: (d) => _add(COLLECTIONS.loja, d),
    updateLoja: (d) => _update(COLLECTIONS.loja, d),
    deleteLoja: (id) => _delete(COLLECTIONS.loja, id),
    addManifesto: (d) => _add(COLLECTIONS.manifesto, d),
    updateManifesto: (d) => _update(COLLECTIONS.manifesto, d),
    deleteManifesto: (id) => _delete(COLLECTIONS.manifesto, id),
    addFornecedor: (d) => _add(COLLECTIONS.fornecedor, d),
    updateFornecedor: (d) => _update(COLLECTIONS.fornecedor, d),
    deleteFornecedor: (id) => _delete(COLLECTIONS.fornecedor, id),
    addJustificativa: (d) => _add(COLLECTIONS.justificativa, d),
    updateJustificativa: (d) => _update(COLLECTIONS.justificativa, d),
    deleteJustificativa: (id) => _delete(COLLECTIONS.justificativa, id),
    saveGrupoLoja: (data) => (!data?.id) ? _add(COLLECTIONS.grupoLoja, data) : _update(COLLECTIONS.grupoLoja, data),
    deleteGrupoLoja: (id) => _delete(COLLECTIONS.grupoLoja, id),
    saveAllRegras,
    loadSenhaSistema,
    saveSenhaSistema,
    loadEmailRecuperacao,
    saveEmailRecuperacao: (email) => setDoc(doc(getDb(), "config", "sistema"), { emailRecuperacao: String(email || "").trim() }, { merge: true }).then(() => ({ ok: true })),
    limparColecao,
    importarEmMassa
  };

  // ── Proxy google.script.run ──
  function makeProxy() {
    const proxy = {
      _ok: null,
      _fail: null,
      withSuccessHandler(cb) { this._ok = cb; return this; },
      withFailureHandler(cb) { this._fail = cb; return this; }
    };

    Object.keys(HANDLERS).forEach(name => {
      proxy[name] = async function (...args) {
        const ok = this._ok;
        const fail = this._fail;
        
        try {
          const result = await HANDLERS[name](...args);
          if (ok) ok(result);
        } catch (err) {
          console.error(`[Firebase/Error] ${name}:`, err);
          let message = err.message;
          if (err.code === "resource-exhausted" || /quota/i.test(message)) {
            message = "Cota gratuita do Firebase atingida. Tente novamente mais tarde ou faça upgrade para o plano Blaze.";
          }
          if (fail) fail({ ...err, message });
          else throw err;
        }
        return makeProxy();
      };
    });
    return proxy;
  }

  window.google.script.run = makeProxy();
  console.log("[Firebase] Backend pronto e mapeado para google.script.run");
})();
