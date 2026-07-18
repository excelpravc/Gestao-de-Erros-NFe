
// ════════════════════════════════════════════════════════════════
//  PERFIL_MATRIZ — Configurações e overrides do perfil Matriz
//  - Histórico: Historico_Matriz
//  - Campo Loja: fixo "Matriz" (não editável)
//  - Menu lateral: SEM aba "Lojas"
//  - Dashboard NFS: habilitado (pertence a este perfil)
//  - Gráficos: independentes (definidos aqui, delegados pelo Scripts.html)
// ════════════════════════════════════════════════════════════════
window._PERFIL = {
nome:  'Matriz',
emoji: '🏢',
cor:   '#4d9fff',
histSheet: 'Historico_Matriz',
};

// ── Aplicar perfil assim que o DOM estiver pronto ──
document.addEventListener('DOMContentLoaded', function() {
_aplicarPerfilMatriz();
});

function _aplicarPerfilMatriz() {
// 1. Oculta aba "Lojas" no menu lateral
const tabLoja = document.querySelector('.sb .tab[onclick*="p-loja"]');
if (tabLoja) tabLoja.style.display = 'none';

// 2. Campo Loja no formulário: fixa como "Matriz" e bloqueia
_fixarLojaMatriz();

// 3. Títulos dos gráficos corretos para o perfil Matriz
const ctErrosPie = document.getElementById('ct-erros-pie');
if (ctErrosPie) ctErrosPie.textContent = '⚠️ Ranking Erros';
const ctLojas = document.getElementById('ct-lojas');
if (ctLojas) ctLojas.textContent = ' Ranking Lojas';
}

// ── Fixa o campo loja como "Matriz" e bloqueia edição ──
function _fixarLojaMatriz() {
if (!window._PERFIL || window._PERFIL.nome !== 'Matriz') return;
const selLoja = document.getElementById('sel_loja');
if (!selLoja) return;

// Injeta a opção Matriz se não existir
let optMatriz = Array.from(selLoja.options).find(o => o.value === '__matriz__');
if (!optMatriz) {
optMatriz = document.createElement('option');
optMatriz.value       = '__matriz__';
optMatriz.textContent = 'Matriz';
optMatriz.dataset.email = '';
optMatriz.dataset.nome  = 'Matriz';
selLoja.appendChild(optMatriz);
}

selLoja.value    = '__matriz__';
selLoja.disabled = true;
selLoja.style.opacity = '1';

// Preenche hidden fields
const he = document.getElementById('hid_loja_email');
const hn = document.getElementById('hid_loja_nome');
const dp = document.getElementById('em_loja');
if (he) he.value = '';
if (hn) hn.value = 'Matriz';
if (dp) { dp.textContent = 'Matriz'; dp.className = 'ps-email filled'; }
}

// ── Override: buildSelects — NÃO popula sel_loja com a lista da planilha ──
//    Chamado APÓS o buildSelects original do Scripts.html
document.addEventListener('_sistemaCarregado', function() {
if (!window._PERFIL || window._PERFIL.nome !== 'Matriz') return;
_fixarLojaMatriz();

// Esconde a opção de "Loja Fixa" nas configurações (não faz sentido para Matriz)
const lojaFixaCard = document.querySelector('#p-config .card:has(#cfg-loja-fixa)');
if (lojaFixaCard) lojaFixaCard.style.display = 'none';

// Esconde linha de loja no formulário de configurações de campo
const tglLoja = document.getElementById('tgl-f-loja');
if (tglLoja) tglLoja.style.display = 'none';
});

// ── Override: applyLojaFixa — ignora loja fixa e sempre re-aplica Matriz ──
//    Este override substitui o comportamento da função no Scripts.html
window._applyLojaFixaOriginal = null; // será setado pelo Scripts.html
document.addEventListener('_applyLojaFixaHook', function() {
_fixarLojaMatriz();
});

// ════════════════════════════════════════════════════════════════
//  GRÁFICOS INDEPENDENTES — PERFIL MATRIZ
//  Cópia idêntica das funções originais do Scripts.html.
//  Para customizar este perfil no futuro, edite apenas este bloco.
// ════════════════════════════════════════════════════════════════

// ── KPIs ──
window._renderKpis = function(r) {
const uniq = (arr, key) => [...new Set(arr.map(x => x[key]).filter(Boolean))].length;
document.getElementById('kpi-tot').textContent  = r.length;
document.getElementById('kpi-forn').textContent = uniq(r, 'fornecedor');
document.getElementById('kpi-errt').textContent = uniq(r, 'erroDesc');
document.getElementById('kpi-loja').textContent = uniq(r, 'loja');
};

// ── Pizza de Erros ──
window._renderChartErrosPie = function(r) {
destroyChart('ch-erros-pie');
const data = countBy(r, 'erroDesc').slice(0, 8);
toggleChart('ch-erros-pie', 'ch-erros-nd', data.length > 0);
if (!data.length) return;
const ctx = document.getElementById('ch-erros-pie').getContext('2d');
const pieInsidePlugin = {
id: 'pieInside',
afterDatasetsDraw(chart) {
const ctx2 = chart.ctx;
const meta = chart.getDatasetMeta(0);
meta.data.forEach((arc, i) => {
const val = chart.data.datasets[0].data[i];
if (!val) return;
const label = chart.data.labels[i] || '';
const cx = (arc.startAngle + arc.endAngle) / 2;
const r2 = (arc.outerRadius + arc.innerRadius) / 2;
const x = arc.x + r2 * Math.cos(cx);
const y = arc.y + r2 * Math.sin(cx);
const pct = Math.round(val / chart.data.datasets[0].data.reduce((a, b) => a + b, 0) * 100);
if (pct < 5) return;
ctx2.save();
ctx2.font = 'bold 10px Arial'; ctx2.fillStyle = '#fff';
ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
const maxW = (arc.outerRadius - arc.innerRadius) * 0.9;
let lbl = label;
while (ctx2.measureText(lbl).width > maxW && lbl.length > 3) lbl = lbl.slice(0, -1);
if (lbl !== label) lbl = lbl.slice(0, -1) + '…';
ctx2.fillText(lbl, x, y - 7);
ctx2.font = 'bold 11px Arial';
ctx2.fillText(val + ' (' + pct + '%)', x, y + 7);
ctx2.restore();
});
}
};
_charts['ch-erros-pie'] = new Chart(ctx, {
type: 'doughnut',
data: {
labels: data.map(d => d[0]),
datasets: [{ data: data.map(d => d[1]), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: '#1a2236' }]
},
plugins: [pieInsidePlugin],
options: {
responsive: true, maintainAspectRatio: true,
plugins: {
legend: { display: true, position: 'bottom', labels: { color: '#e8edf8', font: { family: "'DM Mono',monospace", size: 12 }, boxWidth: 20, boxHeight: 20, padding: 14 } },
tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw}` } }
}
}
});
};

// ─ Barras de Lojas ──
window._renderChartLojas = function(r) {
destroyChart('ch-lojas');
const data = countBy(r, 'loja');
toggleChart('ch-lojas', 'ch-lojas-nd', data.length > 0);
if (!data.length) return;
const canvas = document.getElementById('ch-lojas');
const minHeight = Math.max(200, data.length * 32);
canvas.style.maxHeight = minHeight + 'px';
const ctx = canvas.getContext('2d');
_charts['ch-lojas'] = new Chart(ctx, {
type: 'bar',
data: {
labels: data.map(d => d[0]),
datasets: [{ data: data.map(d => d[1]), backgroundColor: '#4d9fff99', borderColor: '#4d9fff', borderWidth: 2, borderRadius: 5 }]
},
plugins: [insideLabelPlugin],
options: {
devicePixelRatio: window.devicePixelRatio || 2,
responsive: true, maintainAspectRatio: false, indexAxis: 'y',
plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `Ocorrências: ${c.raw}` } } },
layout: { padding: { right: 50 } },
scales: {
x: { ticks: { color: '#6b7a99', font: { size: 10 } }, grid: { color: '#1e2d48' }, suggestedMax: (data[0] ? data[0][1] : 1) * 1.35 },
y: { ticks: { display: false }, grid: { display: false } }
}
}
});
};

// ── Linha Diária ──
window._renderChartLinha = function(r, de, ate) {
destroyChart('ch-linha');
const days = [];
const cur = new Date(de + 'T00:00:00'), end = new Date(ate + 'T00:00:00');
while (cur <= end) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }
const counts = {}; days.forEach(d => counts[d] = 0);
r.forEach(x => { const d = parseDataBR(x.data); if (counts[d] !== undefined) counts[d]++; });
toggleChart('ch-linha', 'ch-linha-nd', r.length > 0); if (!r.length) return;
const fmtD = v => { const p = v.split('-'); return `${p[2]}/${p[1]}`; };
const ctx = document.getElementById('ch-linha').getContext('2d');
_charts['ch-linha'] = new Chart(ctx, {
type: 'line',
data: {
labels: days.map(fmtD),
datasets: [{ label: 'Ocorrências', data: days.map(d => counts[d]), borderColor: '#00d4aa', backgroundColor: '#00d4aa18', fill: true, tension: .35, pointBackgroundColor: '#00d4aa', pointRadius: 5, pointHoverRadius: 7, borderWidth: 2.5 }]
},
plugins: [lineLabelPlugin],
options: {
responsive: true, maintainAspectRatio: true,
plugins: { legend: { display: false } }, layout: { padding: { top: 20 } },
scales: {
x: { ticks: { color: '#8899bb', font: { size: 11 }, maxTicksLimit: 14 }, grid: { color: '#1e2d48' } },
y: { ticks: { color: '#8899bb', font: { size: 11 }, stepSize: 1 }, grid: { color: '#1e2d4880' }, suggestedMax: (Math.max(...Object.values(counts)) || 1) * 1.25 }
}
}
});
};

// ── Rankings ──
window._renderRankings_Matriz = function(r) {
// Restaura títulos corretos para o perfil Matriz
const ctErrosPie = document.getElementById('ct-erros-pie');
if(ctErrosPie) ctErrosPie.textContent = '⚠️ Ranking Erros';
const ctLojas = document.getElementById('ct-lojas');
if(ctLojas) ctLojas.textContent = '🏪 Ranking Lojas';

renderRank('rl-forn',      countBy(r, 'fornecedor'), '#4d9fff');
renderRank('rl-erros',     countBy(r, 'erroDesc'),   '#f5a623');
renderRank('rl-erros-pie', countBy(r, 'erroDesc'),   '#f5a623');
renderRank('rl-lojas',     countBy(r, 'loja'),       '#a78bfa');
renderRank('rl-comp',      countBy(r, 'comprador').filter(d => d[0] !== '(sem dado)'), '#00d4aa');
};

// ── Status ──
window._renderChartStatus = function(r) {
destroyChart('ch-status');
const ent = r.filter(x => x.status === 'Entregando').length;
const ant = r.filter(x => x.status === 'Antecipado').length;
const sem = r.filter(x => !x.status || x.status === '').length;
const kEnt = document.getElementById('kpi-ent');
const kAnt = document.getElementById('kpi-ant');
if (kEnt) kEnt.textContent = ent;
if (kAnt) kAnt.textContent = ant;

const canvas = document.getElementById('ch-status');
const nd = document.getElementById('ch-status-nd');
const hasData = (ent + ant + sem) > 0 && r.length > 0;
if (canvas) canvas.style.display = hasData ? 'block' : 'none';
if (nd) nd.style.display = hasData ? 'none' : 'block';
if (!hasData) return;

const total = r.length;
const pct = n => total > 0 ? ' (' + Math.round(n / total * 100) + '%)' : '';

const statusInsidePlugin = {
id: 'statusInside',
afterDatasetsDraw(chart) {
const ctx2 = chart.ctx;
const meta = chart.getDatasetMeta(0);
meta.data.forEach((arc, i) => {
const val = chart.data.datasets[0].data[i]; if (!val) return;
const totalVals = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
const pctVal = Math.round(val / totalVals * 100); if (pctVal < 6) return;
const midAngle = (arc.startAngle + arc.endAngle) / 2;
const radius = (arc.outerRadius + arc.innerRadius) / 2;
const x = arc.x + radius * Math.cos(midAngle);
const y = arc.y + radius * Math.sin(midAngle);
ctx2.save();
ctx2.font = 'bold 11px Arial'; ctx2.fillStyle = '#fff';
ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
ctx2.fillText(val + ' (' + pctVal + '%)', x, y);
ctx2.restore();
});
}
};

const ctx = canvas.getContext('2d');
_charts['ch-status'] = new Chart(ctx, {
type: 'doughnut',
data: {
labels: ['Entregando', 'Antecipado', 'Sem status'],
datasets: [{ data: [ent, ant, sem], backgroundColor: ['#1D9E75', '#BA7517', '#6b7a99'], borderWidth: 2, borderColor: '#1a2236' }]
},
plugins: [statusInsidePlugin],
options: {
responsive: true, maintainAspectRatio: true,
plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.label + ': ' + ctx.raw + pct(ctx.raw) } } }
}
});

const statusData = [
[' Entregando', ent, '#1D9E75'],
['⚡ Antecipado',  ant, '#BA7517'],
].filter(d => d[1] > 0);

const rlEl = document.getElementById('rl-status');
if (!rlEl) return;
if (!statusData.length) { rlEl.innerHTML = '<div class="nd">Sem dados no período</div>'; return; }

const maxVal = Math.max(...statusData.map(d => d[1]));
rlEl.innerHTML = statusData.map((d, i) => {
const pctW = Math.max(15, Math.round(d[1] / maxVal * 100));
return `<div class="ri">
<span class="ri-pos">${i + 1}</span>
<div class="ri-bw">
<div class="ri-b" style="width:${pctW}%;background:${d[2]};color:#fff">
<span class="ri-b-label">${esc(d[0])}</span>
</div>
</div>
<span class="ri-n" style="color:${d[2]}">${d[1]}</span>
</div>`;
}).join('');
};
