// ════════════════════════════════════════════════════════════════
//  FIREBASE-INIT — Agora existem DOIS "bancos":
//
//  1) CENTRAL (window.dbCentral) — o projeto Firebase abaixo (errosnfe).
//     Guarda só o DIRETÓRIO de usuários/clientes (login, senha,
//     empresa, e o firebaseConfig do banco PRÓPRIO de cada cliente).
//     Esse projeto é sempre o mesmo, pra qualquer pessoa que abrir o site.
//
//  2) TENANT (window.dbTenant) — o projeto Firebase PRÓPRIO do cliente
//     que fez login. É inicializado dinamicamente DEPOIS do login,
//     usando o firebaseConfig que está salvo no registro dele no
//     diretório central. Todo o resto do sistema (histórico, erros,
//     fornecedores etc.) usa esse banco daqui pra frente — é o que
//     o polyfill.js lê via getDb().
//
//  Precisa carregar DEPOIS dos SDKs compat (app + firestore) e
//  ANTES do polyfill.js.
// ════════════════════════════════════════════════════════════════

const firebaseConfigCentral = {
  apiKey: "AIzaSyB8RHXnVG4tfWz8wtHVJkAR14mfYKRkvTM",
  authDomain: "errosnfe-admin.firebaseapp.com",
  projectId: "errosnfe-admin",
  storageBucket: "errosnfe-admin.firebasestorage.app",
  messagingSenderId: "86001837648",
  appId: "1:86001837648:web:4b89a471d72e497e92d355"
};

firebase.initializeApp(firebaseConfigCentral); // app "default" = diretório central
window.dbCentral = firebase.firestore();
window.dbTenant = null; // só existe depois que um cliente faz login

// ── Inicializa (ou troca) o Firebase do cliente logado ──
function _initTenantFirebase(cfg) {
  // Se já havia um tenant carregado (ex: logout e login com outra conta
  // sem recarregar a página), remove o app anterior antes de criar outro.
  const existente = firebase.apps.find(a => a.name === 'tenant');
  if (existente) {
    try { existente.delete(); } catch (e) { console.warn('Falha ao remover app tenant anterior:', e); }
  }
  const app = firebase.initializeApp(cfg, 'tenant');
  window.dbTenant = app.firestore();
  console.log('[Firebase] Banco do cliente conectado — projeto:', cfg.projectId);
  return window.dbTenant;
}

console.log('[Firebase] Diretório central inicializado — projeto:', firebaseConfigCentral.projectId);
