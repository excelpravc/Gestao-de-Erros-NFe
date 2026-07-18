// public/polyfill.js
// 🪄 POLYFILL: Substitui o google.script.run por chamadas fetch para a API da Vercel
// Este arquivo deve ser carregado ANTES do scripts.js

if (typeof window !== 'undefined') {
  window.google = window.google || {};
  window.google.script = window.google.script || {};

  const createRunner = () => {
    let successCb = (data) => console.log('[Polyfill] Success:', data);
    let failureCb = (err) => console.error('[Polyfill] Error:', err);

    const runner = {
      withSuccessHandler: function(cb) { successCb = cb; return runner; },
      withFailureHandler: function(cb) { failureCb = cb; return runner; },
    };

    return new Proxy(runner, {
      get(target, prop) {
        if (prop === 'withSuccessHandler' || prop === 'withFailureHandler') return target[prop];
        
        // Intercepta qualquer chamada (ex: loadAll, addHistorico, saveSenhaSistema)
        return function(...args) {
          // Pega o perfil atual (Lojas ou Matriz)
          const perfil = window._PERFIL ? window._PERFIL.nome : 'Lojas';
          
          // Envia para a API da Vercel: /api/[nomeDaFuncao]
          fetch(`/api/${String(prop)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ args: args, perfil: perfil })
          })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erro na API');
            successCb(data);
          })
          .catch((err) => {
            console.error(`[Polyfill] Falha em ${String(prop)}:`, err);
            failureCb(err);
          });
          
          return runner; // Mantém a cadeia de métodos
        };
      }
    });
  };

  // Define o getter para google.script.run
  Object.defineProperty(window.google.script, 'run', {
    get: () => createRunner(),
    configurable: true
  });
  
  console.log('[Polyfill] ✅ Sistema de interceptação carregado com sucesso!');
}
