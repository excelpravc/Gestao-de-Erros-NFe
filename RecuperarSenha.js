// ════════════════════════════════════════════════════════════════
//  RECUPERAR SENHA — Envia a senha atual do sistema por e-mail
//  usando o EmailJS (não há backend próprio, então o envio é feito
//  direto do navegador via API do EmailJS — plano gratuito cobre
//  200 e-mails/mês).
//
//  ANTES DE USAR, você precisa:
//  1) Criar conta grátis em https://www.emailjs.com
//  2) Email Services → Add New Service → conectar seu Gmail/Outlook
//     → copiar o "Service ID"
//  3) Email Templates → Create New Template → usar as variáveis
//     {{to_email}} e {{senha}} no corpo do e-mail → copiar o
//     "Template ID"
//  4) Account → General → copiar a "Public Key"
//  5) Colar os 3 valores abaixo, no lugar de "COLE_AQUI..."
// ════════════════════════════════════════════════════════════════

const EMAILJS_PUBLIC_KEY  = 'COLE_AQUI_A_PUBLIC_KEY';
const EMAILJS_SERVICE_ID  = 'COLE_AQUI_O_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'COLE_AQUI_O_TEMPLATE_ID';

if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY.indexOf('COLE_AQUI') === -1) {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}

function _mascararEmail(email) {
  const m = String(email || '').match(/^(.{1,2}).*(@.+)$/);
  return m ? (m[1] + '***' + m[2]) : email;
}

async function enviarSenhaEsquecida() {
  const link = document.getElementById('esqueci-senha-link');
  if (typeof emailjs === 'undefined' || EMAILJS_PUBLIC_KEY.indexOf('COLE_AQUI') !== -1) {
    alert('O envio de e-mail ainda não foi configurado pelo administrador do sistema (EmailJS).');
    return;
  }
  if (link) { link.textContent = 'Enviando…'; link.style.pointerEvents = 'none'; }
  try {
    const email = await new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).loadEmailRecuperacao();
    });
    if (!email) {
      alert('Nenhum e-mail de recuperação foi cadastrado ainda.\nPeça para um administrador cadastrar em Configurações → Senha do Sistema → E-mail de Recuperação.');
      return;
    }
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: email,
      senha: SENHA_EDICAO
    });
    alert('✓ A senha atual foi enviada para ' + _mascararEmail(email));
  } catch (e) {
    console.error('Erro ao enviar senha por e-mail:', e);
    alert('Não foi possível enviar o e-mail agora. Tente novamente em instantes.');
  } finally {
    if (link) { link.textContent = 'Esqueci minha senha'; link.style.pointerEvents = ''; }
  }
}

// ── Campo "E-mail de Recuperação" na página de Configurações ──
async function salvarEmailRecuperacao() {
  const inp = document.getElementById('cfg-email-recup');
  const email = inp ? inp.value.trim() : '';
  if (!email || !email.includes('@')) { toast('Digite um e-mail válido.', true); return; }
  try {
    await new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).saveEmailRecuperacao(email);
    });
    toast('✓ E-mail de recuperação salvo!');
  } catch (e) {
    toast('Erro ao salvar e-mail: ' + (e && e.message ? e.message : e), true);
  }
}

async function _carregarEmailRecuperacao() {
  const inp = document.getElementById('cfg-email-recup');
  if (!inp) return;
  try {
    const email = await new Promise((resolve, reject) => {
      google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).loadEmailRecuperacao();
    });
    if (email) inp.value = email;
  } catch (e) { console.error('Erro ao carregar e-mail de recuperação:', e); }
}
document.addEventListener('DOMContentLoaded', function () { setTimeout(_carregarEmailRecuperacao, 1200); });
