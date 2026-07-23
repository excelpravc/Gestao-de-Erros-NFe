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
  return snap.exists ? (snap.data().senha || '@mudar') : '@mudar';
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
    await _initTenantFirebase(dados.firebaseConfig);

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

    if (typeof _atualizarBadgeModoPerfil === 'function') _atualizarBadgeModoPerfil();
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

    const clientes = usuarios.filter(u => !u.isAdmin);
    const totalEl = document.getElementById('admin-kpi-total');
    const ativosEl = document.getElementById('admin-kpi-ativos');
    const inativosEl = document.getElementById('admin-kpi-inativos');
    if (totalEl) totalEl.textContent = clientes.length;
    if (ativosEl) ativosEl.textContent = clientes.filter(u => u.ativo !== false).length;
    if (inativosEl) inativosEl.textContent = clientes.filter(u => u.ativo === false).length;

    if (!usuarios.length) {
      box.innerHTML = '<div class="nd">Nenhum usuário cadastrado ainda. Clique em "➕ Novo Usuário".</div>';
      return;
    }
    box.innerHTML = usuarios.map(u => {
      const inicial = (u.empresa || u.usuario || '?').trim().charAt(0).toUpperCase();
      const corAvatar = u.isAdmin ? 'var(--accent)' : (u.ativo === false ? 'var(--muted)' : '#4d9fff');
      const detalhes = u.isAdmin
        ? `<span style="color:var(--muted)">usuário:</span> ${esc(u.usuario)}`
        : `<span style="color:var(--muted)">usuário:</span> ${esc(u.usuario)}` +
          ` &nbsp;·&nbsp; <span style="color:var(--muted)">visualização:</span> <span class="senha-oculta" data-valor="${esc(u.senha || '')}">••••••</span>` +
          (u.senhaSistemaAtual ? ` &nbsp;·&nbsp; <span style="color:var(--muted)">edição:</span> <span class="senha-oculta" data-valor="${esc(u.senhaSistemaAtual)}">••••••</span>` : '') +
          (u.firebaseConfig && u.firebaseConfig.projectId ? `<br><span style="color:var(--muted)">projeto:</span> ${esc(u.firebaseConfig.projectId)}` : '');
      return `
      <div class="usu-row" style="display:flex;justify-content:space-between;align-items:center;gap:14px;
      background:var(--card2);border:1px solid var(--border);border-radius:14px;
      padding:16px 18px;margin-bottom:10px;flex-wrap:wrap;transition:border-color .2s"
      onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="display:flex;gap:14px;align-items:center;min-width:0">
          <div style="width:42px;height:42px;border-radius:50%;background:${corAvatar}22;border:1.5px solid ${corAvatar};
          color:${corAvatar};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.1rem;flex-shrink:0">
            ${esc(inicial)}
          </div>
          <div style="min-width:0">
            <div style="font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              ${esc(u.empresa || u.usuario)}
              ${u.isAdmin ? '<span style="background:var(--accent);color:#000;font-size:.6rem;font-weight:800;letter-spacing:.5px;padding:2px 8px;border-radius:20px">ADMIN</span>' : ''}
              ${u.ativo === false ? '<span style="background:var(--danger);color:#fff;font-size:.6rem;font-weight:800;letter-spacing:.5px;padding:2px 8px;border-radius:20px">INATIVO</span>' : ''}
            </div>
            <div style="font-family:'DM Mono',monospace;font-size:.72rem;color:var(--text);margin-top:4px;line-height:1.6">
              ${detalhes}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          ${!u.isAdmin ? `<button class="btn btn-o btn-sm" onclick="_toggleSenhasLinha(this)">👁 Ver senhas</button>` : ''}
          <button class="btn btn-o btn-sm" onclick="abrirFormUsuario('${u.id}')">✏ Editar</button>
          ${!u.isAdmin ? `<button class="btn btn-d btn-sm" onclick="excluirUsuario('${u.id}', '${esc(u.empresa || u.usuario)}')">🗑 Excluir</button>` : ''}
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
  const linha = btn.closest('.usu-row');
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
    return snap.exists ? (snap.data().senha || '@mudar') : '@mudar';
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

// ── Modal de confirmação genérico e estilizado (substitui o confirm() nativo) ──
function confirmModal({ icon = '⚠️', title = 'Confirmar ação', desc = '', confirmLabel = 'Confirmar' } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-confirm-generico');
    document.getElementById('mcg-icon').textContent = icon;
    document.getElementById('mcg-title').textContent = title;
    document.getElementById('mcg-desc').innerHTML = desc;
    const btnConfirm = document.getElementById('mcg-confirm');
    const btnCancel = document.getElementById('mcg-cancel');
    btnConfirm.textContent = confirmLabel;

    function fechar(resultado) {
      modal.classList.remove('open');
      btnConfirm.removeEventListener('click', onConfirm);
      btnCancel.removeEventListener('click', onCancel);
      resolve(resultado);
    }
    function onConfirm() { fechar(true); }
    function onCancel() { fechar(false); }
    btnConfirm.addEventListener('click', onConfirm);
    btnCancel.addEventListener('click', onCancel);
    modal.classList.add('open');
  });
}

async function excluirUsuario(id, nomeExibicao) {
  const ok = await confirmModal({
    icon: '🗑️',
    title: 'Excluir usuário',
    desc: `Deseja realmente excluir <strong style="color:var(--text)">${esc(nomeExibicao || '')}</strong>?<br><br>Isso remove só o ACESSO dele ao login. NÃO apaga o projeto Firebase/dados dele — se quiser apagar os dados de verdade, isso precisa ser feito manualmente no Console do Firebase.`,
    confirmLabel: '🗑 Excluir'
  });
  if (!ok) return;
  try {
    await window.dbCentral.collection('usuarios').doc(id).delete();
    toast('✓ Usuário excluído.');
    _renderListaUsuarios();
  } catch (e) {
    console.error(e);
    toast('Erro ao excluir: ' + e.message, true);
  }
}
// ── Cliente troca a própria Senha de Visualização (gravada no diretório central) ──
async function alterarSenhaVisualizacao() {
  const atual = (document.getElementById('senha-view-atual')?.value || '').trim();
  const nova = (document.getElementById('senha-view-nova')?.value || '').trim();
  const confirma = (document.getElementById('senha-view-confirma')?.value || '').trim();
  if (!atual) { toast('Informe a senha atual!', true); return; }
  if (!nova) { toast('Informe a nova senha!', true); return; }
  if (nova.length < 4) { toast('A nova senha deve ter pelo menos 4 caracteres!', true); return; }
  if (nova !== confirma) { toast('A confirmação não coincide com a nova senha!', true); return; }
  if (!window.CURRENT_USUARIO_ID) { toast('Não foi possível identificar o usuário logado.', true); return; }

  const btn = document.querySelector('button[onclick="alterarSenhaVisualizacao()"]');
  if (btn) { btn.textContent = '⏳ Salvando…'; btn.disabled = true; }
  try {
    const ref = window.dbCentral.collection('usuarios').doc(window.CURRENT_USUARIO_ID);
    const snap = await ref.get();
    const senhaSalva = snap.exists ? (snap.data().senha || '') : '';
    if (String(atual) !== String(senhaSalva)) {
      toast('Senha atual incorreta!', true);
      return;
    }
    await ref.update({ senha: nova });
    ['senha-view-atual', 'senha-view-nova', 'senha-view-confirma'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    toast('✓ Senha de visualização alterada com sucesso!');
    const ind = document.getElementById('senha-view-saved-ind');
    if (ind) { ind.textContent = '✓ Nova senha salva'; ind.classList.add('show'); setTimeout(() => ind.classList.remove('show'), 3000); }
  } catch (e) {
    console.error(e);
    toast('Falha: ' + e.message, true);
  } finally {
    if (btn) { btn.textContent = '💾 Alterar Senha de Visualização'; btn.disabled = false; }
  }
}
