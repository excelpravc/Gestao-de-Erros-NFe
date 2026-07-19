// ════════════════════════════════════════════════════════════════
//  POLYFILL — Intercepta google.script.run e redireciona para API
// ════════════════════════════════════════════════════════════════

(function() {
  // Simula o objeto google.script.run
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  
  const API_BASE = '/api'; // Next.js API routes
  
  // Mapeia todas as funções do Code.gs para chamadas fetch
  const methods = [
    'loadAll', 'loadHistFiltrado', 'addHistorico', 'updateHistorico',
    'deleteHistorico', 'updateHistoricoSituacaoPorDANF',
    'loadAssinatura', 'saveAssinatura',
    'addComprador', 'updateComprador', 'deleteComprador',
    'addComercial', 'updateComercial', 'deleteComercial',
    'addLoja', 'updateLoja', 'deleteLoja',
    'addManifesto', 'updateManifesto', 'deleteManifesto',
    'addCodErro', 'updateCodErro', 'deleteCodErro',
    'addFornecedor', 'updateFornecedor', 'deleteFornecedor',
    'saveAllRegras', 'deleteRegra',
    'addJustificativa', 'updateJustificativa', 'deleteJustificativa',
    'saveGrupoLoja', 'deleteGrupoLoja',
    'loadSenhaSistema', 'saveSenhaSistema'
  ];
  
  // Cria proxy para google.script.run
  const scriptProxy = {
    withSuccessHandler: function(callback) {
      this._successHandler = callback;
      return this;
    },
    withFailureHandler: function(callback) {
      this._failureHandler = callback;
      return this;
    }
  };
  
  // Adiciona todos os métodos dinamicamente
  methods.forEach(method => {
    scriptProxy[method] = function(...args) {
      const self = this;
      
      // Determina o perfil atual (se disponível)
      const perfil = window._PERFIL ? window._PERFIL.nome : 'Lojas';
      
      // Chama a API
      fetch(`${API_BASE}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args, perfil })
      })
      .then(res => res.json())
      .then(data => {
        if (self._successHandler) {
          self._successHandler(data);
        }
      })
      .catch(err => {
        console.error(`[Polyfill] Erro em ${method}:`, err);
        if (self._failureHandler) {
          self._failureHandler(err);
        }
      });
      
      return this;
    };
  });
  
  window.google.script.run = scriptProxy;
  
  console.log('[Polyfill] google.script.run interceptado com sucesso!');
})();
