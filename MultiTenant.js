// ════════════════════════════════════════════════════════════════
//  MULTI-TENANT — Login (usuário/senha) + Painel ADM de usuários
//
//  Como funciona:
//  - window.dbCentral (de firebase-init.js) guarda o DIRETÓRIO de
//    usuários na coleção "usuarios": { usuario, senha, empresa,
//    ativo, isAdmin, firebaseConfig, senhaSistemaAtual }
//  - Ao logar como cliente normal, pegamos o firebaseConfig salvo
//    nesse registro e inicializamos o banco PRÓPRIO dele
//    (_initTenantFirebase, em firebase-init.js) → window.dbTenant.
//    Daí em diante todo o sistema (histórico, cadastros etc.) lê e
//    grava nesse banco, via polyfill.js.
//  - Ao logar como usuário com isAdmin:true, abre o Painel Admin
//    em vez do sistema normal — CRUD da coleção "usuarios".
//
//  IMPORTANTE — bootstrap do primeiro usuário ADM:
//  Esta coleção começa vazia. Pra criar o primeiro ADM, entre no
//  Console do Firebase → Firestore Database → projeto "errosnfe" →
//  crie a coleção "usuarios" → adicione um documento com os campos:
//    usuario: "admin"  (ou o que preferir)
//    senha: "escolha-uma-senha-forte"
//    isAdmin: true
//    ativo: true
//  Depois disso, logins seguintes (novos clientes) podem ser
//  cadastrados direto pelo Painel Admin, sem precisar mexer no
//  Console de novo.
//
//  Precisa carregar DEPOIS de: firebase-init.js, polyfill.js, scripts.js
// ════════════════════════════════════════════════════════════════

let _usuarioLogadoDoc = null;
window._LOGIN_MODO_ESCOLHIDO = 'view'; // padrão inicial da tela de login

function _selecionarModoLogin(modo) {
  window._LOGIN_MODO_ESCOLHIDO = modo;
  const btnView = document.getElementById('login-modo-view');
  const btnEdit = document.getElementById('login-modo-edit');
  const ativo = 'background:var(--accent);border:1px solid var(--accent);color:#000';
  const inativo = 'background:transparent;border:1px solid var(--accent);color:var(--accent)';
  const base = 'flex:1;padding:10px;';
  if (modo === 'view') {
    btnView.style.cssText = base + ativo;
    btnEdit.style.cssText = base + inativo;
  } else {
    btnView.style.cssText = base + inativo;
    btnEdit.style.cssText = base + ativo;
  }
}

// Lê a senha de edição atual direto do banco do cliente já conectado
// (window.dbTenant). Usada só durante o login, antes do resto do
// sistema (polyfill/scripts) estar totalmente de pé.
async function _lerSenhaEdicaoTenantAtual() {
  const snap = await window.dbTenant.collection('config').doc('sistema').get();
  return snap.exists ? (snap.data().senha || '@MANIFESTO') : '@MANIFESTO';
}

async function fazerLogin() {
  const usuario = (document.getElementById('login-usuario-inp').value || '').trim().toLowerCase();
  const senha = document.getElementById('login-senha-inp').value || '';
  const modo = window._LOGIN_MODO_ESCOLHIDO || 'view';
  const erroEl = document.getElementById('login-erro');
  const btn = document.getElementById('login-btn');
  erroEl.style.display = 'none';

  if (!usuario || !senha) {
    erroEl.textContent = '✕ Informe usuário e senha';
    erroEl.style.display = 'block';
    return;
  }

  btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    const snap = await window.dbCentral.collection('usuarios').where('usuario', '==', usuario).limit(1).get();
    if (snap.empty) throw new Error('usuário não encontrado');

    const doc = snap.docs[0];
    const dados = doc.data();

    // ── Login como ADMIN → ignora Visualizar/Editar, abre o painel ──
    if (dados.isAdmin) {
      if (String(dados.senha) !== String(senha)) throw new Error('senha incorreta');
      _usuarioLogadoDoc = Object.assign({ id: doc.id }, dados);
      document.getElementById('tela-login').style.display = 'none';
      abrirPainelAdmin();
      return;
    }

    // ── Login como CLIENTE normal ──
    if (dados.ativo === false) {
      erroEl.textContent = '✕ Este usuário está desativado. Fale com o administrador.';
      erroEl.style.display = 'block';
      return;
    }
    if (!dados.firebaseConfig || !dados.firebaseConfig.projectId) {
      erroEl.textContent = '✕ Este usuário ainda não tem um banco configurado. Fale com o administrador.';
      erroEl.style.display = 'block';
      return;
    }

    // Conecta no banco do cliente ANTES de checar a senha de edição,
    // já que ela mora dentro do banco dele (não no diretório central).
    window.CURRENT_USUARIO_ID = doc.id;
    _initTenantFirebase(dados.firebaseConfig);

    if (modo === 'edit') {
      const senhaEdicaoReal = await _lerSenhaEdicaoTenantAtual();
      if (String(senha) !== String(senhaEdicaoReal)) throw new Error('senha incorreta');
      window._MODO_VISUALIZACAO = false;
      SENHA_EDICAO = senhaEdicaoReal;
    } else {
      // Visualizar: a senha é conferida contra a "Senha de Visualização"
      // cadastrada pelo admin no diretório central.
      if (String(dados.senha) !== String(senha)) throw new Error('senha incorreta');
      window._MODO_VISUALIZACAO = true;
    }

    _usuarioLogadoDoc = Object.assign({ id: doc.id }, dados);

    document.getElementById('tela-login').style.display = 'none';
    const tela = document.getElementById('tela-perfil');
    if (tela) tela.style.display = 'flex';
  } catch (e) {
    console.error('Erro no login:', e);
    erroEl.textContent = '✕ Usuário ou senha incorretos';
    erroEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

function logoutAdmin() {
  document.getElementById('tela-admin').style.display = 'none';
  document.getElementById('tela-login').style.display = 'flex';
  document.getElementById('login-usuario-inp').value = '';
  document.getElementById('login-senha-inp').value = '';
  document.getElementById('login-erro').style.display = 'none';
  _usuarioLogadoDoc = null;
}

// ════════════════════════════════════════════════════════════════
//  PAINEL ADM — listar / incluir / editar / excluir usuários
// ════════════════════════════════════════════════════════════════

async function abrirPainelAdmin() {
  document.getElementById('tela-admin').style.display = 'flex';
  await _renderListaUsuarios();
}

async function _renderListaUsuarios() {
  const box = document.getElementById('admin-usuarios-lista');
  box.textContent = 'Carregando…';
  try {
    const snap = await window.dbCentral.collection('usuarios').orderBy('usuario').get();
    const usuarios = snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    if (!usuarios.length) {
      box.innerHTML = '<div class="nd">Nenhum usuário cadastrado ainda. Clique em "➕ Novo Usuário".</div>';
      return;
    }
    box.innerHTML = usuarios.map(u => {
      const detalhes = u.isAdmin
        ? `usuário: ${esc(u.usuario)}`
        : `usuário: ${esc(u.usuario)} · senha de visualização: <span class="senha-oculta" data-valor="${esc(u.senha || '')}">••••••</span>` +
          (u.senhaSistemaAtual ? ` · senha do sistema (edição): <span class="senha-oculta" data-valor="${esc(u.senhaSistemaAtual)}">••••••</span>` : '') +
          (u.firebaseConfig && u.firebaseConfig.projectId ? ' · projeto: ' + esc(u.firebaseConfig.projectId) : '');
      return `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <div>
          <div style="font-weight:700">
            ${esc(u.empresa || u.usuario)}
            ${u.isAdmin ? ' <span style="color:var(--accent);font-size:.68rem">(ADMIN)</span>' : ''}
            ${u.ativo === false ? ' <span style="color:var(--danger);font-size:.68rem">(inativo)</span>' : ''}
          </div>
          <div style="font-family:'DM Mono',monospace;font-size:.74rem;color:var(--muted)">
            ${detalhes}
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          ${!u.isAdmin ? `<button class="btn btn-o btn-sm" onclick="_toggleSenhasLinha(this)">👁 Ver senhas</button>` : ''}
          <button class="btn btn-o btn-sm" onclick="abrirFormUsuario('${u.id}')">Editar</button>
          ${!u.isAdmin ? `<button class="btn btn-d btn-sm" onclick="excluirUsuario('${u.id}')">Excluir</button>` : ''}
        </div>
      </div>
    `;
    }).join('');
  } catch (e) {
    console.error(e);
    box.innerHTML = '<div class="nd">Erro ao carregar usuários: ' + esc(e.message) + '</div>';
  }
}

function _toggleSenhasLinha(btn) {
  const linha = btn.closest('div[style*="justify-content:space-between"]');
  const spans = linha.querySelectorAll('.senha-oculta');
  const revelado = btn.textContent.includes('Ocultar');
  spans.forEach(s => { s.textContent = revelado ? '••••••' : s.dataset.valor; });
  btn.textContent = revelado ? '👁 Ver senhas' : '🙈 Ocultar senhas';
}

async function abrirFormUsuario(id) {
  document.getElementById('usu-doc-id').value = id || '';
  document.getElementById('modal-usuario-titulo').textContent = id ? '✏️ Editar Usuário' : '➕ Novo Usuário';
  ['usu-usuario', 'usu-senha', 'usu-empresa', 'usu-apiKey', 'usu-authDomain', 'usu-projectId', 'usu-storageBucket', 'usu-messagingSenderId', 'usu-appId', 'usu-senha-sistema']
    .forEach(fid => { document.getElementById(fid).value = ''; });
  document.getElementById('usu-ativo').checked = true;
  document.getElementById('usu-senha-sistema-wrap').style.display = id ? 'block' : 'none';

  if (id) {
    try {
      const doc = await window.dbCentral.collection('usuarios').doc(id).get();
      if (doc.exists) {
        const d = doc.data();
        document.getElementById('usu-usuario').value = d.usuario || '';
        document.getElementById('usu-senha').value = d.senha || '';
        document.getElementById('usu-empresa').value = d.empresa || '';
        document.getElementById('usu-ativo').checked = d.ativo !== false;
        const cfg = d.firebaseConfig || {};
        document.getElementById('usu-apiKey').value = cfg.apiKey || '';
        document.getElementById('usu-authDomain').value = cfg.authDomain || '';
        document.getElementById('usu-projectId').value = cfg.projectId || '';
        document.getElementById('usu-storageBucket').value = cfg.storageBucket || '';
        document.getElementById('usu-messagingSenderId').value = cfg.messagingSenderId || '';
        document.getElementById('usu-appId').value = cfg.appId || '';

        // Busca a senha do sistema AO VIVO direto no banco do cliente — não
        // depende do espelho central, então aparece mesmo que o cliente
        // nunca tenha trocado a senha (valor padrão de fábrica incluso).
        // Não se aplica à própria conta do admin (ela não tem banco de cliente).
        const wrapSenhaSistema = document.getElementById('usu-senha-sistema-wrap');
        if (d.isAdmin) {
          wrapSenhaSistema.style.display = 'none';
        } else {
          wrapSenhaSistema.style.display = 'block';
          const senhaInp = document.getElementById('usu-senha-sistema');
          senhaInp.placeholder = 'Carregando…';
          if (cfg.projectId) {
            try {
              const senhaAtualReal = await _lerSenhaSistemaDoTenant(cfg);
              senhaInp.value = senhaAtualReal;
              senhaInp.placeholder = 'deixe em branco pra não alterar';
            } catch (e) {
              console.error('Erro ao ler senha do sistema do cliente:', e);
              senhaInp.placeholder = 'Não foi possível ler (verifique as regras do Firestore desse cliente)';
            }
          } else {
            senhaInp.placeholder = 'Este cliente ainda não tem Firebase configurado';
          }
        }
      }
    } catch (e) { console.error(e); }
  }
  document.getElementById('modal-usuario').classList.add('open');
}

// Lê a senha do sistema (edição) direto do banco do próprio cliente,
// abrindo uma conexão temporária e fechando em seguida.
async function _lerSenhaSistemaDoTenant(firebaseConfig) {
  const nomeApp = 'admin-read-temp';
  const existente = firebase.apps.find(a => a.name === nomeApp);
  if (existente) { try { await existente.delete(); } catch (e) {} }
  const app = firebase.initializeApp(firebaseConfig, nomeApp);
  try {
    const db = app.firestore();
    const snap = await db.collection('config').doc('sistema').get();
    return snap.exists ? (snap.data().senha || '@MANIFESTO') : '@MANIFESTO';
  } finally {
    try { await app.delete(); } catch (e) { console.warn('Falha ao fechar conexão temporária:', e); }
  }
}

function fecharFormUsuario() {
  document.getElementById('modal-usuario').classList.remove('open');
}

async function salvarUsuario() {
  const id = document.getElementById('usu-doc-id').value;
  const usuario = document.getElementById('usu-usuario').value.trim().toLowerCase();
  const senha = document.getElementById('usu-senha').value.trim();
  const empresa = document.getElementById('usu-empresa').value.trim();
  const ativo = document.getElementById('usu-ativo').checked;
  const novaSenhaSistema = document.getElementById('usu-senha-sistema').value.trim();
  const firebaseConfig = {
    apiKey: document.getElementById('usu-apiKey').value.trim(),
    authDomain: document.getElementById('usu-authDomain').value.trim(),
    projectId: document.getElementById('usu-projectId').value.trim(),
    storageBucket: document.getElementById('usu-storageBucket').value.trim(),
    messagingSenderId: document.getElementById('usu-messagingSenderId').value.trim(),
    appId: document.getElementById('usu-appId').value.trim()
  };

  if (!usuario || !senha) { toast('Preencha usuário e senha!', true); return; }

  const dados = { usuario, senha, empresa, ativo, firebaseConfig };

  try {
    // Se o ADM preencheu uma nova senha do sistema (edição), grava ela
    // DIRETO no banco Firestore do próprio cliente — não só no espelho central.
    if (id && novaSenhaSistema && firebaseConfig.projectId) {
      await _escreverSenhaSistemaNoTenant(firebaseConfig, novaSenhaSistema);
      dados.senhaSistemaAtual = novaSenhaSistema;
      dados.senhaSistemaAtualizadaEm = new Date().toISOString();
    }

    if (id) {
      await window.dbCentral.collection('usuarios').doc(id).set(dados, { merge: true });
      toast('✓ Usuário atualizado!');
    } else {
      dados.isAdmin = false;
      dados.senhaSistemaAtual = '';
      dados.criadoEm = new Date().toISOString();
      await window.dbCentral.collection('usuarios').add(dados);
      toast('✓ Usuário criado!');
    }
    fecharFormUsuario();
    _renderListaUsuarios();
  } catch (e) {
    console.error(e);
    toast('Erro ao salvar usuário: ' + e.message, true);
  }
}

// Abre uma conexão temporária com o Firebase do cliente só pra gravar a
// nova senha do sistema, e fecha essa conexão logo em seguida.
async function _escreverSenhaSistemaNoTenant(firebaseConfig, novaSenha) {
  const nomeApp = 'admin-write-temp';
  const existente = firebase.apps.find(a => a.name === nomeApp);
  if (existente) { try { await existente.delete(); } catch (e) {} }
  const app = firebase.initializeApp(firebaseConfig, nomeApp);
  try {
    const db = app.firestore();
    await db.collection('config').doc('sistema').set({ senha: novaSenha }, { merge: true });
  } finally {
    try { await app.delete(); } catch (e) { console.warn('Falha ao fechar conexão temporária:', e); }
  }
}

async function excluirUsuario(id) {
  if (!confirm('Excluir este usuário?\n\nIsso remove só o ACESSO dele ao login. NÃO apaga o projeto Firebase/dados dele — se quiser apagar os dados de verdade, isso precisa ser feito manualmente no Console do Firebase.')) return;
  try {
    await window.dbCentral.collection('usuarios').doc(id).delete();
    toast('✓ Usuário excluído.');
    _renderListaUsuarios();
  } catch (e) {
    console.error(e);
    toast('Erro ao excluir: ' + e.message, true);
  }
}
