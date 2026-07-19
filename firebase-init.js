// ════════════════════════════════════════════════════════════════
//  FIREBASE-INIT — Inicializa o app Firebase e expõe window.db
//  Precisa carregar DEPOIS dos SDKs compat (app + firestore) e
//  ANTES do polyfill.js.
// ════════════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyDxeJHRulD0P8PxoTJSr3mGOJDjS1JjIrg",
  authDomain: "errosnfe.firebaseapp.com",
  projectId: "errosnfe",
  storageBucket: "errosnfe.firebasestorage.app",
  messagingSenderId: "170174169065",
  appId: "1:170174169065:web:ed89d8e3279afebd2d9578"
};

firebase.initializeApp(firebaseConfig);

window.db = firebase.firestore();

console.log('[Firebase] Inicializado — projeto:', firebaseConfig.projectId);
