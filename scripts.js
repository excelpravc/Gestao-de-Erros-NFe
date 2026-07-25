// ════════════════════════════════════════════════════════════════
//  SCRIPTS.HTML — Base compartilhada
//  As funções de gráfico despacham para window._render* quando
//  definidas pelo perfil ativo (Perfil_Lojas / Perfil_Matriz).
//  Isso garante independência real entre os perfis.
// ════════════════════════════════════════════════════════════════
if (!window._PERFIL) {
window._PERFIL = { nome: 'Lojas', emoji: '🏪', cor: '#00d4aa', histSheet: 'Historico_Lojas' };
}
function _perfilAtivo() { return window._PERFIL.nome; }
function _perfilHist()  { return window._PERFIL.histSheet; }
// ── Compatibilidade Google Sites: PDFs em iframe aninhado ──
// Dentro do Google Sites o app roda em iframe dentro de iframe.
// pdf.save() do jsPDF pode ser bloqueado silenciosamente pelo sandbox.
// Se detectarmos que estamos "framed", abrimos o PDF em nova aba.
function _emIframe() {
try { return window.self !== window.top; } catch (e) { return true; }
}
function _salvarPdfCompativel(pdf, filename) {
if (_emIframe()) {
try {
const blobUrl = pdf.output('bloburl');
const win = window.open(blobUrl, '_blank');
if (win) return;
} catch (e) { /* cai no fallback abaixo */ }
}
try {
pdf.save(filename);
} catch (e) {
toast('Não foi possível baixar o PDF automaticamente. Permita downloads/pop-ups para este site.', true);
}
}
function _key(k) {
const u = (_perfilAtivo() || 'padrao').toLowerCase().replace(/\s+/g, '_');
return u + '_' + k;
}
// ── Helper: despacha para função de perfil se existir, senão usa o fallback local ──
function _dispatch(fnName, fallback, args) {
const perfilFn = window[fnName];
if (typeof perfilFn === 'function') {
return perfilFn.apply(null, args);
}
return fallback.apply(null, args);
}
function _atualizarBadgeUsuario(nome, emoji, cor) {
let badge = document.getElementById('badge-usuario-fixo');
if (!badge) {
badge = document.createElement('div');
badge.id = 'badge-usuario-fixo';
badge.style.cssText = [
'display:flex','align-items:center','gap:8px',
'background:var(--card2)','border:1px solid var(--border)',
'border-radius:10px','padding:8px 12px',
'cursor:pointer','transition:border-color .2s,box-shadow .2s',
'margin-top:8px','width:100%',
].join(';');
badge.title = 'Clique para trocar de perfil';
badge.addEventListener('click', trocarPerfil);
badge.addEventListener('mouseenter', () => { badge.style.boxShadow = '0 6px 24px #00000060'; });
badge.addEventListener('mouseleave', () => { badge.style.boxShadow = ''; });
// Insere no sidebar, logo abaixo do parágrafo de versão
const sbLogo = document.querySelector('.sb-logo');
if (sbLogo) {
sbLogo.appendChild(badge);
}
}
badge.style.borderColor = cor + '50';
const modoTag = window._MODO_VISUALIZACAO
? '<span title="Modo Visualização" style="flex-shrink:0;font-size:.85rem;line-height:1">👁</span>'
: '<span title="Modo Edição" style="flex-shrink:0;font-size:.78rem;line-height:1;color:var(--accent)">✏</span>';
badge.innerHTML =
'<span style="font-size:1.1rem;line-height:1;flex-shrink:0">' + emoji + '</span>' +
'<div style="flex:1;min-width:0">' +
'<div style="font-size:.5rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);line-height:1;margin-bottom:3px">Perfil ativo</div>' +
'<div style="font-size:.82rem;font-weight:800;color:' + cor + ';line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + nome + '</div>' +
'</div>' +
modoTag +
'<span style="font-size:.65rem;color:var(--muted);flex-shrink:0">⇄</span>';
}
function trocarPerfil() {
const badge = document.getElementById('badge-usuario-fixo');
if (badge) badge.remove();
window._PERFIL = null;
// Limpa os campos de "Responsáveis" (Comprador/Comercial/Loja/Manifesto)
// ANTES de mostrar a tela de perfil de novo — sem isso, valores do
// perfil anterior (ex: Loja travada em "Matriz") ficavam "grudados"
// na tela mesmo depois de trocar pro perfil Lojas.
['sel_comp','sel_comerc','sel_loja','sel_manif'].forEach(id=>{
const el=document.getElementById(id);
if (el) { el.innerHTML='<option value="">Selecione…</option>'; el.value=''; el.disabled=false; el.style.opacity=''; el.style.cursor=''; }
});
['em_comp','em_comerc','em_loja','em_manif'].forEach(id=>{
const el=document.getElementById(id);
if (el) { el.textContent='—'; el.className = id==='em_manif' ? 'ps-email' : 'ps-email dis'; }
});
['hid_comp_email','hid_comp_nome','hid_comerc_email','hid_comerc_nome','hid_loja_email','hid_loja_nome','hid_manif_email','hid_manif_nome'].forEach(id=>{
const el=document.getElementById(id);
if (el) el.value='';
});
const tela = document.getElementById('tela-perfil');
if (tela) tela.style.display = 'flex';
}
// ── CORREÇÃO DE CLIQUE ──
const fixMenu = document.createElement('style');
fixMenu.innerHTML = `
.sb .tab { user-select: none !important; -webkit-user-select: none !important; }
.sb .tab * { pointer-events: none !important; }
`;
document.head.appendChild(fixMenu);
// ─ ESTADO GLOBAL ──
let DB={compradores:[],comerciais:[],lojas:[],manifestos:[],codErros:[],fornecedores:[],historico:[],regras:[],justificativas:[],gruposLoja:[]};
let cfg={nome:'',tel:'',cargo:''};
let _histCompleto = []; // Guarda TODOS os registros na memória para paginação

// ════════════════════════════════════════════════════════════════
//  PAGINAÇÃO DO HISTÓRICO
// ════════════════════════════════════════════════════════════════
let _histPaginacao = {
    paginaAtual: 1,
    limite: 100,
    totalRegistros: 0,
    ultimoDocumento: null,
    carregando: false
};
let emailCfg={saudacao:true,intro:true,separadores:true,fornecedor:true,nota:true,descricao:true,status:true,cobranca:false,assinatura:true};
let cobrancaTexto='Assim que for corrigido, favor responder este e-mail.';
let formCfg = { comp: true, comerc: false, loja: true, manif: false, out_para: true, out_cc: true, out_assunto: true, out_corpo: true };
let selErro={codigo:'',descricao:''};
let selErro2={codigo:'',descricao:''};
let selErro3={codigo:'',descricao:''};
let selErro4={codigo:'',descricao:''};
let selForn={codigo:'',nome:''};
let regraAtiva=[];
let acIdx={erro:-1,erro2:-1,erro3:-1,erro4:-1,forn:-1};
let lojaFixa = '';
window.addEventListener('load', () => {
if (!window._PERFIL) {
window._PERFIL = { nome:'Lojas', emoji:'🏪', cor:'#00d4aa', histSheet:'Historico_Lojas' };
}
});
function applyData(d){
DB.compradores=d.compradores||[];DB.comerciais=d.comerciais||[];
DB.lojas=d.lojas||[];DB.manifestos=d.manifestos||[];
DB.codErros=d.codErros||[];DB.fornecedores=d.fornecedores||[];
DB.historico=d.historico||[];DB.regras=d.regras||[];
DB.justificativas=d.justificativas||[];
DB.gruposLoja=d.gruposLoja||[];
applyLojaFixa();
if(d.assinatura) applyCfgFromSheet(d.assinatura);
buildSelects(); popHistFiltros(); renderAll(); renderDash(); renderRegrasEditor();
}
function reloadAll(){
toast('⏳ Atualizando dados da planilha...');
google.script.run
.withSuccessHandler(d=>{ applyData(d); toast('✓ Atualizado!'); })
.withFailureHandler(()=>{ toast('Falha ao atualizar',true); })
.loadAll(_perfilAtivo());
}
function syncOculto(){
google.script.run
.withSuccessHandler(d => { applyData(d); })
.loadAll(_perfilAtivo());
}
function localNextId(list){
if(!list.length) return 1;
return Math.max(...list.map(x=>Number(x.id)||0))+1;
}
function getSaud(){
const h=new Date().getHours();
if(h>=5&&h<12)return{l:'Bom dia',e:'☀️'};
if(h>=12&&h<18)return{l:'Boa tarde',e:'🌤️'};
return{l:'Boa noite',e:'🌙'};
}
function initSaudacao(){
const s=getSaud(),txt=s.e+' '+s.l+'!';
['dash-saudacao','reg-saudacao'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=txt;});
}
function statusBadge(s){
if(!s||s==='') return '<span style="color:var(--muted)">—</span>';
if(s==='Antecipado') return '<span class="btag" style="background:#00d4aa18;color:#00d4aa;border:1px solid #00d4aa30">⚡ Antecipado</span>';
if(s==='Entregando') return '<span class="btag" style="background:#f5a62318;color:#f5a623;border:1px solid #f5a62330">🚚 Entregando</span>';
return '<span class="btag" style="background:#ffffff10;color:var(--muted2)">'+esc(s)+'</span>';
}
// ════════════════════════════════════════════════════════════════
//  DASHBOARD ERROS
// ════════════════════════════════════════════════════════════════
let _charts={};
const CHART_COLORS=[
'#FF3366','#FF9100','#00E676','#00E5FF','#FFEA00',
'#AA00FF','#2979FF','#F50057','#C6FF00','#D500F9',
'#FF3D00','#1DE9B6','#FFC400','#3D5AFE','#F4FF81',
'#00B0FF','#FF8A80','#8C9EFF','#FF6D00','#B2FF59',
];
function todayStr(){
const d=new Date();
return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function initDashDates(){
const hoje=new Date();
const fmt=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
document.getElementById('dash-de').value=fmt(hoje);
document.getElementById('dash-ate').value=fmt(hoje);
}
function parseDataBR(s){
if(!s||typeof s!=='string')return'1900-01-01';
const p=s.trim().split('/');
if(p.length===3){
const dia=String(p[0]).padStart(2,'0');
const mes=String(p[1]).padStart(2,'0');
const ano=String(p[2]);
if(ano.length===4&&Number(dia)>0&&Number(mes)>0) return`${ano}-${mes}-${dia}`;
}
if(s.length===10&&s.includes('-'))return s;
return'1900-01-01';
}
function populateDashFilters(){
var sLoja=document.getElementById('dash-loja');
var sErro=document.getElementById('dash-erro');
if(!sLoja||!sErro)return;
var pvL=sLoja.value, pvE=sErro.value;
sLoja.innerHTML='<option value="">Todas</option>';
sErro.innerHTML='<option value="">Todos</option>';
var lojas=[...new Set(DB.historico.map(r=>r.loja).filter(Boolean))].sort();
lojas.forEach(function(l){var o=document.createElement('option');o.value=l;o.textContent=l;sLoja.appendChild(o);});
var erros=[...new Set(DB.historico.map(r=>r.erroDesc).filter(Boolean))].sort();
erros.forEach(function(e){var o=document.createElement('option');o.value=e;o.textContent=e;sErro.appendChild(o);});
if(pvL)sLoja.value=pvL;
if(pvE)sErro.value=pvE;
}
function gerarDash(){
const de=document.getElementById('dash-de').value;
const ate=document.getElementById('dash-ate').value;
if(!de||!ate){toast('Selecione o período!',true);return;}
const filtroLoja=document.getElementById('dash-loja')?document.getElementById('dash-loja').value:'';
const filtroErro=document.getElementById('dash-erro')?document.getElementById('dash-erro').value:'';
const filtroStatus=document.getElementById('dash-status')?document.getElementById('dash-status').value:'';
toast('⏳ Buscando dados do período...');
google.script.run
.withSuccessHandler(function(hist){
if(!hist||!hist.length){
DB.historico = [];
['kpi-tot','kpi-forn','kpi-errt','kpi-loja'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='0';});
['kpi-ent','kpi-ant'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='0';});
['ch-erros-pie','ch-lojas','ch-linha','ch-forn','ch-comp','ch-status'].forEach(id=>destroyChart(id));
['rl-forn','rl-erros','rl-erros-pie','rl-lojas','rl-comp','rl-status'].forEach(id=>{
const el=document.getElementById(id);if(el)el.innerHTML='<div class="nd">Sem dados no período</div>';
});
const tb=document.getElementById('dash-det');
if(tb)tb.innerHTML='<tr><td colspan="9" class="nd">Nenhuma ocorrência no período selecionado.</td></tr>';
toast('Nenhum registro no período selecionado.',true);
return;
}
DB.historico=hist;
populateDashFilters();
const registros=hist.filter(r=>{
if(filtroLoja&&r.loja!==filtroLoja) return false;
if(filtroErro&&r.erroDesc!==filtroErro) return false;
if(filtroStatus&&r.status!==filtroStatus) return false;
return true;
});
const fmtD=v=>{const p=v.split('-');return`${p[2]}/${p[1]}/${p[0]}`;};
let lblTxt=`${fmtD(de)} → ${fmtD(ate)} · ${registros.length} registro(s)`;
if(filtroLoja) lblTxt+=` · Loja: ${filtroLoja}`;
if(filtroErro) lblTxt+=` · Erro: ${filtroErro}`;
if(filtroStatus) lblTxt+=` · Status: ${filtroStatus}`;
document.getElementById('dash-plbl').textContent=lblTxt;
document.getElementById('ph-gen').textContent=new Date().toLocaleString('pt-BR');
document.getElementById('ph-period').textContent=`Período: ${fmtD(de)} a ${fmtD(ate)}`;
if(cfg.nome) document.getElementById('ph-assina').textContent=`Responsável: ${cfg.nome}${cfg.cargo?' · '+cfg.cargo:''}`;
// ─ DESPACHO PARA FUNÇÕES DE PERFIL ──
renderKpis(registros);
renderChartErrosPie(registros);
renderChartLojas(registros);
renderChartLinha(registros,de,ate);
renderRankings(registros);
renderChartStatus(registros);
renderDetTable(registros);
toast('✓ Dashboard gerado!');
})
.withFailureHandler(function(e){ toast('Erro ao buscar dados: '+e.message,true); })
.loadHistFiltrado(de, ate, _perfilAtivo());
}
// ════════════════════════════════════════════════════════════════
//  FUNÇÕES DE GRÁFICO — despacham para o perfil ativo quando
//  window._render* está definido, senão usam implementação local
// ═══════════════════════════════════════════════════════════════
function renderKpis(r) {
if (typeof window._renderKpis === 'function') { window._renderKpis(r); return; }
_renderKpisBase(r);
}
function _renderKpisBase(r) {
const uniq=(arr,key)=>[...new Set(arr.map(x=>x[key]).filter(Boolean))].length;
document.getElementById('kpi-tot').textContent=r.length;
document.getElementById('kpi-forn').textContent=uniq(r,'fornecedor');
document.getElementById('kpi-errt').textContent=uniq(r,'erroDesc');
document.getElementById('kpi-loja').textContent=uniq(r,'loja');
}
function renderChartErrosPie(r) {
if (typeof window._renderChartErrosPie === 'function') { window._renderChartErrosPie(r); return; }
_renderChartErrosPieBase(r);
}
function _renderChartErrosPieBase(r){
destroyChart('ch-erros-pie');
const data=countBy(r,'erroDesc').slice(0,8);
toggleChart('ch-erros-pie','ch-erros-nd',data.length>0);
if(!data.length)return;
const ctx=document.getElementById('ch-erros-pie').getContext('2d');
const pieInsidePlugin={
id:'pieInside',
afterDatasetsDraw(chart){
const ctx2=chart.ctx;
const meta=chart.getDatasetMeta(0);
meta.data.forEach((arc,i)=>{
const val=chart.data.datasets[0].data[i];
if(!val)return;
const label=chart.data.labels[i]||'';
const cx=(arc.startAngle+arc.endAngle)/2;
const r=(arc.outerRadius+arc.innerRadius)/2;
const x=arc.x+r*Math.cos(cx);
const y=arc.y+r*Math.sin(cx);
const pct=Math.round(val/chart.data.datasets[0].data.reduce((a,b)=>a+b,0)*100);
if(pct<5)return;
ctx2.save();
ctx2.font='bold 10px Arial';ctx2.fillStyle='#fff';
ctx2.textAlign='center';ctx2.textBaseline='middle';
const maxW=(arc.outerRadius-arc.innerRadius)*0.9;
let lbl=label;
while(ctx2.measureText(lbl).width>maxW&&lbl.length>3)lbl=lbl.slice(0,-1);
if(lbl!==label)lbl=lbl.slice(0,-1)+'…';
ctx2.fillText(lbl,x,y-7);
ctx2.font='bold 11px Arial';
ctx2.fillText(val+' ('+pct+'%)',x,y+7);
ctx2.restore();
});
}
};
_charts['ch-erros-pie']=new Chart(ctx,{
type:'doughnut',
data:{labels:data.map(d=>d[0]),datasets:[{data:data.map(d=>d[1]),backgroundColor:CHART_COLORS,borderWidth:2,borderColor:'#1a2236'}]},
plugins:[pieInsidePlugin],
options:{responsive:true,maintainAspectRatio:true,
plugins:{
legend:{display:true,position:'bottom',labels:{color:'#e8edf8',font:{family:"'DM Mono',monospace",size:12},boxWidth:20,boxHeight:20,padding:14}},
tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${ctx.raw}`}}
}
}
});
}
function renderChartLojas(r) {
if (typeof window._renderChartLojas === 'function') { window._renderChartLojas(r); return; }
_renderChartLojasBase(r);
}
function _renderChartLojasBase(r){
destroyChart('ch-lojas');
const data=countBy(r,'loja');
toggleChart('ch-lojas','ch-lojas-nd',data.length>0);
if(!data.length)return;
const canvas=document.getElementById('ch-lojas');
const minHeight=Math.max(200, data.length * 32);
canvas.style.maxHeight=minHeight+'px';
const ctx=canvas.getContext('2d');
_charts['ch-lojas']=new Chart(ctx,{
type:'bar',
data:{labels:data.map(d=>d[0]),datasets:[{data:data.map(d=>d[1]),
backgroundColor:'#4d9fff99',borderColor:'#4d9fff',borderWidth:2,borderRadius:5}]},
plugins:[insideLabelPlugin],
options:{
devicePixelRatio:window.devicePixelRatio||2,
responsive:true,
maintainAspectRatio:false,
indexAxis:'y',
plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`Ocorrências: ${c.raw}`}}},
layout:{padding:{right:50}},
scales:{
x:{ticks:{color:'#6b7a99',font:{size:10}},grid:{color:'#1e2d48'},suggestedMax:(data[0]?data[0][1]:1)*1.35},
y:{ticks:{display:false},grid:{display:false}}
}
}
});
}
function renderChartLinha(r, de, ate) {
if (typeof window._renderChartLinha === 'function') { window._renderChartLinha(r, de, ate); return; }
_renderChartLinhaBase(r, de, ate);
}
function _renderChartLinhaBase(r,de,ate){
destroyChart('ch-linha');
const days=[];
const cur=new Date(de+'T00:00:00'),end=new Date(ate+'T00:00:00');
while(cur<=end){days.push(cur.toISOString().split('T')[0]);cur.setDate(cur.getDate()+1);}
const counts={};days.forEach(d=>counts[d]=0);
r.forEach(x=>{const d=parseDataBR(x.data);if(counts[d]!==undefined)counts[d]++;});
toggleChart('ch-linha','ch-linha-nd',r.length>0);if(!r.length)return;
const fmtD=v=>{const p=v.split('-');return`${p[2]}/${p[1]}`;};
const ctx=document.getElementById('ch-linha').getContext('2d');
_charts['ch-linha']=new Chart(ctx,{
type:'line',
data:{labels:days.map(fmtD),datasets:[{label:'Ocorrências',data:days.map(d=>counts[d]),
borderColor:'#00d4aa',backgroundColor:'#00d4aa18',fill:true,tension:.35,
pointBackgroundColor:'#00d4aa',pointRadius:5,pointHoverRadius:7,borderWidth:2.5}]},
plugins:[lineLabelPlugin],
options:{responsive:true,maintainAspectRatio:true,
plugins:{legend:{display:false}},layout:{padding:{top:20}},
scales:{
x:{ticks:{color:'#8899bb',font:{size:11},maxTicksLimit:14},grid:{color:'#1e2d48'}},
y:{ticks:{color:'#8899bb',font:{size:11},stepSize:1},grid:{color:'#1e2d4880'},
suggestedMax:(Math.max(...Object.values(counts))||1)*1.25}
}
}
});
}
function renderRankings(r) {
const perfil = _perfilAtivo().toLowerCase();
if (perfil === 'lojas' && typeof window._renderRankings_Lojas === 'function') {
window._renderRankings_Lojas(r); return;
}
if (perfil === 'matriz' && typeof window._renderRankings_Matriz === 'function') {
window._renderRankings_Matriz(r); return;
}
_renderRankingsBase(r);
}
function _renderRankingsBase(r){
renderRank('rl-forn',      countBy(r,'fornecedor'),'#4d9fff');
renderRank('rl-erros',     countBy(r,'erroDesc'),  '#f5a623');
renderRank('rl-erros-pie', countBy(r,'erroDesc'),  '#f5a623');
renderRank('rl-lojas',     countBy(r,'loja'),      '#a78bfa');
renderRank('rl-comp',      countBy(r,'comprador').filter(d=>d[0]!=='(sem dado)'),'#00d4aa');
}
function renderChartStatus(r) {
if (typeof window._renderChartStatus === 'function') { window._renderChartStatus(r); return; }
_renderChartStatusBase(r);
}
function _renderChartStatusBase(r) {
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
const val = chart.data.datasets[0].data[i];
if (!val) return;
const totalVals = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
const pctVal = Math.round(val / totalVals * 100);
if (pctVal < 6) return;
const midAngle = (arc.startAngle + arc.endAngle) / 2;
const radius = (arc.outerRadius + arc.innerRadius) / 2;
const x = arc.x + radius * Math.cos(midAngle);
const y = arc.y + radius * Math.sin(midAngle);
ctx2.save();
ctx2.font = 'bold 11px Arial';ctx2.fillStyle = '#fff';
ctx2.textAlign = 'center';ctx2.textBaseline = 'middle';
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
datasets: [{data: [ent, ant, sem],backgroundColor: ['#1D9E75', '#BA7517', '#6b7a99'],borderWidth: 2,borderColor: '#1a2236'}]
},
plugins: [statusInsidePlugin],
options: {
responsive: true,maintainAspectRatio: true,
plugins: {legend: {display: false},tooltip: {callbacks: {label: ctx => ctx.label + ': ' + ctx.raw + pct(ctx.raw)}}}
}
});
const statusData = [
['🚚 Entregando', ent, '#1D9E75'],
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
}
// ── Funções de suporte aos gráficos (compartilhadas, não sobrescritas por perfil) ──
function countBy(arr,key){
const m={};
arr.forEach(r=>{const k=r[key]||'(sem dado)';m[k]=(m[k]||0)+1;});
return Object.entries(m).sort((a,b)=>b[1]-a[1]);
}
function destroyChart(id){if(_charts[id]){_charts[id].destroy();delete _charts[id];}}
function toggleChart(canvasId,emptyId,hasData){
document.getElementById(canvasId).style.display=hasData?'block':'none';
document.getElementById(emptyId).style.display=hasData?'none':'block';
}
const insideLabelPlugin={
id:'insideLabel',
afterDatasetsDraw(chart){
const ctx=chart.ctx;
const isH=chart.config.options?.indexAxis==='y';
chart.data.datasets.forEach((ds,di)=>{
const meta=chart.getDatasetMeta(di);if(meta.hidden)return;
meta.data.forEach((bar,i)=>{
const val=ds.data[i];if(!val&&val!==0)return;
const label=chart.data.labels[i]||'';
ctx.save();
if(isH){
const barW=bar.x-bar.base;
const cy=bar.y;
ctx.font='bold 11px "DM Mono",monospace';
const nameW=ctx.measureText(label).width;
if(barW>nameW+16){
ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='middle';
ctx.fillText(label,bar.base+10,cy);
} else {
ctx.fillStyle='#8899bb';ctx.textAlign='left';ctx.textBaseline='middle';
const maxW=chart.chartArea.right-bar.x-48;
let lbl=label;
while(ctx.measureText(lbl).width>maxW&&lbl.length>4)lbl=lbl.slice(0,-1);
if(lbl!==label)lbl=lbl.slice(0,-1)+'…';
ctx.fillText(lbl,bar.x+8,cy);
}
ctx.font='bold 12px "DM Mono",monospace';
ctx.fillStyle='#e8edf8';ctx.textAlign='left';ctx.textBaseline='middle';
ctx.fillText(val,bar.x+6,cy);
} else {
const cx=bar.x;
const barH=bar.base-bar.y;
ctx.font='bold 11px "DM Mono",monospace';
ctx.fillStyle='#e8edf8';ctx.textAlign='center';ctx.textBaseline='bottom';
ctx.fillText(val,cx,bar.y-4);
if(barH>30){
ctx.save();ctx.translate(cx,bar.y+barH/2);ctx.rotate(-Math.PI/2);
ctx.font='bold 10px "DM Mono",monospace';ctx.fillStyle='#fff';
ctx.textAlign='center';ctx.textBaseline='middle';
const maxW=barH-8;let lbl=label;
while(ctx.measureText(lbl).width>maxW&&lbl.length>4)lbl=lbl.slice(0,-1);
if(lbl!==label)lbl=lbl.slice(0,-1)+'…';
ctx.fillText(lbl,0,0);ctx.restore();
}
}
ctx.restore();
});
});
}
};
const lineLabelPlugin={
id:'lineLabel',
afterDatasetsDraw(chart){
const ctx=chart.ctx;
chart.data.datasets.forEach((ds,di)=>{
const meta=chart.getDatasetMeta(di);if(meta.hidden)return;
meta.data.forEach((pt,i)=>{
const val=ds.data[i];if(!val)return;
ctx.save();ctx.font='bold 10px Arial';ctx.fillStyle='#e8edf8';
ctx.textAlign='center';ctx.textBaseline='bottom';
ctx.fillText(val,pt.x,pt.y-6);ctx.restore();
});
});
}
};
function renderRank(elId,data,color){
const el=document.getElementById(elId);
if(!data.length){el.innerHTML='<div class="nd">Sem dados no período</div>';return;}
const top=data.slice(0,10);
const max=top[0][1];
const txtColor=(color==='#f5a623')?'#000':'#fff';
el.innerHTML=top.map((d,i)=>{
const pct=Math.max(15,Math.round(d[1]/max*100));
return`<div class="ri">
<span class="ri-pos">${i+1}</span>
<div class="ri-bw">
<div class="ri-b" style="width:${pct}%;background:${color};color:${txtColor}">
<span class="ri-b-label">${esc(d[0])}</span>
</div>
</div>
<span class="ri-n" style="color:${color}">${d[1]}</span>
</div>`;
}).join('');
}
function renderDetTable(r){
const tb=document.getElementById('dash-det');
if(!r.length){tb.innerHTML='<tr><td colspan="9" class="nd">Nenhuma ocorrência no período selecionado.</td></tr>';return;}
tb.innerHTML=r.slice().reverse().map((x,i)=>`
<tr>
<td>${esc(x.data||'—')}</td>
<td><span class="bcod">${esc(x.danf||'—')}</span></td>
<td>${esc(x.fornecedor||'—')}</td>
<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.erroDesc||x.codErro||'—')}</td>
<td>${esc(x.loja||'—')}</td>
<td>${esc(x.comprador||'—')}</td>
<td>${esc(x.comercial||'—')}</td>
<td>${statusBadge(x.status)}</td>
</tr>`).join('');
}
function renderDash(){initDashDates();populateDashFilters();}
// ─ IMPRIMIR A4 ──
function imprimirDash(){
const de=document.getElementById('dash-de').value;
const ate=document.getElementById('dash-ate').value;
if(!de||!ate){toast('Selecione o período antes de imprimir!',true);return;}
if(!DB.historico||!DB.historico.length){toast('Gere o dashboard antes de imprimir!',true);return;}
const fmtD=v=>{if(!v)return'';const p=v.split('-');return p[2]+'/'+p[1]+'/'+p[0];};
const filtroLoja=document.getElementById('dash-loja')?document.getElementById('dash-loja').value:'';
const filtroErro=document.getElementById('dash-erro')?document.getElementById('dash-erro').value:'';
const filtroStatus=document.getElementById('dash-status')?document.getElementById('dash-status').value:'';
const regs=DB.historico.filter(r=>{
const d=parseDataBR(r.data);
if(d<de||d>ate) return false;
if(filtroLoja&&r.loja!==filtroLoja) return false;
if(filtroErro&&r.erroDesc!==filtroErro) return false;
if(filtroStatus&&r.status!==filtroStatus) return false;
return true;
});
toast('⏳ Gerando PDF, aguarde...');
setTimeout(async ()=>{
try{
const { jsPDF } = window.jspdf;
const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' });
const PW=297, PH=210, M=8;
const W=PW-M*2, H=PH-M*2;
function bgPage(){
pdf.setFillColor(255,255,255);
pdf.rect(0,0,PW,PH,'F');
}
function canvasImg(id){
const c=document.getElementById(id);
if(!c||!c.width||!c.height) return null;
try{ return c.toDataURL('image/png',1.0); }catch(e){ return null; }
}
function drawCard(canvasId, titulo, x, y, w, h){
pdf.setFillColor(247,248,250);
pdf.roundedRect(x,y,w,h,3,3,'F');
pdf.setDrawColor(200,205,215);
pdf.setLineWidth(0.3);
pdf.roundedRect(x,y,w,h,3,3,'S');
pdf.setFontSize(7);
pdf.setTextColor(0,0,0);
pdf.setFont('helvetica','bold');
pdf.text(titulo.toUpperCase(), x+4, y+6);
pdf.setDrawColor(0,0,0);
pdf.setLineWidth(0.25);
pdf.line(x+4, y+7.5, x+w-4, y+7.5);
pdf.setLineWidth(0.2);
pdf.setDrawColor(200,205,215);
const img=canvasImg(canvasId);
if(img){
const c=document.getElementById(canvasId);
const physW=c?c.width:1;
const physH=c?c.height:1;
const ratio=physW/physH;
const iW=w-6;
const iH=Math.min(h-11, iW/ratio);
const iY=y+9+((h-11-iH)/2);
pdf.addImage(img,'PNG',x+3,iY,iW,iH,'','NONE');
} else {
pdf.setFontSize(8);
pdf.setTextColor(107,122,153);
pdf.text('Sem dados', x+w/2, y+h/2, {align:'center'});
}
}
function drawRankCard(elId, titulo, color, x, y, w, h){
pdf.setFillColor(247,248,250);
pdf.roundedRect(x,y,w,h,3,3,'F');
pdf.setDrawColor(200,205,215);
pdf.setLineWidth(0.3);
pdf.roundedRect(x,y,w,h,3,3,'S');
pdf.setFontSize(8);
pdf.setTextColor(0,0,0);
pdf.setFont('helvetica','bold');
pdf.text(titulo.toUpperCase(), x+4, y+6);
pdf.setDrawColor(0,0,0);
pdf.setLineWidth(0.25);
pdf.line(x+4, y+7.5, x+w-4, y+7.5);
pdf.setLineWidth(0.2);
const data=countBy(regs, elId==='rl-forn'?'fornecedor':elId==='rl-erros'?'erroDesc':elId==='rl-comp'?'comprador':'loja');
const top=data.filter(d=>d[0]!=='(sem dado)').slice(0,26);
if(!top.length){
pdf.setFontSize(9); pdf.setTextColor(107,122,153);
pdf.text('Sem dados', x+w/2, y+h/2, {align:'center'});
return;
}
const max=top[0][1];
const rowH=Math.min((h-12)/top.length, 18);
const rgb=hexToRgb(color);
top.forEach((d,i)=>{
const ry=y+10+i*rowH;
const barMax=w-22;
const barW=Math.max(4, Math.round(d[1]/max*barMax));
pdf.setFillColor(rgb.r,rgb.g,rgb.b);
pdf.roundedRect(x+16, ry, barW, rowH-1.5, 1,1,'F');
pdf.setFontSize(8);
pdf.setTextColor(80,80,80);
pdf.setFont('helvetica','bold');
pdf.text(String(i+1), x+13, ry+rowH/2+1, {align:'right'});
pdf.setFontSize(7.5);
pdf.setTextColor(255,255,255);
const nome=String(d[0]||'');
const maxChars=Math.floor(barW/1.4);
const label=nome.length>maxChars?nome.slice(0,maxChars-1)+'…':nome;
if(barW>16) pdf.text(label, x+18, ry+rowH/2+1);
pdf.setFontSize(8);
pdf.setTextColor(rgb.r,rgb.g,rgb.b);
pdf.text(String(d[1]), x+16+barW+2, ry+rowH/2+1);
});
}
function drawKpi(val, label, color, x, y, w, h){
const rgb=hexToRgb(color);
pdf.setFillColor(247,248,250);
pdf.roundedRect(x,y,w,h,3,3,'F');
pdf.setDrawColor(200,205,215);
pdf.setLineWidth(0.3);
pdf.roundedRect(x,y,w,h,3,3,'S');
pdf.setLineWidth(0.2);
pdf.setFillColor(rgb.r,rgb.g,rgb.b);
pdf.rect(x,y,w,2,'F');
pdf.setFontSize(18);
pdf.setTextColor(rgb.r,rgb.g,rgb.b);
pdf.setFont('helvetica','bold');
pdf.text(String(val), x+w/2, y+h*0.58, {align:'center'});
pdf.setFontSize(5.5);
pdf.setTextColor(80,80,80);
pdf.setFont('helvetica','normal');
pdf.text(label.toUpperCase(), x+w/2, y+h*0.82, {align:'center'});
}
function drawHeader(){
let periodoTxt='Período: '+fmtD(de)+' a '+fmtD(ate);
if(filtroLoja) periodoTxt+=' · Loja: '+filtroLoja;
if(filtroErro) periodoTxt+=' · Erro: '+filtroErro;
if(filtroStatus) periodoTxt+=' · Status: '+filtroStatus;
pdf.setFontSize(13);
pdf.setTextColor(0,0,0);
pdf.setFont('helvetica','bold');
pdf.text('Relatório de Erros — Sistema NFe', M, M+6);
pdf.setFontSize(8);
pdf.setTextColor(80,80,80);
pdf.setFont('helvetica','normal');
pdf.text('Sistema de Gestão de Erros de NFE', M, M+11);
if(cfg.nome){
let assina=cfg.nome;
if(cfg.cargo) assina+=' · '+cfg.cargo;
pdf.text(assina, M, M+15);
}
pdf.setFontSize(8.5);
pdf.setTextColor(0,0,0);
pdf.setFont('helvetica','bold');
pdf.text(periodoTxt, PW-M, M+6, {align:'right'});
pdf.setFontSize(7.5);
pdf.setTextColor(100,100,100);
pdf.setFont('helvetica','normal');
pdf.text('Gerado em: '+new Date().toLocaleString('pt-BR'), PW-M, M+11, {align:'right'});
pdf.setDrawColor(0,0,0);
pdf.setLineWidth(0.4);
pdf.line(M, M+17, PW-M, M+17);
pdf.setLineWidth(0.2);
}
// PÁGINA 1
bgPage();
drawHeader();
const TOP = M+20;
const kpiW=(W)/4-2, kpiH=20;
const kpiY=TOP;
const kpis=[
{id:'kpi-tot',  lbl:'Ocorrências',     col:'#00d4aa'},
{id:'kpi-forn', lbl:'Fornecedores',     col:'#4d9fff'},
{id:'kpi-errt', lbl:'Tipos de Erro',    col:'#f5a623'},
{id:'kpi-loja', lbl:'Lojas Impactadas', col:'#a78bfa'},
];
kpis.forEach((k,i)=>{
const val=document.getElementById(k.id)?document.getElementById(k.id).textContent:'—';
drawKpi(val, k.lbl, k.col, M+i*(kpiW+2.5), kpiY, kpiW, kpiH);
});
const ROW1Y = TOP+kpiH+4;
const ROW1H = H-(ROW1Y-M);
const pieW  = Math.round(W*0.55);
const lojW  = W-pieW-4;
// Pizza
(function(){
const chart = _charts['ch-erros-pie'];
if(!chart){ drawCard('ch-erros-pie','Distribuição por Tipo de Erro', M, ROW1Y, pieW, ROW1H); return; }
const labels  = chart.data.labels||[];
const values  = chart.data.datasets[0].data||[];
const colors  = chart.data.datasets[0].backgroundColor||[];
const total   = values.reduce((a,b)=>a+b,0);
const legendLines = Math.ceil(labels.length/3);
const legH    = legendLines*9+6;
const pieCardH= ROW1H - legH;
pdf.setFillColor(247,248,250);
pdf.roundedRect(M, ROW1Y, pieW, pieCardH, 3,3,'F');
pdf.setDrawColor(200,205,215); pdf.setLineWidth(0.3);
pdf.roundedRect(M, ROW1Y, pieW, pieCardH, 3,3,'S');
pdf.setLineWidth(0.2);
pdf.setFontSize(7); pdf.setTextColor(0,0,0); pdf.setFont('helvetica','bold');
pdf.text('DISTRIBUIÇÃO POR TIPO DE ERRO', M+4, ROW1Y+6);
pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.25);
pdf.line(M+4, ROW1Y+7.5, M+pieW-4, ROW1Y+7.5);
pdf.setLineWidth(0.2);
const cx   = M + pieW/2;
const cy   = ROW1Y + 10 + (pieCardH-14)/2;
const rOut = Math.min(pieW, pieCardH-14)/2 - 4;
const rIn  = rOut * 0.52;
let startAngle = -Math.PI/2;
values.forEach((val,i)=>{
if(!val) return;
const slice = (val/total) * 2 * Math.PI;
const endAngle = startAngle + slice;
const rgb = hexToRgb(Array.isArray(colors)?colors[i]:'#888');
pdf.setFillColor(rgb.r, rgb.g, rgb.b);
pdf.setDrawColor(255,255,255); pdf.setLineWidth(0.8);
const steps = Math.max(12, Math.round(slice * 20));
const pts = [];
for(let s=0;s<=steps;s++){
const a = startAngle + (slice/steps)*s;
pts.push([cx + rOut*Math.cos(a), cy + rOut*Math.sin(a)]);
}
for(let s=steps;s>=0;s--){
const a = startAngle + (slice/steps)*s;
pts.push([cx + rIn*Math.cos(a), cy + rIn*Math.sin(a)]);
}
pdf.setDrawColor(255,255,255); pdf.setLineWidth(1);
pdf.lines(
pts.slice(1).map((p,j)=>[p[0]-pts[j][0], p[1]-pts[j][1]]),
pts[0][0], pts[0][1], [1,1], 'FD', true
);
const pct = Math.round(val/total*100);
if(pct>=5){
const mid = startAngle + slice/2;
const tr  = (rOut+rIn)/2;
const tx  = cx + tr*Math.cos(mid);
const ty  = cy + tr*Math.sin(mid);
pdf.setFontSize(7); pdf.setFont('helvetica','bold'); pdf.setTextColor(30,30,30);
let lbl = String(labels[i]||'');
if(lbl.length>10) lbl=lbl.slice(0,9)+'…';
pdf.text(lbl, tx, ty-3, {align:'center'});
pdf.setFontSize(7.5); pdf.setTextColor(30,30,30);
pdf.text(pct+'%', tx, ty+4, {align:'center'});
}
startAngle = endAngle;
});
pdf.setFillColor(247,248,250);
pdf.setDrawColor(247,248,250);
pdf.circle(cx, cy, rIn-0.5, 'F');
const legY0 = ROW1Y + pieCardH + 3;
const colW  = pieW/3;
pdf.setFontSize(5.5); pdf.setFont('helvetica','normal');
labels.forEach((lbl,i)=>{
const col=i%3, row=Math.floor(i/3);
const bx=M+col*colW+2, by=legY0+row*9;
const rgb=hexToRgb(Array.isArray(colors)?colors[i]:'#888');
pdf.setFillColor(rgb.r,rgb.g,rgb.b);
pdf.rect(bx,by,5,5,'F');
pdf.setTextColor(30,30,30);
let label=String(lbl);
if(label.length>24)label=label.slice(0,23)+'…';
pdf.text(label,bx+7,by+4);
});
})();
const _isLojas = (_perfilAtivo()||'').toLowerCase() === 'lojas';
if (_isLojas) {
drawRankCard('rl-lojas', 'Rank Lojas', '#a78bfa', M+pieW+4, ROW1Y, lojW, ROW1H);
} else {
drawRankCard('rl-erros', 'Rank Erros', '#f5a623', M+pieW+4, ROW1Y, lojW, ROW1H);
}
// PÁGINA 2
pdf.addPage();
bgPage();
drawHeader();
const P2TOP = M+20;
const P2_LINHA_H = Math.round((H-(P2TOP-M))*0.52);
const P2_RANK_H  = H-(P2TOP-M)-P2_LINHA_H-4;
(function(){
const chart = _charts['ch-linha'];
if(!chart){ drawCard('ch-linha','Evolução Diária de Ocorrências', M, P2TOP, W, P2_LINHA_H); return; }
const labels = chart.data.labels||[];
const values = chart.data.datasets[0].data||[];
pdf.setFillColor(247,248,250);
pdf.roundedRect(M, P2TOP, W, P2_LINHA_H, 3,3,'F');
pdf.setDrawColor(200,205,215); pdf.setLineWidth(0.3);
pdf.roundedRect(M, P2TOP, W, P2_LINHA_H, 3,3,'S');
pdf.setLineWidth(0.2);
pdf.setFontSize(7); pdf.setTextColor(0,0,0); pdf.setFont('helvetica','bold');
pdf.text('EVOLUÇÃO DIÁRIA DE OCORRÊNCIAS', M+4, P2TOP+6);
pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.25);
pdf.line(M+4, P2TOP+7.5, M+W-4, P2TOP+7.5);
pdf.setLineWidth(0.2);
if(!values.length) return;
const padL=14, padR=8, padT=18, padB=16;
const chartX = M+padL;
const chartY = P2TOP+padT;
const chartW = W-padL-padR;
const chartH = P2_LINHA_H-padT-padB;
const maxVal = Math.max(...values,1);
const gridLines = 5;
pdf.setDrawColor(200,210,220); pdf.setLineWidth(0.2);
pdf.setFontSize(6); pdf.setFont('helvetica','normal'); pdf.setTextColor(100,100,100);
for(let g=0;g<=gridLines;g++){
const gy = chartY + chartH - (g/gridLines)*chartH;
const gv = Math.round((g/gridLines)*maxVal);
pdf.line(chartX, gy, chartX+chartW, gy);
pdf.text(String(gv), chartX-2, gy+1.5, {align:'right'});
}
const step = Math.max(1, Math.floor(labels.length/12));
pdf.setFontSize(6); pdf.setTextColor(100,100,100);
labels.forEach((lbl,i)=>{
if(i%step!==0) return;
const px = chartX + (i/(labels.length-1||1))*chartW;
pdf.text(String(lbl), px, chartY+chartH+5, {align:'center'});
pdf.setDrawColor(200,210,220); pdf.setLineWidth(0.15);
pdf.line(px, chartY, px, chartY+chartH);
});
const pts = values.map((v,i)=>({
x: chartX + (i/(values.length-1||1))*chartW,
y: chartY + chartH - ((v)/(maxVal||1))*chartH
}));
const smoothing = 0.25;
pdf.setFillColor(210,245,238);
pdf.setDrawColor(210,245,238);
const areaCurve = [];
areaCurve.push([0, pts[0].y-(chartY+chartH), 0, pts[0].y-(chartY+chartH), 0, pts[0].y-(chartY+chartH)]);
for(let i=1;i<pts.length;i++){
const prev=pts[i-1], curr=pts[i];
const deltaX=curr.x-prev.x;
const cp1X=prev.x+(deltaX*smoothing);
const cp2X=curr.x-(deltaX*smoothing);
areaCurve.push([cp1X-prev.x,0,cp2X-prev.x,curr.y-prev.y,curr.x-prev.x,curr.y-prev.y]);
}
areaCurve.push([0,(chartY+chartH)-pts[pts.length-1].y]);
areaCurve.push([pts[0].x-pts[pts.length-1].x,0]);
pdf.lines(areaCurve, pts[0].x, chartY+chartH, [1,1], 'F', true);
pdf.setDrawColor(0,180,140); pdf.setLineWidth(1.2);
for(let i=1;i<pts.length;i++){
const prev=pts[i-1], curr=pts[i];
const deltaX=curr.x-prev.x;
const cp1X=prev.x+(deltaX*smoothing);
const cp2X=curr.x-(deltaX*smoothing);
pdf.lines([[cp1X-prev.x,0,cp2X-prev.x,curr.y-prev.y,curr.x-prev.x,curr.y-prev.y]],prev.x,prev.y,[1,1],'S',false);
}
pts.forEach((p,i)=>{
const v=values[i]; if(v===null||v===undefined) return;
pdf.setFillColor(0,180,140);
pdf.setDrawColor(255,255,255); pdf.setLineWidth(0.5);
pdf.circle(p.x,p.y,1.8,'FD');
if(v>0){
pdf.setFontSize(6.5); pdf.setFont('helvetica','bold'); pdf.setTextColor(30,30,30);
pdf.text(String(v), p.x, p.y-3.5, {align:'center'});
}
});
})();
const rankW3 = (W-8)/3;
const rankY = P2TOP+P2_LINHA_H+4;
const _pdfIsLojas = (_perfilAtivo()||'').toLowerCase() === 'lojas';
if (_pdfIsLojas) {
drawRankCard('rl-forn', 'Rank Fornecedores', '#4d9fff', M,          rankY, rankW3, P2_RANK_H);
drawRankCard('rl-comp', 'Rank Compradores',  '#00d4aa', M+rankW3+4, rankY, rankW3, P2_RANK_H);
} else {
drawRankCard('rl-forn', 'Rank Fornecedores', '#4d9fff', M,            rankY, rankW3, P2_RANK_H);
drawRankCard('rl-comp', 'Rank Compradores',  '#00d4aa', M+rankW3+4,   rankY, rankW3, P2_RANK_H);
}
(function(){
const x=M+rankW3*2+8, y=rankY, w=rankW3, h=P2_RANK_H;
pdf.setFillColor(247,248,250);
pdf.roundedRect(x,y,w,h,3,3,'F');
pdf.setDrawColor(200,205,215); pdf.setLineWidth(0.3);
pdf.roundedRect(x,y,w,h,3,3,'S');
pdf.setFontSize(8); pdf.setTextColor(0,0,0); pdf.setFont('helvetica','bold');
pdf.text('STATUS DAS OCORRÊNCIAS', x+4, y+6);
pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.25);
pdf.line(x+4, y+7.5, x+w-4, y+7.5);
pdf.setLineWidth(0.2);
const legendH = 22;
const img = canvasImg('ch-status');
if(img){
const c = document.getElementById('ch-status');
const physW = c?c.width:1, physH = c?c.height:1;
const ratio = physW/physH;
const iW = w-10;
const maxIH = h-11-legendH;
const iH = Math.min(maxIH, iW/ratio);
const iX = x+5+(iW - Math.min(iW, iH*ratio))/2;
const iY = y+9;
pdf.addImage(img,'PNG', iX, iY, Math.min(iW, iH*ratio), iH,'','NONE');
}
const ent = parseInt(document.getElementById('kpi-ent')?document.getElementById('kpi-ent').textContent||'0':'0');
const ant = parseInt(document.getElementById('kpi-ant')?document.getElementById('kpi-ant').textContent||'0':'0');
const tot = regs.length||1;
const legendItems=[
{label:'Entregando', val:ent, pct:Math.round(ent/tot*100), col:[29,158,117]},
{label:'Antecipado', val:ant, pct:Math.round(ant/tot*100), col:[186,117,23]},
];
const legY0 = y+h-legendH+2;
const colW2 = w/2;
legendItems.forEach((li,i)=>{
const lx = x+i*colW2+8;
pdf.setFillColor(li.col[0],li.col[1],li.col[2]);
pdf.roundedRect(lx, legY0, 6, 6, 1,1,'F');
pdf.setFontSize(8); pdf.setTextColor(50,50,50); pdf.setFont('helvetica','bold');
pdf.text(li.label, lx+9, legY0+4.5);
pdf.setFontSize(11); pdf.setTextColor(li.col[0],li.col[1],li.col[2]);
pdf.text(String(li.val)+' ('+li.pct+'%)', lx+9, legY0+13);
});
})();
// ── PÁGINA 3 (apenas Perfil Lojas): Ranking Erros — move para Página 2 ──
if (_pdfIsLojas) {
const errosData = countBy(regs, 'erroDesc').filter(d => d[0] !== '(sem dado)');
const errosCount = Math.min(errosData.length, 8);
const errosCardH = Math.min(12 + errosCount * 18 + 10, 80);
const rankBottomY = rankY + P2_RANK_H;
const spaceLeft   = PH - M - rankBottomY - 6;
if (spaceLeft >= errosCardH) {
drawRankCard('rl-erros', 'Rank Erros', '#f5a623', M, rankBottomY + 6, W, errosCardH);
} else {
pdf.addPage();
bgPage();
drawHeader();
const P3TOP = M + 20;
drawRankCard('rl-erros', 'Rank Erros', '#f5a623', M, P3TOP, W, errosCardH);
}
}
_salvarPdfCompativel(pdf, 'Relatorio_Erros_NFS_'+de+'_a_'+ate+'.pdf');
toast('✓ PDF gerado com sucesso!');
}catch(err){
console.error(err);
toast('Erro ao gerar PDF: '+err.message, true);
}
}, 200);
}
function renderPrintRank(elId,data,color){
const el=document.getElementById(elId);if(!el)return;
if(!data.length){el.innerHTML='<div class="nd">Sem dados</div>';return;}
const top=data.slice(0,8);
const max=top[0][1];
const txtBranco=(color==='#f5a623')?'#000':'#fff';
el.innerHTML=top.map((d,i)=>{
const rawPct=Math.max(14,Math.round(d[1]/max*100));
const pct=Math.min(rawPct,88);
const nome=String(d[0]||'—');
return`<div class="pri">
<span class="pri-pos">${i+1}</span>
<div class="pri-bw">
<div class="pri-b" style="width:${pct}%;background:${color}">
<span style="color:${pct>=35?txtBranco:'#111'};font-size:9px;font-weight:700;font-family:Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;display:block">${esc(nome)}</span>
</div>
</div>
<span class="pri-n">${d[1]}</span>
</div>`;
}).join('');
}
// ── LOJA FIXA ──
function popSelLojaFixa() {
const sel = document.getElementById('cfg-loja-fixa');
if (!sel) return;
const pv = sel.value || lojaFixa;
sel.innerHTML = '<option value="">Nenhuma (sem loja fixa)</option>';
DB.lojas.forEach(l => {
const o = document.createElement('option');
o.value = l.nome;o.textContent = l.nome;
sel.appendChild(o);
});
if (pv) sel.value = pv;
renderLojaFixaUI();
}
function renderLojaFixaUI() {
const badge = document.getElementById('loja-fixa-badge');
const badgeNome = document.getElementById('loja-fixa-badge-nome');
if (badge) badge.style.display = lojaFixa ? 'flex' : 'none';
if (badgeNome && lojaFixa) badgeNome.textContent = lojaFixa;
const sel = document.getElementById('cfg-loja-fixa');
if (sel && lojaFixa && sel.value !== lojaFixa) sel.value = lojaFixa;
}
function onLojaFixaChange() {
const sel = document.getElementById('cfg-loja-fixa');
const badge = document.getElementById('loja-fixa-badge');
const badgeNome = document.getElementById('loja-fixa-badge-nome');
const val = sel ? sel.value : '';
if (badge) badge.style.display = val ? 'flex' : 'none';
if (badgeNome) badgeNome.textContent = val;
}
function saveLojaFixa() {
const sel = document.getElementById('cfg-loja-fixa');
lojaFixa = sel ? sel.value : '';
try { localStorage.setItem(_key('nfs_loja_fixa'), lojaFixa); } catch {}
renderLojaFixaUI();
const ind = document.getElementById('loja-fixa-saved-ind');
if (ind) {
ind.textContent = lojaFixa ? '✓ Loja fixa salva: ' + lojaFixa : '✓ Loja fixa removida';
ind.classList.add('show');
setTimeout(() => ind.classList.remove('show'), 3000);
}
toast(lojaFixa ? '✓ Loja fixa: ' + lojaFixa : '✓ Loja fixa removida');
applyLojaFixa();
}
function clearLojaFixa() {
lojaFixa = '';
try { localStorage.removeItem(_key('nfs_loja_fixa')); } catch {}
const sel = document.getElementById('cfg-loja-fixa');
if (sel) sel.value = '';
renderLojaFixaUI();
toast('✓ Loja fixa removida');
}
function applyLojaFixa() {
document.dispatchEvent(new Event('_applyLojaFixaHook'));
if (_perfilAtivo().toLowerCase() === 'matriz') return;
if (!lojaFixa) return;
const selLoja = document.getElementById('sel_loja');
if (!selLoja) return;
const opts = Array.from(selLoja.options);
const opt = opts.find(o => o.textContent === lojaFixa || o.dataset.nome === lojaFixa);
if (opt) { selLoja.value = opt.value; onPS('loja'); }
}
// ── NAV ──
const PAGES=['p-reg','p-dash','p-dashnfs','p-hist','p-erros','p-forn','p-comp','p-comerc','p-loja','p-manif','p-just','p-config','p-mva'];
function showPage(id) {
PAGES.forEach(p => {
const el = document.getElementById(p);
if (el) el.classList.toggle('on', p === id);
});
document.querySelectorAll('.sb .tab').forEach(t => {
const acao = t.getAttribute('onclick') || '';
const match = acao.match(/showPage\(['"]([^'"]+)['"]\)/);
const pageId = match ? match[1] : '';
t.classList.toggle('on', pageId === id);
});
closeAllDD();
if (id === 'p-reg') { setTimeout(applyLojaFixa, 80); initSaudacao(); }
if (id === 'p-config') { popSelLojaFixa(); renderGruposLoja(); }
if (id === 'p-dash') { initDashDates(); populateDashFilters(); setTimeout(gerarDash, 50); }
if (id === 'p-hist') {
['hist-f-nf'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
['hist-f-forn','hist-f-loja','hist-f-erro','hist-f-comp','hist-f-sit','hist-f-status','hist-f-venc'].forEach(id=>{
const el=document.getElementById(id);if(el)el.value='';
});
popHistFiltros();
setTimeout(function() { hist_hoje(); }, 80);
}
if (id === 'p-dashnfs' && DNFS.activeSheet && DNFS.sheets[DNFS.activeSheet]) {
setTimeout(function() { dnfsRenderKPIs(); dnfsRenderCharts(); }, 80);
}
}
document.addEventListener('_sistemaCarregado', function() {
document.querySelectorAll('.sb .tab').forEach(btn=>{
btn.style.userSelect='none';btn.style.webkitUserSelect='none';
btn.ondragstart=()=>false;
Array.from(btn.children).forEach(child=>{child.style.pointerEvents='none';});
});
// Assim que o sistema termina de carregar (tela inicial = Dashboard ERROS),
// já dispara automaticamente o mesmo efeito do botão "Gerar Dashboard" —
// sem precisar que a pessoa clique manualmente.
setTimeout(function(){
if(document.getElementById('p-dash')?.classList.contains('on')) {
initDashDates();
populateDashFilters();
gerarDash();
}
}, 400);
});
// ── CONFIG ──
function loadCfg(){
try{const s=localStorage.getItem(_key('nfs_cfg2'));if(s)cfg=JSON.parse(s);}catch{}
try{const s=localStorage.getItem(_key('nfs_emailcfg'));if(s){const parsed=JSON.parse(s);emailCfg=Object.assign({saudacao:true,intro:true,separadores:true,fornecedor:true,nota:true,descricao:true,status:true,cobranca:false,assinatura:true},parsed);}}catch{}
try{const s=localStorage.getItem(_key('nfs_cobranca_texto'));if(s)cobrancaTexto=s;}catch{}
try{const s=localStorage.getItem(_key('nfs_formcfg'));if(s){formCfg=Object.assign(formCfg,JSON.parse(s));}}catch{}
try { lojaFixa = localStorage.getItem(_key('nfs_loja_fixa')) || ''; } catch {}
renderLojaFixaUI();
document.getElementById('cfg-nome').value=cfg.nome||'';
document.getElementById('cfg-tel').value=cfg.tel||'';
document.getElementById('cfg-cargo').value=cfg.cargo||'';
renderCfgPrev();updateFoot();renderEmailToggles();updateStatusUI();
if (typeof renderFormToggles === 'function') { renderFormToggles(); }
}
function applyCfgFromSheet(assin){
if(!assin)return;
if(assin.nome||assin.tel||assin.cargo){
cfg=assin;localStorage.setItem(_key('nfs_cfg2'),JSON.stringify(cfg));
document.getElementById('cfg-nome').value=cfg.nome||'';
document.getElementById('cfg-tel').value=cfg.tel||'';
document.getElementById('cfg-cargo').value=cfg.cargo||'';
renderCfgPrev();updateFoot();
}
if(assin.emailCfg){
try{const parsed=typeof assin.emailCfg==='string'?JSON.parse(assin.emailCfg):assin.emailCfg;
emailCfg=Object.assign({saudacao:true,intro:true,separadores:true,fornecedor:true,nota:true,descricao:true,status:true,cobranca:false,assinatura:true},parsed);
localStorage.setItem(_key('nfs_emailcfg'),JSON.stringify(emailCfg));renderEmailToggles();}catch{}
}
if(assin.cobrancaTexto){
cobrancaTexto=assin.cobrancaTexto;
localStorage.setItem(_key('nfs_cobranca_texto'),cobrancaTexto);
const elCt=document.getElementById('cfg-cobranca-texto');if(elCt)elCt.value=cobrancaTexto;
}
}
function alterarSenhaSistema(){
const atual   = (document.getElementById('senha-sis-atual')?.value || '').trim();
const nova    = (document.getElementById('senha-sis-nova')?.value || '').trim();
const confirma= (document.getElementById('senha-sis-confirma')?.value || '').trim();
if(!atual){ toast('Informe a senha atual!', true); return; }
if(!nova){ toast('Informe a nova senha!', true); return; }
if(nova.length < 4){ toast('A nova senha deve ter pelo menos 4 caracteres!', true); return; }
if(nova !== confirma){ toast('A confirmação não coincide com a nova senha!', true); return; }
const btn = document.querySelector('button[onclick="alterarSenhaSistema()"]');
if(btn){ btn.textContent = '⏳ Salvando…'; btn.disabled = true; }
google.script.run
.withSuccessHandler(r => {
if(btn){ btn.textContent = ' Alterar Senha'; btn.disabled = false; }
if(r.ok){
SENHA_EDICAO = nova;
['senha-sis-atual','senha-sis-nova','senha-sis-confirma'].forEach(id=>{
const el=document.getElementById(id); if(el) el.value='';
});
toast('✓ Senha do Sistema alterada com sucesso!');
const ind=document.getElementById('senha-sis-saved-ind');
if(ind){ ind.textContent='✓ Nova senha salva'; ind.classList.add('show'); setTimeout(()=>ind.classList.remove('show'),3000); }
} else {
toast(r.msg || 'Erro ao alterar senha!', true);
}
})
.withFailureHandler(e => {
if(btn){ btn.textContent = '💾 Alterar Senha'; btn.disabled = false; }
toast('Falha: ' + e.message, true);
})
.saveSenhaSistema(atual, nova);
}
function saveConfig(){
cfg.nome=document.getElementById('cfg-nome').value.trim();
cfg.tel=document.getElementById('cfg-tel').value.trim();
cfg.cargo=document.getElementById('cfg-cargo').value.trim();
const elCobrancaTxt=document.getElementById('cfg-cobranca-texto');
if(elCobrancaTxt) cobrancaTexto=elCobrancaTxt.value.trim()||'Assim que for corrigido, favor responder este e-mail.';
localStorage.setItem(_key('nfs_cfg2'),JSON.stringify(cfg));
localStorage.setItem(_key('nfs_emailcfg'),JSON.stringify(emailCfg));
localStorage.setItem(_key('nfs_cobranca_texto'),cobrancaTexto);
renderCfgPrev();updateFoot();buildEmail();
const dataToSave=Object.assign({},cfg,{emailCfg:JSON.stringify(emailCfg),cobrancaTexto:cobrancaTexto});
google.script.run
.withSuccessHandler(r=>{if(r.ok)toast('✓ Configurações salvas para ' + _perfilAtivo() + '!');else toast('Salvo localmente');})
.withFailureHandler(()=>toast('✓ Salvo localmente!'))
.saveAssinatura(dataToSave, _perfilAtivo());
}
function toggleEmailField(field){
emailCfg[field]=!emailCfg[field];
localStorage.setItem(_key('nfs_emailcfg'),JSON.stringify(emailCfg));
renderEmailToggles();buildEmail();renderEmailPreview();
updateStatusUI();
}
function toggleFormField(field){
formCfg[field] = !formCfg[field];
localStorage.setItem(_key('nfs_formcfg'), JSON.stringify(formCfg));
renderFormToggles();
}
function renderFormToggles(){
const fields = ['comp', 'comerc', 'loja', 'manif', 'out_para', 'out_cc', 'out_assunto', 'out_corpo'];
fields.forEach(f => {
const el = document.getElementById('tg-f-' + f);if(el) el.checked = formCfg[f];
const lbl = document.getElementById('tgl-f-' + f);if(lbl) lbl.classList.toggle('checked', formCfg[f]);
const row = document.getElementById('row_form_' + f);if(row) { row.style.display = formCfg[f] ? '' : 'none'; }
const psMap = {comp:'ps-row-comp',comerc:'ps-row-comerc',loja:'ps-row-loja',manif:'ps-row-manif'};
if(psMap[f]){ const psRow = document.getElementById(psMap[f]); if(psRow) psRow.style.display = formCfg[f] ? '' : 'none'; }
});
}
function updateStatusUI(){
const star=document.getElementById('status-req-star');
const sel=document.getElementById('sel_status');
if(star)star.style.display=emailCfg.status?'inline':'none';
if(sel){
if(emailCfg.status){ sel.options[0].textContent='Selecione o status…'; }
else { sel.options[0].textContent='Sem status (desabilitado)'; sel.value=''; }
sel.disabled=!emailCfg.status;
sel.style.opacity=emailCfg.status?'1':'0.38';
}
}
function renderEmailToggles(){
const fields=['saudacao','intro','separadores','fornecedor','nota','descricao','status','cobranca','assinatura'];
fields.forEach(f=>{
const el=document.getElementById('tg-'+f);if(el)el.checked=emailCfg[f];
const lbl=document.getElementById('tgl-'+f);if(lbl)lbl.classList.toggle('checked',emailCfg[f]);
});
const elCobrancaWrap=document.getElementById('cfg-cobranca-wrap');
if(elCobrancaWrap) elCobrancaWrap.style.display=emailCfg.cobranca?'block':'none';
const elCobrancaTxt=document.getElementById('cfg-cobranca-texto');
if(elCobrancaTxt && !elCobrancaTxt.matches(':focus')) elCobrancaTxt.value=cobrancaTexto;
renderEmailPreview();
}
function renderEmailPreview(){
const prev=document.getElementById('email-body-preview');if(!prev)return;
let lines=[];
if(emailCfg.saudacao)lines.push(getSaud().l+',');
if(emailCfg.intro){if(lines.length)lines.push('');lines.push('Segue abaixo informações referentes ao erro de NF para as devidas providências.');}
const campos=[];
if(emailCfg.fornecedor)campos.push('  Fornecedor:   (nome)');
if(emailCfg.nota)campos.push('  NOTA Nº:      (número)');
if(emailCfg.descricao)campos.push('  DESCRIÇÃO:    (erro)');
if(emailCfg.status)campos.push('  STATUS:        (status da entrega)');
if(campos.length){
if(emailCfg.separadores)lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
campos.forEach(c=>{ lines.push(''); lines.push(c); });
if(emailCfg.separadores)lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
if(emailCfg.cobranca){lines.push(cobrancaTexto||'Assim que for corrigido, favor responder este e-mail.');}
if(emailCfg.assinatura){lines.push('');lines.push('Atenciosamente,');lines.push(cfg.nome||'(seu nome)');}
prev.textContent=lines.join('\n');
}
function renderCfgPrev(){
const n=cfg.nome||'(seu nome)',t=cfg.tel,c=cfg.cargo;
let tx=`Atenciosamente,\n${n}`;if(c)tx+=`\n${c}`;if(t)tx+=`\nTel: ${t}`;
document.getElementById('cfg-prev').innerHTML=tx.split('\n').map((l,i)=>i===1?`<strong style="color:var(--text)">${l}</strong>`:l).join('<br>');
}
function updateFoot(){
const fn=document.getElementById('ft-name'),fs=document.getElementById('ft-sub');
if(cfg.nome){fn.className='un';fn.textContent=cfg.nome;fs.textContent=cfg.tel||(cfg.cargo||'');}
else{fn.className='unc';fn.textContent='Não configurado';fs.textContent='';}
}
['cfg-nome','cfg-tel','cfg-cargo'].forEach(id=>{
document.getElementById(id)?.addEventListener('input',()=>{
cfg.nome=document.getElementById('cfg-nome').value.trim();
cfg.tel=document.getElementById('cfg-tel').value.trim();
cfg.cargo=document.getElementById('cfg-cargo').value.trim();
renderCfgPrev();
});
});
// ── REGRAS ──
const TIPOS_DEST=[{key:'comp',label:'Comprador'},{key:'comerc',label:'Comercial'},{key:'loja',label:'Loja'}];
function renderRegrasEditor(){
const el=document.getElementById('regras-editor');
if(!DB.codErros.length){el.innerHTML='<div class="ac-empty">Cadastre erros primeiro.</div>';return;}
let html=DB.codErros.map(e=>{
const regra=DB.regras.find(r=>r.codErro===e.codigo&&r.descErro===e.descricao);
const ativos=regra?regra.destinatarios.split(',').map(x=>x.trim()).filter(Boolean):[];
const uid=String(e.id);
return`<div class="rule-editor" data-erroid="${uid}">
<div class="re-header">
<div>
<div class="re-title">Regra para: <span class="re-erroname">${esc(e.descricao)}</span></div>
<div style="font-size:.68rem;color:var(--muted);margin-top:3px">Código: ${esc(e.codigo)}
${regra?`&nbsp;·&nbsp;<span style="color:var(--accent)">✓ Configurado em ${esc(regra.criadoEm)}</span>`:'&nbsp;·&nbsp;<span style="color:var(--warn)">⚠ Sem configuração</span>'}
</div>
</div>
</div>
<div class="checkbox-group" id="cbg-${uid}">
${TIPOS_DEST.map(t=>`
<label class="cb-item ${ativos.includes(t.key)?'checked':''}" id="cbi-${uid}-${t.key}">
<input type="checkbox" id="cb-${uid}-${t.key}" value="${t.key}" ${ativos.includes(t.key)?'checked':''}
onchange="toggleCb('${uid}','${t.key}',this.checked)">${t.label}
</label>`).join('')}
</div>
</div>`;
}).join('');
html+=`<button class="btn btn-p btn-full" style="margin-top:18px" onclick="saveAllRegras()">💾 Salvar Todas as Regras</button>
<div id="regras-saved-ind" class="saved-ind"></div>`;
el.innerHTML=html;renderTblRegras();
}
function toggleCb(uid,tipo,checked){
const lbl=document.getElementById('cbi-'+uid+'-'+tipo);
if(lbl)lbl.classList.toggle('checked',checked);
}
function saveAllRegras(){
const regrasArray=DB.codErros.map(e=>{
const uid=String(e.id);
const ativos=TIPOS_DEST.filter(t=>{const cb=document.getElementById('cb-'+uid+'-'+t.key);return cb&&cb.checked;}).map(t=>t.key);
return{codErro:e.codigo,descErro:e.descricao,destinatarios:ativos.join(',')};
});
const btn=document.querySelector('#regras-editor .btn-p');
if(btn){btn.textContent='⏳ Salvando…';btn.disabled=true;}
google.script.run
.withSuccessHandler(r=>{
if(btn){btn.textContent='💾 Salvar Todas as Regras';btn.disabled=false;}
if(r.ok){
toast('✓ Regras salvas! ('+r.saved+' regras)');
const ind=document.getElementById('regras-saved-ind');
if(ind){ind.textContent='✓ Regras salvas com sucesso';ind.classList.add('show');setTimeout(()=>ind.classList.remove('show'),3000);}
const hoje=new Date().toLocaleDateString('pt-BR');
regrasArray.forEach(novaRegra=>{
const idx=DB.regras.findIndex(r=>r.codErro===novaRegra.codErro&&r.descErro===novaRegra.descErro);
if(idx>=0){DB.regras[idx].destinatarios=novaRegra.destinatarios;DB.regras[idx].criadoEm=hoje;}
else if(novaRegra.destinatarios){DB.regras.push({id:localNextId(DB.regras),codErro:novaRegra.codErro,descErro:novaRegra.descErro,destinatarios:novaRegra.destinatarios,criadoEm:hoje});}
});
renderTblRegras();
DB.codErros.forEach(e=>{
const regra=DB.regras.find(rg=>rg.codErro===e.codigo&&rg.descErro===e.descricao);
const uid=String(e.id);
const bloco=document.querySelector('[data-erroid="'+uid+'"] .re-header div div:last-child');
if(bloco&&regra){bloco.innerHTML='Código: '+esc(e.codigo)+'&nbsp;·&nbsp;<span style="color:var(--accent)">✓ Configurado em '+esc(regra.criadoEm)+'</span>';}
});
}else{toast('Erro ao salvar regras!',true);}
})
.withFailureHandler(e=>{if(btn){btn.textContent='💾 Salvar Todas as Regras';btn.disabled=false;}toast('Falha: '+e.message,true);})
.saveAllRegras(regrasArray);
}
function editRegraFromList(codigo,descricao){
showPage('p-config');
setTimeout(()=>{const el=document.getElementById('regras-editor');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},300);
}
function renderTblRegras(){
const tb=document.getElementById('tb-regras');
if(!DB.regras.length){tb.innerHTML='<tr class="empty-r"><td colspan="6">Nenhuma regra salva ainda.</td></tr>';return;}
const lm={comp:'Comprador',comerc:'Comercial',loja:'Loja'};
tb.innerHTML=DB.regras.map(r=>{
const tags=r.destinatarios.split(',').filter(Boolean).map(k=>`<span class="btag" style="background:#00d4aa18;color:var(--accent)">${lm[k.trim()]||k.trim()}</span>`).join(' ');
return`<tr><td><span class="bcod">${esc(r.codErro)}</span></td>
<td>${esc(r.descErro)}</td><td>${tags}</td><td>${esc(r.criadoEm)}</td>
<td><button class="btn btn-d btn-sm" onclick="confirmDel('regra',${r.id},'regra ${esc(r.codErro)}')">🗑</button></td></tr>`;
}).join('');
}
// ── SELECTS ──
function buildSelects(){
popSel('sel_comp',DB.compradores);popSel('sel_comerc',DB.comerciais);
if (_perfilAtivo().toLowerCase() !== 'matriz') {
popSel('sel_loja',DB.lojas);
}
popSel('sel_manif',DB.manifestos);
popSelJust();popSelLojaFixa();
}
function popHistFiltros(){
const sForn = document.getElementById('hist-f-forn');
if(sForn) sForn.value = '';
const inpForn = document.getElementById('hist-f-forn-inp');
const choForn = document.getElementById('ac-ch-hist-forn');
if(inpForn) inpForn.value = '';
if(choForn) choForn.classList.remove('vis');
const sLoja = document.getElementById('hist-f-loja');
if(sLoja && sLoja.tagName === 'SELECT'){
const pv = sLoja.value;
sLoja.innerHTML = '<option value="">Todas as lojas…</option>';
if (DB.gruposLoja && DB.gruposLoja.length) {
const optGrp = document.createElement('optgroup');
optGrp.label = '── Grupos ──';
DB.gruposLoja.forEach(g => {
const o = document.createElement('option');
o.value = '__grupo__' + g.grupo;
o.textContent = '📦 ' + g.grupo;
optGrp.appendChild(o);
});
sLoja.appendChild(optGrp);
}
const optInd = document.createElement('optgroup');
optInd.label = '── Lojas ──';
[...new Set(DB.lojas.map(l=>l.nome).filter(Boolean))].sort()
.forEach(n=>{
const o = document.createElement('option');
o.value = n; o.textContent = n;
optInd.appendChild(o);
});
sLoja.appendChild(optInd);
if(pv) sLoja.value = pv;
}
const sErro = document.getElementById('hist-f-erro');
if(sErro && sErro.tagName === 'SELECT'){
const pv = sErro.value;
sErro.innerHTML = '<option value="">Todos os erros…</option>';
[...new Set(DB.codErros.map(e=>e.descricao).filter(Boolean))].sort()
.forEach(d=>{ const o=document.createElement('option');o.value=d;o.textContent=d;sErro.appendChild(o); });
if(pv) sErro.value = pv;
}
const sComp = document.getElementById('hist-f-comp');
if(sComp && sComp.tagName === 'SELECT'){
const pv = sComp.value;
sComp.innerHTML = '<option value="">Todos os compradores…</option>';
[...new Set(DB.compradores.map(c=>c.nome).filter(Boolean))].sort()
.forEach(n=>{ const o=document.createElement('option');o.value=n;o.textContent=n;sComp.appendChild(o); });
if(pv) sComp.value = pv;
}
}
function popSelJust(){
const s=document.getElementById('sel_just');if(!s)return;
const pv=s.value;
s.innerHTML='<option value="">Selecione uma Resposta…</option>';
DB.justificativas.forEach(j=>{
const o=document.createElement('option');o.value=j.id;o.textContent=j.texto;o.dataset.texto=j.texto;s.appendChild(o);
});
if(pv)s.value=pv;
}
function popSel(id,list){
const s=document.getElementById(id),pv=s.value;
s.innerHTML='<option value="">Selecione…</option>';
list.forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.nome;o.dataset.email=p.email||'';o.dataset.nome=p.nome;s.appendChild(o);});
if(pv)s.value=pv;
}
function applyRegra(codErro){
const regra=DB.regras.find(r=>r.codErro===codErro&&r.descErro===selErro.descricao);
regraAtiva=regra?regra.destinatarios.split(',').map(x=>x.trim()).filter(Boolean):[];
const map={comp:'sel_comp',comerc:'sel_comerc',loja:'sel_loja'};
Object.entries(map).forEach(([key,selId])=>{
const s=document.getElementById(selId);
s.disabled=!regraAtiva.includes(key);
if(!regraAtiva.includes(key)){s.value='';clearPS(key);}
});
if (_perfilAtivo().toLowerCase() === 'matriz') {
const selLoja = document.getElementById('sel_loja');
if (selLoja) { selLoja.disabled = true; }
}
const info=document.getElementById('rule-info');
if(!codErro){info.style.display='none';return;}
if(!regraAtiva.length){info.style.display='flex';info.className='rule-tag warn';info.textContent='⚠ Sem regra configurada para este erro — configure em Configurações';}
else{
const lm={comp:'Comprador',comerc:'Comercial',loja:'Loja'};
info.style.display='flex';info.className='rule-tag';
info.textContent='✓ Para: '+regraAtiva.map(k=>lm[k]||k).join(' + ')+' · CC: Manifesto';
}
buildEmail();
}
function onPS(tipo){
const map={comp:{sel:'sel_comp',disp:'em_comp',he:'hid_comp_email',hn:'hid_comp_nome'},
comerc:{sel:'sel_comerc',disp:'em_comerc',he:'hid_comerc_email',hn:'hid_comerc_nome'},
loja:{sel:'sel_loja',disp:'em_loja',he:'hid_loja_email',hn:'hid_loja_nome'},
manif:{sel:'sel_manif',disp:'em_manif',he:'hid_manif_email',hn:'hid_manif_nome'}};
const c=map[tipo];
const sel=document.getElementById(c.sel),opt=sel.options[sel.selectedIndex];
const email=(opt&&opt.value)?opt.dataset.email:'',nome=(opt&&opt.value)?opt.dataset.nome:'';
document.getElementById(c.he).value=email;document.getElementById(c.hn).value=nome;
const disp=document.getElementById(c.disp);
disp.textContent=email||'—';
disp.className='ps-email'+(email?' filled':'')+(tipo!=='manif'&&document.getElementById(c.sel).disabled?' dis':'');
buildEmail();
}
function clearPS(tipo){
const dm={comp:'em_comp',comerc:'em_comerc',loja:'em_loja'};
const hem={comp:'hid_comp_email',comerc:'hid_comerc_email',loja:'hid_loja_email'};
const hnm={comp:'hid_comp_nome',comerc:'hid_comerc_nome',loja:'hid_loja_nome'};
const disp=document.getElementById(dm[tipo]);
if(disp){disp.textContent='—';disp.className='ps-email dis';}
const he=document.getElementById(hem[tipo]);if(he)he.value='';
const hn=document.getElementById(hnm[tipo]);if(hn)hn.value='';
}
// ── AUTOCOMPLETE ──
function acS(type,val){
const isErro = type.startsWith('erro');
const list = isErro ? DB.codErros : DB.fornecedores;
const dKey = isErro ? 'descricao' : 'nome';
const dd = document.getElementById('ac-' + type);
if(!dd) return;
const q = (val || '').trim().toUpperCase();
acIdx[type] = -1;
const matches = q
? list.filter(r => r.codigo.toUpperCase().includes(q) || r[dKey].toUpperCase().includes(q)).slice(0, 500)
: list.slice(0, 500);
if(!matches.length){ dd.innerHTML = '<div class="ac-empty">Nenhum resultado.</div>'; dd.classList.add('open'); return; }
dd.innerHTML = matches.map((r, i) => `
<div class="ac-item" data-code="${esc(r.codigo)}" data-desc="${esc(r[dKey])}"
onclick="acSel('${type}','${esc(r.codigo)}','${esc(r[dKey])}')" onmouseover="acHov('${type}',${i})">
<span class="ai-desc">${esc(r[dKey])}</span><span class="ai-code">${esc(r.codigo)}</span>
</div>`).join('');
dd.classList.add('open');
}
function acHov(type,idx){acIdx[type]=idx;document.querySelectorAll(`#ac-${type} .ac-item`).forEach((el,i)=>el.classList.toggle('hl',i===idx));}
function acK(e,type){
const dd=document.getElementById('ac-'+type);if(!dd.classList.contains('open'))return;
const items=dd.querySelectorAll('.ac-item');
if(e.key==='ArrowDown'){e.preventDefault();acIdx[type]=Math.min(acIdx[type]+1,items.length-1);items.forEach((el,i)=>el.classList.toggle('hl',i===acIdx[type]));items[acIdx[type]]?.scrollIntoView({block:'nearest'});}
else if(e.key==='ArrowUp'){e.preventDefault();acIdx[type]=Math.max(acIdx[type]-1,0);items.forEach((el,i)=>el.classList.toggle('hl',i===acIdx[type]));items[acIdx[type]]?.scrollIntoView({block:'nearest'});}
else if(e.key==='Enter'){e.preventDefault();if(acIdx[type]>=0){const el=items[acIdx[type]];acSel(type,el.dataset.code,el.dataset.desc);}}
else if(e.key==='Escape')closeDD(type);
}
function acSel(type,code,desc){
if(type==='erro'){selErro.codigo=code;selErro.descricao=desc;}
else if(type==='erro2'){selErro2.codigo=code;selErro2.descricao=desc;}
else if(type==='erro3'){selErro3.codigo=code;selErro3.descricao=desc;}
else if(type==='erro4'){selErro4.codigo=code;selErro4.descricao=desc;}
else{selForn.codigo=code;selForn.nome=desc;}
let inpId = 'forn_inp';
if(type === 'erro') inpId = 'erro_inp';
else if(type === 'erro2') inpId = 'erro_inp2';
else if(type === 'erro3') inpId = 'erro_inp3';
else if(type === 'erro4') inpId = 'erro_inp4';
const inp=document.getElementById(inpId);
const cho=document.getElementById('ac-ch-'+type),txt=document.getElementById('ac-ch-'+type+'-t');
if(inp) inp.style.display='none';
if(txt) txt.textContent=desc;
if(cho) cho.classList.add('vis');
closeDD(type);
if(type==='erro') applyRegra(code);
buildEmail();
}
function acClear(type){
if(type==='erro'){selErro.codigo='';selErro.descricao='';applyRegra('');}
else if(type==='erro2'){selErro2.codigo='';selErro2.descricao='';}
else if(type==='erro3'){selErro3.codigo='';selErro3.descricao='';}
else if(type==='erro4'){selErro4.codigo='';selErro4.descricao='';}
else{selForn.codigo='';selForn.nome='';}
let inpId = 'forn_inp';
if(type === 'erro') inpId = 'erro_inp';
else if(type === 'erro2') inpId = 'erro_inp2';
else if(type === 'erro3') inpId = 'erro_inp3';
else if(type === 'erro4') inpId = 'erro_inp4';
const inp=document.getElementById(inpId);
const cho=document.getElementById('ac-ch-'+type);
if(cho) cho.classList.remove('vis');
if(inp) { inp.style.display=''; inp.value=''; }
closeAllDD();
buildEmail();
}
function closeDD(type){const el=document.getElementById('ac-'+type);if(el)el.classList.remove('open');acIdx[type]=-1;}
function closeAllDD(){['erro','erro2','erro3','erro4','forn','hist-forn'].forEach(closeDD);}
document.addEventListener('click',e=>{
['erro','erro2','erro3','erro4','forn'].forEach(t=>{const w=document.getElementById('acw-'+t);if(w&&!w.contains(e.target))closeDD(t);});
const wHistForn=document.getElementById('acw-hist-forn');
if(wHistForn&&!wHistForn.contains(e.target))closeDD('hist-forn');
});
function acHistForn(val){
const dd=document.getElementById('ac-hist-forn');
if(!dd)return;
const q=(val||'').trim().toUpperCase();
const matches=q
?DB.fornecedores.filter(f=>f.nome.toUpperCase().includes(q)||f.codigo.toUpperCase().includes(q)).slice(0,100)
:DB.fornecedores.slice(0,100);
if(!matches.length){dd.innerHTML='<div class="ac-empty">Nenhum resultado.</div>';dd.classList.add('open');return;}
dd.innerHTML=matches.map((f,i)=>`
<div class="ac-item" onclick="acHistFornSel('${esc(f.nome)}')" onmouseover="this.classList.add('hl')" onmouseout="this.classList.remove('hl')">
<span class="ai-desc">${esc(f.nome)}</span><span class="ai-code">${esc(f.codigo)}</span>
</div>`).join('');
dd.classList.add('open');
}
function acHistFornSel(nome){
const inp=document.getElementById('hist-f-forn-inp');
const cho=document.getElementById('ac-ch-hist-forn');
const txt=document.getElementById('ac-ch-hist-forn-t');
const hid=document.getElementById('hist-f-forn');
if(inp)inp.style.display='none';
if(txt)txt.textContent=nome;
if(cho)cho.classList.add('vis');
if(hid){hid.value=nome;}
closeDD('hist-forn');
filtrarHist();
}
function acHistFornClear(){
const inp=document.getElementById('hist-f-forn-inp');
const cho=document.getElementById('ac-ch-hist-forn');
const hid=document.getElementById('hist-f-forn');
if(cho)cho.classList.remove('vis');
if(inp){inp.style.display='';inp.value='';inp.focus();}
if(hid)hid.value='';
closeDD('hist-forn');
filtrarHist();
}
function acHistFornKey(e){
const dd=document.getElementById('ac-hist-forn');
if(!dd||!dd.classList.contains('open'))return;
const items=dd.querySelectorAll('.ac-item');
if(e.key==='Enter'&&items.length){e.preventDefault();items[0].click();}
else if(e.key==='Escape'){closeDD('hist-forn');}
}
// ── INLINE ADD ──
function togIA(id){const el=document.getElementById(id);el.style.display=el.style.display==='block'?'none':'block';}
function qAddErro(){
const cod=document.getElementById('ia-e-cod').value.trim(),desc=document.getElementById('ia-e-desc').value.trim();
if(!desc){toast('Informe a descrição!',true);return;}
google.script.run
.withSuccessHandler(r=>{
if(r.ok){
toast('✓ Erro cadastrado!');
const novoErro={id:r.id,codigo:cod||desc.substring(0,5).toUpperCase(),descricao:desc};
DB.codErros.push(novoErro);
document.getElementById('ia-e-cod').value='';
document.getElementById('ia-e-desc').value='';
document.getElementById('ia-erro').style.display='none';
renderTbl2('tb-erros',DB.codErros,'codErro',['codigo','descricao'],true);
renderRegrasEditor();
}else toast('Erro!',true);
})
.withFailureHandler(e=>toast(e.message,true))
.addCodErro({codigo:cod||desc.substring(0,5).toUpperCase(),descricao:desc,perfil:_perfilAtivo()});
}
function abrirModalNovoForn(){
document.getElementById('mnf-cod').value='';
document.getElementById('mnf-nome').value='';
const btn=document.getElementById('mnf-btn-salvar');
if(btn){btn.textContent='💾 Salvar';btn.disabled=false;}
const m=document.getElementById('modal-novo-forn');
m.style.display='flex';
setTimeout(()=>document.getElementById('mnf-nome').focus(),80);
}
function fecharModalNovoForn(){document.getElementById('modal-novo-forn').style.display='none';}
function salvarNovoForn(){
const cod=document.getElementById('mnf-cod').value.trim();
const nome=document.getElementById('mnf-nome').value.trim();
if(!nome){document.getElementById('mnf-nome').focus();toast('Informe o nome do fornecedor!',true);return;}
const btn=document.getElementById('mnf-btn-salvar');
if(btn){btn.textContent='⏳ Salvando…';btn.disabled=true;}
google.script.run
.withSuccessHandler(r=>{
if(r.ok){
const novoForn={id:r.id,codigo:cod||'—',nome};
DB.fornecedores.push(novoForn);
renderTbl2('tb-forn',DB.fornecedores,'forn',['codigo','nome'],false);
fecharModalNovoForn();
acSel('forn',novoForn.codigo,novoForn.nome);
toast('✓ Fornecedor cadastrado!');
}else{
if(btn){btn.textContent='💾 Salvar';btn.disabled=false;}
toast('Erro ao cadastrar!',true);
}
})
.withFailureHandler(e=>{if(btn){btn.textContent='💾 Salvar';btn.disabled=false;}toast('Falha: '+e.message,true);})
.addFornecedor({codigo:cod||'—',nome});
}
// ── BUILD EMAIL ──
function gv(id){return document.getElementById(id)?.value?.trim()||'';}
function getAssit(){
const n=cfg.nome||'(configure assinatura)',t=cfg.tel,c=cfg.cargo;
let a=`Atenciosamente,\n${n}`;if(c)a+=`\n${c}`;if(t)a+=`\nTel: ${t}`;return a;
}
function _highlightHtml(texto){
return '<b><span style="background-color:#FFFF00">'+esc(texto)+'</span></b>';
}
function buildEmailHtml(){
const danf=gv('danf'),erroD=selErro.descricao,fornNome=selForn.nome;
const errosAdicionais=[selErro2,selErro3,selErro4].filter(e=>e.codigo);
const statusValBuild=gv('sel_status');
let linhas=[];
if(emailCfg.saudacao)linhas.push(esc(getSaud().l)+',');
if(emailCfg.intro){if(linhas.length)linhas.push('');linhas.push('Segue abaixo informações referentes ao erro de NF para as devidas providências.');}
const campos=[];
if(emailCfg.fornecedor)campos.push('&nbsp;&nbsp;Fornecedor:&nbsp;&nbsp;&nbsp;'+esc(fornNome||'—'));
if(emailCfg.nota)campos.push('&nbsp;&nbsp;NOTA Nº:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'+esc(danf||'—'));
if(emailCfg.descricao){
let descHtml=_highlightHtml((erroD||'—').toUpperCase());
campos.push('&nbsp;&nbsp;DESCRIÇÃO:&nbsp;&nbsp;&nbsp;&nbsp;'+descHtml);
errosAdicionais.forEach(e=>{campos.push('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'+_highlightHtml(e.descricao.toUpperCase()));});
}
if(emailCfg.status&&statusValBuild)campos.push('&nbsp;&nbsp;STATUS:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'+esc(statusValBuild.toUpperCase()));
if(campos.length){
if(emailCfg.separadores)linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
campos.forEach((c,i)=>{ linhas.push(''); linhas.push(c); });
if(emailCfg.separadores)linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
if(emailCfg.cobranca&&cobrancaTexto){linhas.push('');linhas.push(_highlightHtml(cobrancaTexto));}
if(emailCfg.assinatura){
linhas.push('');linhas.push('Atenciosamente,');
linhas.push(esc(cfg.nome||'(configure assinatura)'));
if(cfg.cargo)linhas.push(esc(cfg.cargo));
if(cfg.tel)linhas.push('Tel: '+esc(cfg.tel));
}
return linhas.join('<br>');
}
function buildEmail(){
const danf=gv('danf'),erroCod=selErro.codigo,erroD=selErro.descricao,fornNome=selForn.nome;
const eComp=gv('hid_comp_email'),eComerc=gv('hid_comerc_email'),eLoja=gv('hid_loja_email'),eManif=gv('hid_manif_email');
const paraEmails=[];
if(regraAtiva.includes('comp')&&eComp)paraEmails.push(eComp);
if(regraAtiva.includes('comerc')&&eComerc)paraEmails.push(eComerc);
if(regraAtiva.includes('loja')&&eLoja)paraEmails.push(eLoja);
if(!regraAtiva.length)[eComp,eComerc,eLoja].filter(Boolean).forEach(e=>{if(!paraEmails.includes(e))paraEmails.push(e);});
document.getElementById('out_para').value=paraEmails.join('; ');
document.getElementById('out_cc').value=eManif||'';
const errosAdicionais = [selErro2, selErro3, selErro4].filter(e => e.codigo);
let descErros = erroD || '';
if(errosAdicionais.length) { descErros += ' + ' + errosAdicionais.map(e => e.descricao).join(' + '); }
const pts=[];if(danf)pts.push('Nota Fiscal '+danf);if(fornNome)pts.push('Fornecedor '+fornNome);if(descErros)pts.push('Erro: '+descErros);
document.getElementById('out_assunto').value=pts.join(' - ');
if(!danf&&!erroCod&&!fornNome){document.getElementById('out_corpo').value='';atualizarPreviewJust();return;}
const saud=getSaud().l;
const justSel=document.getElementById('sel_just');
const justOpt=justSel?justSel.options[justSel.selectedIndex]:null;
const justTexto=justOpt&&justOpt.value?justOpt.dataset.texto:'';
atualizarPreviewJust(justTexto,danf);
let corpo=[];
if(emailCfg.saudacao)corpo.push(saud+',');
if(emailCfg.intro){if(corpo.length)corpo.push('');corpo.push('Segue abaixo informações referentes ao erro de NF para as devidas providências.');}
const campos=[];
if(emailCfg.fornecedor)campos.push('  Fornecedor:   '+(fornNome||'—'));
if(emailCfg.nota)campos.push('  NOTA Nº:      '+(danf||'—'));
if(emailCfg.descricao) {
campos.push('  DESCRIÇÃO:    '+(erroD||'—').toUpperCase());
errosAdicionais.forEach(e => { campos.push('                '+e.descricao.toUpperCase()); });
}
const statusValBuild=gv('sel_status');
if(emailCfg.status&&statusValBuild)campos.push('  STATUS:        '+statusValBuild.toUpperCase());
if(campos.length){
if(emailCfg.separadores)corpo.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
campos.forEach((c,i)=>{ corpo.push(c); });
if(emailCfg.separadores)corpo.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
if(emailCfg.cobranca&&cobrancaTexto){corpo.push('');corpo.push(cobrancaTexto);}
if(emailCfg.assinatura){corpo.push('');corpo.push(getAssit());}
document.getElementById('out_corpo').value=corpo.join('\n');
}
function atualizarPreviewJust(justTexto,danf){
const prev=document.getElementById('just-preview');if(!prev)return;
const btn=document.getElementById('btn-copy-just');
if(justTexto&&danf){
const saud=getSaud().l;
const isPlural = /[\/,\-&]|\be\b/i.test(danf);
const prefixoNota = isPlural ? 'Notas Nº' : 'Nota Nº';
let textoFinal = justTexto;
if (isPlural) {
const palavrasPlural = /\b(lançada|lançado|devolvida|devolvido|paga|pago|recebida|recebido|enviada|enviado|concluída|concluído|validada|validado|cancelada|cancelado|aprovada|aprovado|rejeitada|rejeitado|liberada|liberado|baixada|baixado)\b/gi;
textoFinal = justTexto.replace(palavrasPlural, m => { const isUpper = m === m.toUpperCase(); return m + (isUpper ? 'S' : 's'); });
}
prev.style.display='block';
prev.innerHTML=`${esc(saud)},<br>${esc(prefixoNota)} ${esc(danf)} ${esc(textoFinal)}`;
if(btn){prev.appendChild(btn);btn.style.display='';}
} else {
prev.style.display='none';
if(btn)btn.style.display='none';
}
}
function _limparTudoAposJust(){
const sel=document.getElementById('sel_just');if(sel)sel.value='';
const danf=document.getElementById('danf');if(danf)danf.value='';
const selLoja=document.getElementById('sel_loja');
if(selLoja&&_perfilAtivo().toLowerCase()!=='matriz'){selLoja.value='';onPS('loja');}
const selStatus=document.getElementById('sel_status');if(selStatus)selStatus.value='';
selForn.codigo='';selForn.nome='';
const _fornInp=document.getElementById('forn_inp');
const _fornCho=document.getElementById('ac-ch-forn');
if(_fornCho)_fornCho.classList.remove('vis');
if(_fornInp){_fornInp.style.display='';_fornInp.value='';}
closeAllDD();
const prev=document.getElementById('just-preview');if(prev)prev.style.display='none';
buildEmail();
}
function limparJust(){
_limparTudoAposJust();
}
function cpJust(btn) {
closeAllDD();
const prev = document.getElementById('just-preview');
if (!prev) return;
const txt = prev.innerText.replace(/Copiar$/,'').trim();
const danf = document.getElementById('danf')
? document.getElementById('danf').value.trim() : '';
if (!txt)  { toast('Nenhuma justificativa para copiar!', true); return; }
if (!danf) { toast('Informe o número da NF!', true); return; }
const justSel   = document.getElementById('sel_just');
const justOpt   = justSel ? justSel.options[justSel.selectedIndex] : null;
const justText  = justOpt ? justOpt.text : '';
const isLancada = justText.toUpperCase().includes('LANÇADA')
|| justText.toUpperCase().includes('LANCADA');
if (isLancada) {
let fornAtual   = selForn.nome || '';
let statusAtual = (document.getElementById('sel_status') || {}).value || '';
const lojaEl    = document.getElementById('sel_loja');
const lojaOpt   = lojaEl ? lojaEl.options[lojaEl.selectedIndex] : null;
let lojaAtual   = (lojaOpt && lojaEl.value)
? (lojaOpt.dataset.nome || lojaOpt.textContent || '') : '';
const faltaForn   = !fornAtual;
const faltaStatus = emailCfg.status && !statusAtual;
const faltaLoja   = _perfilAtivo().toLowerCase() !== 'matriz' && !lojaAtual;
if (faltaForn || faltaStatus || faltaLoja) {
const registroExistente = DB.historico.find(r =>
String(r.danf).trim() === String(danf).trim()
);
if (registroExistente) {
if (faltaForn   && registroExistente.fornecedor) fornAtual   = registroExistente.fornecedor;
if (faltaStatus && registroExistente.status)     statusAtual = registroExistente.status;
if (faltaLoja   && registroExistente.loja)       lojaAtual   = registroExistente.loja;
_abrirModalConfirmaCopia(danf, txt, btn, true, {
forn:   fornAtual,
status: statusAtual,
loja:   lojaAtual,
});
return;
}
toast(' Buscando informações da NF no histórico...');
google.script.run
.withSuccessHandler(function(lista) {
const encontrado = (lista || []).find(r =>
String(r.danf).trim() === String(danf).trim()
);
let fornBuscado   = fornAtual;
let statusBuscado = statusAtual;
let lojaBuscada   = lojaAtual;
if (encontrado) {
if (faltaForn   && encontrado.fornecedor) fornBuscado   = encontrado.fornecedor;
if (faltaStatus && encontrado.status)     statusBuscado = encontrado.status;
if (faltaLoja   && encontrado.loja)       lojaBuscada   = encontrado.loja;
}
_abrirModalConfirmaCopia(danf, txt, btn, true, {
forn:   fornBuscado,
status: statusBuscado,
loja:   lojaBuscada,
});
})
.withFailureHandler(function() {
_abrirModalConfirmaCopia(danf, txt, btn, true, {
forn:   fornAtual,
status: statusAtual,
loja:   lojaAtual,
});
})
.loadHistFiltrado('2000-01-01', new Date().toISOString().split('T')[0], _perfilAtivo());
return;
}
_executarCpJust(btn, txt, danf, lojaAtual);
return;
}
_executarCpJust(btn, txt, danf, '');
}
function _aplicarDadosDoHistorico(fornNome, statusVal, lojaNome) {
if (fornNome && !selForn.nome) {
const fornObj = DB.fornecedores.find(f => f.nome === fornNome);
if (fornObj) {
acSel('forn', fornObj.codigo, fornObj.nome);
} else {
selForn.nome = fornNome;
selForn.codigo = '';
const cho = document.getElementById('ac-ch-forn');
const txt = document.getElementById('ac-ch-forn-t');
const inp = document.getElementById('forn_inp');
if (cho) cho.classList.add('vis');
if (txt) txt.textContent = fornNome;
if (inp) inp.style.display = 'none';
}
}
if (statusVal) {
const selStatus = document.getElementById('sel_status');
if (selStatus && !selStatus.value) {
selStatus.value = statusVal;
buildEmail();
}
}
if (lojaNome && _perfilAtivo().toLowerCase() !== 'matriz') {
const selLoja = document.getElementById('sel_loja');
if (selLoja && !selLoja.value) {
Array.from(selLoja.options).forEach(o => {
if (o.value && (o.dataset.nome === lojaNome || o.textContent === lojaNome)) {
selLoja.value = o.value;
}
});
onPS('loja');
}
}
}
function _abrirModalConfirmaCopia(danf, txt, btn, isLancada, preenchido) {
const old = document.getElementById('modal-confirma-copia');
if (old) old.remove();
window._cpJustBtn     = btn;
window._cpJustTxt     = txt;
window._cpJustDanf    = danf;
window._cpJustLancada = isLancada;
const fornOpts = DB.fornecedores.map(f =>
`<option value="${esc(f.nome)}" ${f.nome === preenchido.forn ? 'selected' : ''}>${esc(f.nome)}</option>`
).join('');
const lojaOpts = DB.lojas.map(l =>
`<option value="${esc(l.nome)}" ${l.nome === preenchido.loja ? 'selected' : ''}>${esc(l.nome)}</option>`
).join('');
const campoForn = `
<div class="field">
<label>🏭 Fornecedor <span style="color:#ff4d6d">*</span></label>
<div style="position:relative">
<div id="mcc-forn-chosen"
style="display:${preenchido.forn ? 'flex' : 'none'};
align-items:center;justify-content:space-between;
background:var(--inp,#0a1020);border:1px solid var(--inpb,#1e2d48);
border-radius:var(--r,10px);color:var(--text,#e8edf8);
font-family:'DM Mono',monospace;font-size:.85rem;
padding:10px 13px;width:100%;box-sizing:border-box;gap:8px">
<span id="mcc-forn-chosen-txt"
style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-transform:uppercase">
${esc(preenchido.forn || '')}
</span>
<button onclick="_mccFornClear()"
style="background:none;border:none;color:#6b7a99;cursor:pointer;font-size:.9rem;padding:0;line-height:1;flex-shrink:0">✕</button>
</div>
<input type="text" id="mcc-forn-inp"
placeholder="CLIQUE OU DIGITE NOME DO FORNECEDOR…"
autocomplete="off" class="ac-inp"
style="text-transform:uppercase;display:${preenchido.forn ? 'none' : 'block'};width:100%;box-sizing:border-box;"
oninput="this.value=this.value.toUpperCase();_mccFornSearch(this.value)"
onclick="_mccFornSearch(this.value)"
onkeydown="_mccFornKey(event)"
onblur="_mccFornBlur()">
<div id="mcc-forn-dd"
style="display:none;position:absolute;top:100%;left:0;right:0;z-index:9999;
background:#0d1525;border:1px solid #1e2d48;border-top:none;
border-radius:0 0 10px 10px;max-height:220px;overflow-y:auto;
box-shadow:0 8px 24px #00000080">
</div>
</div>
</div>`;
const campoStatus = emailCfg.status ? `
<div class="field">
<label> Status <span style="color:#ff4d6d">*</span></label>
<select id="mcc-status" style="background:#0a1020;border:1px solid #1e2d48;border-radius:10px;
color:#e8edf8;font-family:'DM Mono',monospace;font-size:.85rem;padding:10px 13px;width:100%;outline:none">
<option value="">Selecione o status...</option>
<option value="Entregando" ${preenchido.status === 'Entregando' ? 'selected' : ''}>🚚 Entregando</option>
<option value="Antecipado" ${preenchido.status === 'Antecipado' ? 'selected' : ''}>⚡ Antecipado</option>
</select>
</div>` : '';
const campoLoja = (isLancada && _perfilAtivo().toLowerCase() !== 'matriz') ? `
<div class="field">
<label>🏪 Loja <span style="color:#ff4d6d">*</span></label>
<select id="mcc-loja" style="background:#0a1020;border:1px solid #1e2d48;border-radius:10px;
color:#e8edf8;font-family:'DM Mono',monospace;font-size:.85rem;padding:10px 13px;width:100%;outline:none">
<option value="">Selecione a loja...</option>
${lojaOpts}
</select>
</div>` : '';
const modal = document.createElement('div');
modal.id = 'modal-confirma-copia';
modal.style.cssText = 'position:fixed;inset:0;background:#00000095;backdrop-filter:blur(5px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
modal.innerHTML = `
<div style="background:#1a2236;border:1px solid #1e2d48;border-radius:20px;
padding:28px;max-width:440px;width:100%;animation:fadeUp .2s ease both">
<h3 style="font-size:1rem;font-weight:800;color:#00d4aa;margin-bottom:8px">
📋 Confirmar Cópia — NF ${esc(danf)}
</h3>
<p style="font-family:'DM Mono',monospace;font-size:.76rem;color:#6b7a99;
margin-bottom:20px;line-height:1.6">
Confirme ou preencha os campos abaixo antes de copiar.
</p>
<div style="display:flex;flex-direction:column;gap:14px">
${campoForn}
${campoStatus}
${campoLoja}
</div>
<div style="display:flex;gap:10px;margin-top:22px;justify-content:flex-end">
<button class="btn btn-o" onclick="document.getElementById('modal-confirma-copia').remove()">Cancelar</button>
<button class="btn btn-p" onclick="_confirmarCopia()">✓ Confirmar e Copiar</button>
</div>
</div>`;
document.body.appendChild(modal);
modal.addEventListener('click', e => {
if (e.target.id === 'modal-confirma-copia') modal.remove();
});
setTimeout(() => {
const mccFornInp = document.getElementById('mcc-forn-inp');
if (mccFornInp && !preenchido.forn) { mccFornInp.focus(); return; }
const mccStatus = document.getElementById('mcc-status');
if (mccStatus && !mccStatus.value) { mccStatus.focus(); return; }
const mccLoja = document.getElementById('mcc-loja');
if (mccLoja && !mccLoja.value) mccLoja.focus();
}, 80);
}
function _confirmarCopia() {
const danf      = window._cpJustDanf    || '';
const txt       = window._cpJustTxt     || '';
const btn       = window._cpJustBtn     || {};
const isLancada = window._cpJustLancada || false;
const mccStatus = document.getElementById('mcc-status');
const mccLoja   = document.getElementById('mcc-loja');
const mccChosenTxt = document.getElementById('mcc-forn-chosen-txt');
const mccChosen    = document.getElementById('mcc-forn-chosen');
const fornVal   = (mccChosen && mccChosen.style.display !== 'none' && mccChosenTxt)
? mccChosenTxt.textContent.trim() : '';
const statusVal = mccStatus ? mccStatus.value.trim() : '';
const lojaVal   = mccLoja   ? mccLoja.value.trim()   : '';
let temErro = false;
if (!fornVal) {
const inp = document.getElementById('mcc-forn-inp');
if (inp) { inp.style.borderColor = '#ff4d6d'; setTimeout(() => { inp.style.borderColor = ''; }, 1500); }
toast('Selecione o fornecedor!', true); temErro = true;
}
if (emailCfg.status && !statusVal) {
if (mccStatus) { mccStatus.style.borderColor = '#ff4d6d'; setTimeout(() => { mccStatus.style.borderColor = '#1e2d48'; }, 1500); }
toast('Selecione o status!', true); temErro = true;
}
if (isLancada && _perfilAtivo().toLowerCase() !== 'matriz' && !lojaVal) {
if (mccLoja) { mccLoja.style.borderColor = '#ff4d6d'; setTimeout(() => { mccLoja.style.borderColor = '#1e2d48'; }, 1500); }
toast('Selecione a loja!', true); temErro = true;
}
if (temErro) return;
document.getElementById('modal-confirma-copia').remove();
const fornObj = DB.fornecedores.find(f => f.nome === fornVal);
if (fornObj) { acSel('forn', fornObj.codigo, fornObj.nome); }
else { selForn.nome = fornVal; selForn.codigo = ''; }
if (emailCfg.status && statusVal) {
const selStatus = document.getElementById('sel_status');
if (selStatus) { selStatus.value = statusVal; buildEmail(); }
}
if (isLancada && lojaVal && _perfilAtivo().toLowerCase() !== 'matriz') {
const selLojaPrincipal = document.getElementById('sel_loja');
if (selLojaPrincipal) {
Array.from(selLojaPrincipal.options).forEach(o => {
if (o.value && (o.dataset.nome === lojaVal || o.textContent === lojaVal))
selLojaPrincipal.value = o.value;
});
onPS('loja');
}
}
_executarCpJust(btn, txt, danf, lojaVal);
}
let _mccFornIdx = -1;
function _mccFornSearch(q) {
const dd = document.getElementById('mcc-forn-dd');
if (!dd) return;
_mccFornIdx = -1;
const query = (q || '').trim().toUpperCase();
const matches = query
? DB.fornecedores.filter(f => f.nome.toUpperCase().includes(query) || f.codigo.toUpperCase().includes(query)).slice(0, 500)
: DB.fornecedores.slice(0, 500);
if (!matches.length) {
dd.innerHTML = `<div style="padding:10px 14px;font-family:'DM Mono',monospace;font-size:.78rem;color:#6b7a99">Nenhum resultado.</div>`;
dd.style.display = 'block'; return;
}
dd.innerHTML = matches.map(f => `
<div data-mcc-codigo="${esc(f.codigo)}" data-mcc-nome="${esc(f.nome)}"
style="padding:10px 14px;cursor:pointer;display:flex;justify-content:space-between;
align-items:center;border-bottom:1px solid #1e2d4840;
font-family:'DM Mono',monospace;font-size:.82rem;color:#e8edf8;transition:background .15s">
<span>${esc(f.nome)}</span>
<span style="font-size:.68rem;color:#6b7a99;margin-left:8px">${esc(f.codigo)}</span>
</div>`).join('');
dd.querySelectorAll('div[data-mcc-nome]').forEach(item => {
item.addEventListener('mouseover', () => item.style.background = '#1a2d48');
item.addEventListener('mouseout',  () => item.style.background = '');
item.addEventListener('mousedown', e => { e.preventDefault(); _mccFornPick(item.dataset.mccCodigo, item.dataset.mccNome); });
});
dd.style.display = 'block';
}
function _mccFornPick(codigo, nome) {
const inp    = document.getElementById('mcc-forn-inp');
const chosen = document.getElementById('mcc-forn-chosen');
const txt    = document.getElementById('mcc-forn-chosen-txt');
const dd     = document.getElementById('mcc-forn-dd');
if (dd)     dd.style.display     = 'none';
if (inp)    inp.style.display    = 'none';
if (chosen) chosen.style.display = 'flex';
if (txt)    txt.textContent      = nome;
_mccFornIdx = -1;
}
function _mccFornClear() {
const inp    = document.getElementById('mcc-forn-inp');
const chosen = document.getElementById('mcc-forn-chosen');
const dd     = document.getElementById('mcc-forn-dd');
if (chosen) chosen.style.display = 'none';
if (dd)     dd.style.display     = 'none';
if (inp)    { inp.style.display = 'block'; inp.value = ''; inp.focus(); }
_mccFornIdx = -1;
}
function _mccFornKey(e) {
const dd  = document.getElementById('mcc-forn-dd');
const inp = document.getElementById('mcc-forn-inp');
if (!dd || dd.style.display === 'none') {
if (e.key.length === 1 || e.key === 'ArrowDown') _mccFornSearch(inp ? inp.value : '');
return;
}
const items = Array.from(dd.querySelectorAll('div[data-mcc-nome]'));
if (!items.length) return;
if (e.key === 'ArrowDown') {
e.preventDefault();
if (_mccFornIdx >= 0) items[_mccFornIdx].style.background = '';
_mccFornIdx = Math.min(_mccFornIdx + 1, items.length - 1);
items[_mccFornIdx].style.background = '#1a2d48';
items[_mccFornIdx].scrollIntoView({ block: 'nearest' });
} else if (e.key === 'ArrowUp') {
e.preventDefault();
if (_mccFornIdx >= 0) items[_mccFornIdx].style.background = '';
_mccFornIdx = Math.max(_mccFornIdx - 1, 0);
items[_mccFornIdx].style.background = '#1a2d48';
items[_mccFornIdx].scrollIntoView({ block: 'nearest' });
} else if (e.key === 'Enter') {
e.preventDefault();
if (_mccFornIdx >= 0 && items[_mccFornIdx])
_mccFornPick(items[_mccFornIdx].dataset.mccCodigo, items[_mccFornIdx].dataset.mccNome);
} else if (e.key === 'Escape') {
e.preventDefault(); dd.style.display = 'none'; _mccFornIdx = -1;
}
}
function _mccFornBlur() {
setTimeout(() => {
const dd = document.getElementById('mcc-forn-dd');
if (dd) dd.style.display = 'none';
_mccFornIdx = -1;
}, 150);
}
function _executarCpJust(btn, txt, danf, loja){
const _snapStatus     = gv('sel_status');
const _snapFornNome   = selForn.nome || '';
const _snapFornCod    = selForn.codigo || '';
const _snapCompNome   = gv('hid_comp_nome');
const _snapCompEmail  = gv('hid_comp_email');
const _snapComercNome = gv('hid_comerc_nome');
const _snapComercEmail= gv('hid_comerc_email');
const _snapManifNome  = gv('hid_manif_nome');
const _snapManifEmail = gv('hid_manif_email');
const _snapPara       = gv('out_para');
const _snapVenc       = (document.getElementById('reg-vencimento')||{}).value||'';
function _verificarConflitoDanf(danfVal, lojaAlvo, onConfirmado) {
const lojaAlvoLow = (lojaAlvo || '').trim().toLowerCase();
google.script.run
.withSuccessHandler(function(todasOcs) {
const todos = (todasOcs || []).concat(DB.historico);
const vistos = new Set();
const semDuplicata = todos.filter(r => {
if (vistos.has(r.id)) return false;
vistos.add(r.id); return true;
});
const conflitos = semDuplicata.filter(r =>
String(r.danf).trim() === String(danfVal).trim() &&
(r.loja || '').trim().toLowerCase() !== lojaAlvoLow &&
(r.loja || '').trim() !== ''
);
if (!conflitos.length) { onConfirmado(); return; }
const lojasConflito = [...new Set(conflitos.map(r => r.loja))];
const listaHtml = lojasConflito.map(l => `<strong style="color:#f5a623">${esc(l)}</strong>`).join(', ');
const old = document.getElementById('modal-conflito-danf');
if (old) old.remove();
const lojaOpts = DB.lojas.map(l =>
`<option value="${esc(l.nome)}" ${l.nome === lojaAlvo ? 'selected' : ''}>${esc(l.nome)}</option>`
).join('');
const modal = document.createElement('div');
modal.id = 'modal-conflito-danf';
modal.style.cssText = 'position:fixed;inset:0;background:#00000095;backdrop-filter:blur(5px);z-index:1001;display:flex;align-items:center;justify-content:center;padding:20px';
modal.innerHTML = `
<div style="background:#1a2236;border:1px solid #f5a62350;border-radius:20px;
padding:28px;max-width:480px;width:100%;animation:fadeUp .2s ease both">
<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
<span style="font-size:1.4rem">⚠️</span>
<h3 style="font-size:1rem;font-weight:800;color:#f5a623;margin:0">NF já existe para outra loja</h3>
</div>
<p style="font-family:'DM Mono',monospace;font-size:.78rem;color:#e8edf8;margin-bottom:8px;line-height:1.7">
A NF <strong style="color:#f5a623">${esc(danfVal)}</strong> já possui
${conflitos.length} ocorrência(s) registrada(s) para:
</p>
<div style="background:#f5a62315;border:1px solid #f5a62330;border-radius:10px;
padding:10px 14px;margin-bottom:16px;font-family:'DM Mono',monospace;font-size:.82rem">
${listaHtml}
</div>
<div class="field" style="margin-bottom:18px">
<label style="font-family:'DM Mono',monospace;font-size:.68rem;font-weight:700;
letter-spacing:1.2px;text-transform:uppercase;color:#6b7a99;display:block;margin-bottom:6px">
🏪 Confirmar / Corrigir a Loja desta NF
</label>
<select id="conflito-loja-sel"
style="background:#0a1020;border:1px solid #1e2d48;border-radius:10px;
color:#e8edf8;font-family:'DM Mono',monospace;font-size:.85rem;
padding:10px 13px;width:100%;outline:none;cursor:pointer">
<option value="">Selecione a loja correta…</option>
${lojaOpts}
</select>
</div>
<div style="display:flex;gap:10px;justify-content:flex-end">
<button class="btn btn-o" onclick="document.getElementById('modal-conflito-danf').remove()">Cancelar</button>
<button class="btn btn-p" onclick="
(function(){
const sel = document.getElementById('conflito-loja-sel');
const lojaSel = sel ? sel.value.trim() : '';
if (!lojaSel) {
sel.style.borderColor = '#ff4d6d';
setTimeout(() => { sel.style.borderColor = '#1e2d48'; }, 1500);
return;
}
if (lojaSel !== '${esc(lojaAlvo)}') {
const selLojaPrincipal = document.getElementById('sel_loja');
if (selLojaPrincipal) {
Array.from(selLojaPrincipal.options).forEach(o => {
if (o.value && (o.dataset.nome === lojaSel || o.textContent === lojaSel))
selLojaPrincipal.value = o.value;
});
if (typeof onPS === 'function') onPS('loja');
}
}
document.getElementById('modal-conflito-danf').remove();
window._conflitoCb && window._conflitoCb(lojaSel);
})()
">✓ Registrar mesmo assim</button>
</div>
</div>`;
window._conflitoCb = function(lojaCorrigida) { onConfirmado(lojaCorrigida || lojaAlvo); };
document.body.appendChild(modal);
modal.addEventListener('click', e => { if (e.target.id === 'modal-conflito-danf') modal.remove(); });
})
.withFailureHandler(function() {
const conflitos = DB.historico.filter(r =>
String(r.danf).trim() === String(danfVal).trim() &&
(r.loja || '').trim().toLowerCase() !== lojaAlvoLow &&
(r.loja || '').trim() !== ''
);
if (!conflitos.length) { onConfirmado(); return; }
toast('⚠️ Busca offline: verificando apenas registros em memória.', true);
onConfirmado();
})
.loadHistFiltrado('2000-01-01', new Date().toISOString().split('T')[0], _perfilAtivo());
}
const justSel  = document.getElementById('sel_just');
const justOpt  = justSel ? justSel.options[justSel.selectedIndex] : null;
const justText = justOpt ? justOpt.text : '';
const isLancada = justText.toUpperCase().includes('LANÇADA') || justText.toUpperCase().includes('LANCADA');
const _disparo = (isLancadaExec) => {
if (isLancadaExec && loja) {
google.script.run
.withSuccessHandler(r => {
if (r.ok) {
toast(`✓ Copiado! NF ${danf} — ${r.totalMarcadas||1} ocorrência(s) marcada(s) como LANÇADA!`);
DB.historico.forEach(row => {
if (String(row.danf).trim() === String(danf).trim() &&
(row.loja||'').trim().toLowerCase() === loja.trim().toLowerCase()) {
row.situacao = 'Lançada';
}
});
const _sl = document.getElementById('sel_loja');
if (_sl && _perfilAtivo().toLowerCase() !== 'matriz') { _sl.value = ''; onPS('loja'); }
setTimeout(()=>{ buscarHistPeriodo(); gerarDash(); }, 500);
} else {
const lojaEl    = document.getElementById('sel_loja');
const lojaOpt   = lojaEl ? lojaEl.options[lojaEl.selectedIndex] : null;
const lojaNome  = (lojaOpt && lojaEl.value) ? (lojaOpt.dataset.nome || lojaOpt.textContent || '') : loja || '';
const lojaEmail = (lojaOpt && lojaEl.value) ? (lojaOpt.dataset.email || '') : '';
const horaAgora = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const novaOc = {
danf, fornecedor:_snapFornNome, codForn:_snapFornCod,
codErro:'LANÇADA', erroDesc:'LANÇADA',
comprador:_snapCompNome, emailComprador:_snapCompEmail,
comercial:_snapComercNome, emailComercial:_snapComercEmail,
loja:lojaNome, emailLoja:lojaEmail,
manifesto:_snapManifNome, emailManifesto:_snapManifEmail,
para:_snapPara, status:_snapStatus, hora:horaAgora,
situacao:'Lançada', vencimento:_snapVenc,
perfil: _perfilAtivo()
};
const _salvarNovaOc = (lojaFinal) => {
const lojaDestino = (lojaFinal || lojaNome || '').trim();
const jaExiste = DB.historico.some(r =>
String(r.danf).trim() === String(danf).trim() &&
(r.loja||'').trim().toLowerCase() === lojaDestino.toLowerCase()
);
if (jaExiste) {
google.script.run
.withSuccessHandler(r2 => {
if (r2.ok) {
DB.historico.forEach(row => {
if (String(row.danf).trim()===String(danf).trim() &&
(row.loja||'').trim().toLowerCase()===lojaDestino.toLowerCase())
row.situacao='Lançada';
});
toast(`✓ Copiado! NF ${danf} em "${lojaDestino}" — ${r2.totalMarcadas||1} ocorrência(s) marcada(s) como LANÇADA!`);
setTimeout(()=>{ buscarHistPeriodo(); gerarDash(); }, 500);
} else { toast('✓ Copiado! (falha ao marcar como lançada)', true); }
})
.withFailureHandler(()=>toast('✓ Copiado! (falha ao marcar como lançada)',true))
.updateHistoricoSituacaoPorDANF(danf, lojaDestino, _perfilAtivo());
return;
}
const lojaObjFinal = DB.lojas.find(l => l.nome === lojaDestino);
novaOc.loja      = lojaDestino;
novaOc.emailLoja = lojaObjFinal ? (lojaObjFinal.email||'') : lojaEmail;
google.script.run
.withSuccessHandler(res => {
if (res.ok) {
const hoje = new Date().toLocaleDateString('pt-BR');
DB.historico.push(Object.assign({},novaOc,{id:res.id,data:hoje}));
toast(`✓ Copiado! NF ${danf} registrada para "${lojaDestino}" como LANÇADA!`);
setTimeout(()=>{ buscarHistPeriodo(); gerarDash(); }, 500);
} else { toast('✓ Copiado! (falha ao registrar S/ERRO)',true); }
})
.withFailureHandler(()=>toast('✓ Copiado! (falha ao registrar S/ERRO)',true))
.addHistorico(novaOc);
};
_verificarConflitoDanf(danf, lojaNome, _salvarNovaOc);
}
})
.withFailureHandler(()=>toast('✓ Copiado! (falha ao atualizar)',true))
.updateHistoricoSituacaoPorDANF(danf, loja, _perfilAtivo());
} else if (isLancadaExec && !loja) {
google.script.run
.withSuccessHandler(r => {
if (r.ok) {
toast(`✓ Copiado! NF ${danf} — ${r.totalMarcadas||1} ocorrência(s) marcada(s) como LANÇADA!`);
setTimeout(()=>{ buscarHistPeriodo(); gerarDash(); }, 500);
} else {
toast('✓ Copiado! (NF não encontrada no histórico)');
}
})
.withFailureHandler(()=>{})
.updateHistoricoSituacaoPorDANF(danf, '', _perfilAtivo());
} else {
toast('✓ Justificativa copiada!');
}
setTimeout(()=>{ if(btn){btn.textContent='Copiar';btn.classList.remove('ok');} }, 1500);
};
navigator.clipboard.writeText(txt).then(()=>{
if(btn){btn.textContent='Copiado!';btn.classList.add('ok');}
_disparo(isLancada);
setTimeout(()=>_limparTudoAposJust(), 2000);
}).catch(()=>{
try{
const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);
ta.select();document.execCommand('copy');document.body.removeChild(ta);
if(btn){btn.textContent='Copiado!';btn.classList.add('ok');}
_disparo(isLancada);
setTimeout(()=>_limparTudoAposJust(), 2000);
}catch(e){
toast('Não foi possível copiar automaticamente. Selecione e copie o texto manualmente.', true);
}
});
}
// ── SALVAR + COPIAR ──
function salvarECopiar(btn){
const corpoEl = document.getElementById('out_corpo');
const _corpoTexto = corpoEl ? corpoEl.value.trim() : '';
if (!_corpoTexto) { toast('Nada para copiar — preencha os campos primeiro!', true); return; }
let _corpoHtml = '';
try {
_corpoHtml = buildEmailHtml();
} catch(e) {
console.error('[salvarECopiar] Falha ao gerar HTML formatado:', e);
}
if (!_corpoHtml || !_corpoHtml.trim()) {
_corpoHtml = esc(_corpoTexto).replace(/\n/g, '<br>');
}
const orig = btn ? btn.innerHTML : '';
_copiarComHtml(_corpoTexto, _corpoHtml, null);
if (btn) { btn.innerHTML = '⏳ Salvando…'; btn.disabled = true; }
salvar().catch(e => console.error('[salvarECopiar] Erro em salvar():', e)).finally(() => {
if (btn) {
btn.innerHTML = '✓ Salvo e Copiado!';
btn.classList.add('ok');
setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; btn.classList.remove('ok'); }, 1800);
}
});
}
// ── SALVAR HISTÓRICO ──
let _salvandoOcorrencia = false;
async function salvar(){
if (_salvandoOcorrencia) { return; } // trava contra duplo clique / duplo disparo
const danf=gv('danf');
const fornText=selForn.nome||document.getElementById('forn_inp').value.trim();
const erroCod=selErro.codigo;
const lojaId=gv('sel_loja');
const statusVal=gv('sel_status');
if(!danf){toast('Informe o número da NF!',true);return;}
if(!fornText){toast('Informe o Fornecedor!',true);return;}
if(!erroCod){toast('Informe o Erro!',true);return;}
if(!lojaId && _perfilAtivo().toLowerCase() !== 'matriz'){
toast('Selecione a Loja!',true);
const selLoja=document.getElementById('sel_loja');
if(selLoja&&selLoja.disabled){setTimeout(()=>toast('A regra deste erro bloqueia a Loja. Altere em Configurações!',true),2600);}
return;
}
if(emailCfg.status&&!statusVal){
toast('Status é obrigatório quando habilitado!',true);
const elSt=document.getElementById('sel_status');if(elSt)elSt.focus();
return;
}
_salvandoOcorrencia = true;
try {
const vencimentoRaw = document.getElementById('reg-vencimento') ? document.getElementById('reg-vencimento').value || '' : '';
const justSel = document.getElementById('sel_just');
const justOpt = justSel ? justSel.options[justSel.selectedIndex] : null;
const justText = justOpt ? justOpt.text : '';
const isLancada = justText.toUpperCase().includes('LANÇADA') || justText.toUpperCase().includes('LANCADA');
const situacaoVal = isLancada ? 'Lançada' : 'Pendente';
const horaAgora = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const btn=document.querySelector('#p-reg .btn-p[onclick="salvar()"]');
if(btn){btn.textContent='⏳ Salvando…';btn.disabled=true;}
const errosParaSalvarBruto = [
{cod: selErro.codigo, desc: selErro.descricao},
{cod: selErro2.codigo, desc: selErro2.descricao},
{cod: selErro3.codigo, desc: selErro3.descricao},
{cod: selErro4.codigo, desc: selErro4.descricao}
].filter(e => e.cod);
// remove erros repetidos (ex: o mesmo código selecionado sem querer em 2 slots)
const codsVistos = new Set();
const errosParaSalvar = errosParaSalvarBruto.filter(e => {
if (codsVistos.has(e.cod)) return false;
codsVistos.add(e.cod);
return true;
});
if (errosParaSalvarBruto.length !== errosParaSalvar.length) {
toast('⚠️ Erro repetido nos slots foi ignorado automaticamente.', true);
}
const lojaNome = _perfilAtivo().toLowerCase() === 'matriz' ? 'MATRIZ' : gv('hid_loja_nome');
const lojaEmail = _perfilAtivo().toLowerCase() === 'matriz' ? '' : gv('hid_loja_email');
let salvos = 0, errosCount = 0;
for (const erro of errosParaSalvar) {
const data = {
danf, fornecedor: fornText, codForn: selForn.codigo,
codErro: erro.cod, erroDesc: erro.desc,
comprador: gv('hid_comp_nome'), emailComprador: gv('hid_comp_email'),
comercial: gv('hid_comerc_nome'), emailComercial: gv('hid_comerc_email'),
loja: lojaNome, emailLoja: lojaEmail,
manifesto: gv('hid_manif_nome'), emailManifesto: gv('hid_manif_email'),
para: gv('out_para'), status: statusVal, hora: horaAgora,
situacao: situacaoVal,
vencimento: vencimentoRaw,
perfil: _perfilAtivo()
};
try {
await new Promise((resolve, reject) => {
google.script.run
.withSuccessHandler(r => {
if(r.ok) { const hoje = new Date().toLocaleDateString('pt-BR'); DB.historico.push(Object.assign({}, data, {id: r.id, data: hoje})); salvos++; resolve(); }
else reject(new Error('Erro no retorno do servidor'));
})
.withFailureHandler(reject)
.addHistorico(data);
});
} catch (e) { console.error('Erro ao salvar erro ' + erro.cod, e); errosCount++; }
}
if(btn){btn.textContent='💾 Salvar no Histórico';btn.disabled=false;}
if(salvos > 0) {
toast(`✓ ${salvos} registro(s) salvo(s) no histórico!`);
const ind=document.getElementById('saved-ind');
if(ind){ind.textContent=`✓ ${salvos} ocorrência(s) registrada(s) com sucesso!`;ind.classList.add('show');setTimeout(()=>ind.classList.remove('show'),3000);}
renderTblHist();gerarDash();resetReg();window.scrollTo({top:0,behavior:'smooth'});
}
if(errosCount > 0) { toast(`Falha ao salvar ${errosCount} registro(s).`, true); }
} finally {
_salvandoOcorrencia = false;
}
}
function resetReg(){
selErro.codigo='';selErro.descricao='';
selErro2.codigo='';selErro2.descricao='';
selErro3.codigo='';selErro3.descricao='';
selErro4.codigo='';selErro4.descricao='';
selForn.codigo='';selForn.nome='';regraAtiva=[];
['erro','erro2','erro3','erro4','forn'].forEach(type=>{
let inpId = 'forn_inp';
if(type === 'erro') inpId = 'erro_inp';
else if(type === 'erro2') inpId = 'erro_inp2';
else if(type === 'erro3') inpId = 'erro_inp3';
else if(type === 'erro4') inpId = 'erro_inp4';
const inp=document.getElementById(inpId);
const cho=document.getElementById('ac-ch-'+type);
if(cho)cho.classList.remove('vis');
if(inp){inp.style.display='';inp.value='';}
closeDD(type);
});
['danf','hid_comp_email','hid_comp_nome','hid_comerc_email','hid_comerc_nome','hid_loja_email','hid_loja_nome','hid_manif_email','hid_manif_nome','reg-vencimento'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
['sel_comp','sel_comerc','sel_loja','sel_manif','sel_just','sel_status'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
['sel_comp','sel_comerc','sel_loja'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=true;});
setTimeout(applyLojaFixa, 50);
['em_comp','em_comerc','em_loja','em_manif'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='—';el.className='ps-email dis';}});
['out_para','out_cc','out_assunto','out_corpo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
const ruleInfo=document.getElementById('rule-info');if(ruleInfo)ruleInfo.style.display='none';
const prev=document.getElementById('just-preview');if(prev)prev.style.display='none';
document.activeElement.blur();
}
// ── RENDER TABELAS ──
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function renderAll(){
renderTbl2('tb-erros', DB.codErros,    'codErro',  ['codigo','descricao'],true);
renderTbl2('tb-forn',  DB.fornecedores,'forn',     ['codigo','nome'],false);
renderTbl2('tb-comp',  DB.compradores, 'comp',     ['nome','email'],false);
renderTbl2('tb-comerc',DB.comerciais,  'comerc',   ['nome','email'],false);
renderTbl2('tb-loja',  DB.lojas,       'loja',     ['nome','email'],false);
renderTbl2('tb-manif', DB.manifestos,  'manif',    ['nome','email'],false);
renderTblHist();renderTblRegras();renderTblJust();popSelJust();popHistFiltros();
}
const labelMap={comp:'Comprador',comerc:'Comercial',loja:'Loja'};
function renderTbl2(tbId,list,type,keys,showRegra){
const tb=document.getElementById(tbId);
if(!list||!list.length){tb.innerHTML=`<tr class="empty-r"><td colspan="${showRegra?5:4}">Nenhum cadastro ainda.</td></tr>`;return;}
tb.innerHTML=list.map(r=>{
let regraTd='',regraActs='';
if(showRegra){
const regra=DB.regras.find(rg=>rg.codErro===r.codigo&&rg.descErro===r.descricao);
regraTd=regra?`<td>${regra.destinatarios.split(',').filter(Boolean).map(k=>`<span class="btag" style="background:#00d4aa15;color:var(--accent)">${labelMap[k.trim()]||k.trim()}</span>`).join(' ')}</td>`:`<td><span style="color:var(--warn);font-size:.72rem">⚠ Sem regra</span></td>`;
regraActs=regra?`<button class="btn btn-pu btn-sm" onclick="editRegraFromList('${esc(r.codigo)}','${esc(r.descricao)}')">Regra</button><button class="btn btn-d btn-sm" onclick="confirmDel('regra',${regra.id},'regra ${esc(r.codigo)}')">🗑 Regra</button>`:`<button class="btn btn-pu btn-sm" onclick="editRegraFromList('${esc(r.codigo)}','${esc(r.descricao)}')">+ Regra</button>`;
}
return`<tr id="row-${type}-${r.id}">
<td><span class="bcod">${esc(r[keys[0]])}</span></td>
<td>${esc(r[keys[1]])}</td>${regraTd}
<td><div class="acts">
<button class="btn btn-w btn-sm" onclick="openEdit('${type}',${r.id})">✏ Editar</button>
<button class="btn btn-d btn-sm" onclick="confirmDel('${type}',${r.id},'${esc(r[keys[0]])}')">🗑</button>
${regraActs}
</div></td>
</tr>`;
}).join('');
}
function renderTblHist(lista){
const tb = document.getElementById('tb-hist');
const dados = lista || DB.historico || [];
if(!dados.length){
tb.innerHTML = '<tr class="empty-r"><td colspan="9">Nenhum registro encontrado.</td></tr>';
return;
}
tb.innerHTML = dados.slice().reverse().map(r => {
let horaFormatada = '';
if (r.hora) { const match = String(r.hora).match(/\d{2}:\d{2}/); horaFormatada = match ? match[0] : String(r.hora); }
const horaHtml = r.hora ? `<span class="hist-hora">⏱ ${esc(horaFormatada)}</span>` : '';
let vencEmoji = '⚪';
let vencClasse = '';
let vencTooltip = 'Sem data de vencimento';
if (r.vencimento && String(r.vencimento).trim() !== '') {
const vencStr = String(r.vencimento).trim();
let vencExib = vencStr;
const limpaExib = vencStr.split('T')[0];
if (limpaExib.includes('-')) {
const p = limpaExib.split('-');
if (p.length === 3 && p[0].length === 4) vencExib = p[2].padStart(2,'0') + '/' + p[1].padStart(2,'0') + '/' + p[0];
}
vencTooltip = `Vencimento: ${vencExib}`;
let vencDate = null;
const limpa = vencStr.split('T')[0];
if (limpa.includes('/')) {
const p = limpa.split('/');
if (p.length === 3) vencDate = new Date(Number(p[2]), Number(p[1])-1, Number(p[0]));
} else if (limpa.includes('-')) {
const p = limpa.split('-');
if (p.length === 3) vencDate = new Date(Number(p[0]), Number(p[1])-1, Number(p[2]));
}
if (vencDate && !isNaN(vencDate.getTime())) {
const hoje = new Date(); hoje.setHours(0,0,0,0); vencDate.setHours(0,0,0,0);
const diffDays = Math.ceil((vencDate - hoje) / 86400000);
if (diffDays < 0) { vencEmoji = '🔴'; vencClasse = 'vencida'; vencTooltip += ` (${Math.abs(diffDays)} dias vencida)`; }
else if (diffDays <= 7) { vencEmoji = '🟠'; vencClasse = 'proxima'; vencTooltip += ` (${diffDays} dias restantes)`; }
else { vencEmoji = ''; vencTooltip += ` (${diffDays} dias restantes)`; }
}
}
const situacaoBadge = r.situacao === 'Lançada'
? `<span style="font-size:0.7rem;font-weight:800;color:#00d4aa;background:#00d4aa15;padding:2px 7px;border-radius:4px;">✓ Lançada</span>`
: r.situacao === 'Devolvida'
? `<span style="font-size:0.7rem;font-weight:800;color:#a78bfa;background:#a78bfa15;padding:2px 7px;border-radius:4px;">↩ Devolvida</span>`
: r.situacao === 'Cancelada'
? `<span style="font-size:0.7rem;font-weight:800;color:#ff4d6d;background:#ff4d6d15;padding:2px 7px;border-radius:4px;">✕ Cancelada</span>`
: `<span style="font-size:0.7rem;font-weight:800;color:#f5a623;background:#f5a62315;padding:2px 7px;border-radius:4px;">Pendente</span>`;
return `
<tr class="${vencClasse}">
<td>${esc(r.data||'—')}${horaHtml}</td>
<td><span class="bcod">${esc(r.danf||'—')}</span></td>
<td>${esc(r.fornecedor||'—')}</td>
<td>${esc(r.loja||'—')}</td>
<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
${r.erroDesc ? `<span class="btag" style="background:#f5a62315;color:var(--warn)" title="${esc(r.erroDesc)}">${esc(r.erroDesc)}</span>` : '<span style="color:var(--muted)">—</span>'}
</td>
<td>${esc(r.comprador||'—')}</td>
<td>${statusBadge ? statusBadge(r.status) : (r.status||'—')}</td>
<td style="text-align:center;font-size:1.45rem;line-height:1;cursor:help;" title="${vencTooltip}">${vencEmoji}</td>
<td>
<div class="acts">
${situacaoBadge}
<button class="btn btn-w btn-sm" onclick="openEditHist(${r.id})"> Editar</button>
<button class="btn btn-d btn-sm" onclick="confirmDel('hist',${r.id},'NF ${esc(r.danf||r.id)}')">🗑</button>
</div>
</td>
</tr>`;
}).join('');
}
// ── HISTÓRICO COM PERÍODO ──
let _histCarregado = false;
function hist_hoje() {
const hoje = todayStr();
document.getElementById('hist-de').value  = hoje;
document.getElementById('hist-ate').value = hoje;
buscarHistPeriodo();
}
function hist_semana() {
const ate = new Date();
const de  = new Date(); de.setDate(de.getDate() - 6);
const fmt = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
document.getElementById('hist-de').value  = fmt(de);
document.getElementById('hist-ate').value = fmt(ate);
buscarHistPeriodo();
}
function hist_mes() {
const hoje = new Date();
const fmt  = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
document.getElementById('hist-de').value  = hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0')+'-01';
document.getElementById('hist-ate').value = fmt(hoje);
buscarHistPeriodo();
}
function buscarHistPeriodo() {
    const de  = document.getElementById('hist-de').value;
    const ate = document.getElementById('hist-ate').value;
    if (!de || !ate) { toast('Selecione o período!', true); return; }
    const lbl = document.getElementById('hist-count-lbl');
    const tb  = document.getElementById('tb-hist');
    if (lbl) lbl.textContent = '⏳ Buscando na base de dados...';
    if (tb)  tb.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted);font-style:italic">Consultando Sistema...</td></tr>';
    
    google.script.run
    .withSuccessHandler(function(lista) {
        // 1. Guarda TODOS os registros na memória para paginação frontend
        _histCompleto = lista || [];
        
        // 2. Mostra apenas os primeiros 100 na tela inicialmente
        DB.historico = _histCompleto.slice(0, 100);
        
        _histCarregado = true;
        filtrarHist();
        gerarDash();
        
        const fmtD = v => { const p=v.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; };
        if (lbl) lbl.textContent = DB.historico.length + ' de ' + _histCompleto.length + ' registro(s) · ' + fmtD(de) + ' → ' + fmtD(ate);
        
        const hoje = new Date(); hoje.setHours(0,0,0,0);
        let vencidas = [], proximas = [];
        (DB.historico||[]).forEach(function(r) {
            if (!r.vencimento || String(r.vencimento).trim() === '') return;
            if (r.situacao === 'Lançada') return;
            const vStr = String(r.vencimento).trim().split('T')[0];
            let vd = null;
            if (vStr.includes('/')) { const p=vStr.split('/'); if(p.length===3) vd=new Date(Number(p[2]),Number(p[1])-1,Number(p[0])); }
            else if (vStr.includes('-')) { const p=vStr.split('-'); if(p.length===3) vd=new Date(Number(p[0]),Number(p[1])-1,Number(p[2])); }
            if (!vd || isNaN(vd.getTime())) return;
            vd.setHours(0,0,0,0);
            const diff = Math.ceil((vd - hoje) / 86400000);
            if (diff < 0) vencidas.push({ danf: r.danf, dias: Math.abs(diff) });
            else if (diff <= 7) proximas.push({ danf: r.danf, dias: diff });
        });
        
        if (!vencidas.length && !proximas.length) {
            toast('✓ Busca concluída!');
        } else {
            const partes = [];
            if (vencidas.length) {
                const nfs = vencidas.slice(0,2).map(v => 'NF ' + v.danf + ' (' + v.dias + 'd vencida)').join(' | ');
                const extra = vencidas.length > 2 ? ' +' + (vencidas.length-2) : '';
                partes.push('🔴 ' + vencidas.length + ' vencida' + (vencidas.length >1?'s':'') + ': ' + nfs + extra);
            }
            if (proximas.length) {
                const nfs = proximas.slice(0,2).map(v => v.dias===0 ? 'NF ' + v.danf + ' (hoje)' : 'NF ' + v.danf + ' (' + v.dias + 'd)').join(' | ');
                const extra = proximas.length > 2 ? ' +' + (proximas.length-2) : '';
                partes.push('🟠 ' + proximas.length + ' a vencer: ' + nfs + extra);
            }
            toast('⚠ ' + partes.join('  ·  '), true, 5000);
            setTimeout(function() { mostrarAlertasVencimento(DB.historico || []); }, 300);
        }
        
        // 3. Lógica do botão "Carregar Mais"
        const btnMais = document.getElementById('btn-hist-carregar-mais');
        if (btnMais) {
            if (_histCompleto.length > 100) {
                btnMais.style.display = 'block';
            } else {
                btnMais.style.display = 'none';
            }
        }
    })
    .withFailureHandler(function(e) {
        if (lbl) lbl.textContent = 'Erro ao carregar';
        toast('Falha: ' + e.message, true);
    })
    .loadHistFiltrado(de, ate, _perfilAtivo());
}
function filtrarHist() {
const fNf     = (document.getElementById('hist-f-nf')?.value     || '').trim().toLowerCase();
const fForn   = (document.getElementById('hist-f-forn')?.value   || '').trim().toLowerCase();
const fLoja   = (document.getElementById('hist-f-loja')?.value   || '').trim();
const fErro   = (document.getElementById('hist-f-erro')?.value   || '').trim().toLowerCase();
const fComp   = (document.getElementById('hist-f-comp')?.value   || '').trim().toLowerCase();
const fSit    = (document.getElementById('hist-f-sit')?.value    || '').trim().toLowerCase();
const fStatus = (document.getElementById('hist-f-status')?.value || '').trim().toLowerCase();
const fVenc   = (document.getElementById('hist-f-venc')?.value   || '').trim();
const temFiltro = fNf || fForn || fLoja || fErro || fComp || fSit || fStatus || fVenc;
if (!temFiltro) {
renderTblHist();
_atualizarContadorHist(DB.historico.length);
return;
}
const filtrado = DB.historico.filter(r => {
if (fNf     && !(r.danf       || '').toLowerCase().includes(fNf))     return false;
if (fForn   && !(r.fornecedor || '').toLowerCase().includes(fForn))   return false;
if (fLoja) {
if (fLoja.startsWith('__grupo__')) {
const nomeGrupo = fLoja.replace('__grupo__', '');
const grupo = DB.gruposLoja.find(g => g.grupo.toUpperCase() === nomeGrupo.toUpperCase());
const lojasDoGrupo = grupo ? grupo.lojas.split(',').map(x => x.trim().toLowerCase()).filter(Boolean) : [];
if (!lojasDoGrupo.length) return false;
if (!lojasDoGrupo.includes((r.loja || '').trim().toLowerCase())) return false;
} else {
if (!(r.loja || '').toLowerCase().includes(fLoja.toLowerCase())) return false;
}
}
if (fErro   && !(r.erroDesc   || '').toLowerCase().includes(fErro))   return false;
if (fComp   && !(r.comprador  || '').toLowerCase().includes(fComp))   return false;
if (fSit    && !(r.situacao   || '').toLowerCase().includes(fSit))    return false;
if (fStatus && !(r.status     || '').toLowerCase().includes(fStatus)) return false;
if (fVenc) {
const vRaw = String(r.vencimento || '').trim();
const temVenc = vRaw !== '' && vRaw !== 'undefined';
if (fVenc === 'sem') { if (temVenc) return false; }
else if (fVenc === 'com') { if (!temVenc) return false; }
else {
if (!temVenc) return false;
let vencDate = null;
const limpa = vRaw.split('T')[0];
if (limpa.includes('/')) { const p = limpa.split('/'); if (p.length === 3) vencDate = new Date(Number(p[2]), Number(p[1])-1, Number(p[0])); }
else if (limpa.includes('-')) { const p = limpa.split('-'); if (p.length === 3) vencDate = new Date(Number(p[0]), Number(p[1])-1, Number(p[2])); }
if (!vencDate || isNaN(vencDate.getTime())) return false;
const hoje = new Date(); hoje.setHours(0,0,0,0); vencDate.setHours(0,0,0,0);
const diff = Math.ceil((vencDate - hoje) / 86400000);
if (fVenc === 'vencida'  && diff >= 0)             return false;
if (fVenc === 'proxima'  && (diff < 0 || diff > 7)) return false;
if (fVenc === 'ok'       && diff <= 7)              return false;
}
}
return true;
});
renderTblHist(filtrado);
_atualizarContadorHist(filtrado.length, DB.historico.length);
}
function _atualizarContadorHist(total, totalBase) {
const lbl = document.getElementById('hist-count-lbl');
if (!lbl) return;
const de  = document.getElementById('hist-de')?.value  || '';
const ate = document.getElementById('hist-ate')?.value || '';
const fmtD = v => { if(!v) return ''; const p = v.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; };
if (totalBase !== undefined && totalBase !== total) {
lbl.innerHTML = `<span style="color:var(--accent);font-weight:700">${total}</span>` +
` de ${totalBase} registro(s)` +
(de && ate ? ` · ${fmtD(de)} → ${fmtD(ate)}` : '') +
` <span style="color:var(--warn);font-size:.65rem;margin-left:4px">● filtrado</span>`;
} else {
lbl.textContent = `${total} registro(s)` + (de && ate ? ` · ${fmtD(de)} → ${fmtD(ate)}` : '');
}
}
function imprimirHist() {
const dados = DB.historico;
if (!dados || !dados.length) { toast('Nenhum registro para imprimir!', true); return; }
const fNf     = (document.getElementById('hist-f-nf')?.value     || '').trim().toLowerCase();
const fForn   = (document.getElementById('hist-f-forn')?.value   || '').trim().toLowerCase();
const fLoja   = (document.getElementById('hist-f-loja')?.value   || '').trim();
const fErro   = (document.getElementById('hist-f-erro')?.value   || '').trim().toLowerCase();
const fComp   = (document.getElementById('hist-f-comp')?.value   || '').trim().toLowerCase();
const fSit    = (document.getElementById('hist-f-sit')?.value    || '').trim().toLowerCase();
const fStatus = (document.getElementById('hist-f-status')?.value || '').trim().toLowerCase();
const fVenc   = (document.getElementById('hist-f-venc')?.value   || '').trim();
const lista = dados.filter(r => {
if (fNf     && !(r.danf       || '').toLowerCase().includes(fNf))     return false;
if (fForn   && !(r.fornecedor || '').toLowerCase().includes(fForn))   return false;
if (fLoja) {
if (fLoja.startsWith('__grupo__')) {
const nomeGrupo = fLoja.replace('__grupo__', '');
const grupo = DB.gruposLoja.find(g => g.grupo.toUpperCase() === nomeGrupo.toUpperCase());
const lojasDoGrupo = grupo ? grupo.lojas.split(',').map(x => x.trim().toLowerCase()).filter(Boolean) : [];
if (!lojasDoGrupo.length) return false;
if (!lojasDoGrupo.includes((r.loja || '').trim().toLowerCase())) return false;
} else {
if (!(r.loja || '').toLowerCase().includes(fLoja.toLowerCase())) return false;
}
}
if (fErro   && !(r.erroDesc  || '').toLowerCase().includes(fErro))   return false;
if (fComp   && !(r.comprador || '').toLowerCase().includes(fComp))   return false;
if (fSit    && !(r.situacao  || '').toLowerCase().includes(fSit))    return false;
if (fStatus && !(r.status    || '').toLowerCase().includes(fStatus)) return false;
if (fVenc) {
const vRaw = String(r.vencimento || '').trim();
const temVenc = vRaw !== '' && vRaw !== 'undefined';
if (fVenc === 'sem') { if (temVenc) return false; }
else if (fVenc === 'com') { if (!temVenc) return false; }
else {
if (!temVenc) return false;
let vencDate = null;
const limpa = vRaw.split('T')[0];
if (limpa.includes('/')) { const p = limpa.split('/'); if (p.length === 3) vencDate = new Date(Number(p[2]), Number(p[1])-1, Number(p[0])); }
else if (limpa.includes('-')) { const p = limpa.split('-'); if (p.length === 3) vencDate = new Date(Number(p[0]), Number(p[1])-1, Number(p[2])); }
if (!vencDate || isNaN(vencDate.getTime())) return false;
const hoje = new Date(); hoje.setHours(0,0,0,0); vencDate.setHours(0,0,0,0);
const diff = Math.ceil((vencDate - hoje) / 86400000);
if (fVenc === 'vencida'  && diff >= 0)             return false;
if (fVenc === 'proxima'  && (diff < 0 || diff > 7)) return false;
if (fVenc === 'ok'       && diff <= 7)              return false;
}
}
return true;
});
if (!lista.length) { toast('Nenhum registro após filtros!', true); return; }
toast('⏳ Gerando PDF...');
setTimeout(async () => {
try {
const { jsPDF } = window.jspdf;
const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
const PW = 297, PH = 210, M = 8;
const de  = document.getElementById('hist-de').value;
const ate = document.getElementById('hist-ate').value;
const fmtD = v => { if(!v) return ''; const p = v.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; };
function bgPage() { pdf.setFillColor(255,255,255); pdf.rect(0,0,PW,PH,'F'); }
function drawHeader() {
pdf.setFontSize(13); pdf.setTextColor(0,0,0); pdf.setFont('helvetica','bold');
pdf.text('Histórico de Ocorrências — Sistema NFe', M, M+6);
pdf.setFontSize(8); pdf.setTextColor(80,80,80); pdf.setFont('helvetica','normal');
pdf.text('Sistema de Gestão de Erros de NFE', M, M+11);
if(cfg.nome){let assina=cfg.nome;if(cfg.cargo)assina+=' · '+cfg.cargo;pdf.text(assina,M,M+15);}
pdf.setFontSize(8.5); pdf.setTextColor(0,0,0); pdf.setFont('helvetica','bold');
pdf.text('Período: '+fmtD(de)+' → '+fmtD(ate)+'   ·   '+lista.length+' registro(s)', PW-M, M+6, {align:'right'});
pdf.setFontSize(7.5); pdf.setTextColor(100,100,100); pdf.setFont('helvetica','normal');
pdf.text('Gerado em: '+new Date().toLocaleString('pt-BR'), PW-M, M+11, {align:'right'});
pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.4);
pdf.line(M, M+17, PW-M, M+17); pdf.setLineWidth(0.2);
}
const cols = [
{label:'Data',       key:'data',       w:20},
{label:'Hora',       key:'hora',       w:12},
{label:'NF',         key:'danf',       w:20},
{label:'Fornecedor', key:'fornecedor', w:44},
{label:'Loja',       key:'loja',       w:32},
{label:'Erro',       key:'erroDesc',   w:44},
{label:'Comprador',  key:'comprador',  w:30},
{label:'Status',     key:'status',     w:22},
{label:'Situação',   key:'situacao',   w:22},
];
const tableW = PW-M*2;
const scale  = tableW/cols.reduce((s,c)=>s+c.w,0);
cols.forEach(c=>c.w=Math.round(c.w*scale));
const rowH=7, headerH=9;
let curY=M+20;
const drawTableHeader=()=>{
pdf.setFillColor(230,230,230); pdf.rect(M,curY,tableW,headerH,'F');
pdf.setFontSize(6.5); pdf.setTextColor(0,0,0); pdf.setFont('helvetica','bold');
let x=M; cols.forEach(c=>{pdf.text(c.label.toUpperCase(),x+3,curY+6);x+=c.w;});
pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.3);
pdf.line(M,curY+headerH,M+tableW,curY+headerH); pdf.setLineWidth(0.2);
curY+=headerH;
};
bgPage(); drawHeader(); drawTableHeader();
lista.slice().reverse().forEach((r,idx)=>{
if(curY+rowH>PH-M){pdf.addPage();bgPage();curY=M;drawTableHeader();}
if(idx%2===0){pdf.setFillColor(245,247,250);pdf.rect(M,curY,tableW,rowH,'F');}
pdf.setFontSize(7); pdf.setFont('helvetica','normal');
let x=M;
cols.forEach(c=>{
let val=String(r[c.key]||'—');
if(c.key==='hora'&&val!=='—'){const m=val.match(/\d{2}:\d{2}/);val=m?m[0]:val;}
const maxChars=Math.floor((c.w-4)/1.7);
if(val.length>maxChars)val=val.slice(0,maxChars-1)+'…';
if(c.key==='status'){if(r.status==='Entregando')pdf.setTextColor(180,100,0);else if(r.status==='Antecipado')pdf.setTextColor(0,140,100);else pdf.setTextColor(120,120,120);}
else if(c.key==='situacao'){if(r.situacao==='Lançada')pdf.setTextColor(0,140,100);else if(r.situacao==='Devolvida')pdf.setTextColor(130,100,200);else if(r.situacao==='Cancelada')pdf.setTextColor(220,60,60);else pdf.setTextColor(180,100,0);}
else if(c.key==='danf'){pdf.setTextColor(30,90,180);}
else if(c.key==='erroDesc'){pdf.setTextColor(160,80,0);}
else{pdf.setTextColor(30,30,30);}
pdf.text(val,x+3,curY+5); x+=c.w;
});
pdf.setDrawColor(200,200,200); pdf.setLineWidth(0.15);
pdf.line(M,curY+rowH,M+tableW,curY+rowH); curY+=rowH;
});
_salvarPdfCompativel(pdf, 'Historico_NFS_'+(de||'todos')+'_a_'+(ate||'todos')+'.pdf');
toast('✓ PDF gerado com sucesso!');
} catch(err){ console.error(err); toast('Erro ao gerar PDF: '+err.message,true); }
}, 200);
}
// ── EDITAR HISTÓRICO ──
function openEditHist(id){
const item = DB.historico.find(x => Number(x.id) === Number(id));
if(!item){
toast('⏳ Carregando...');
google.script.run
.withSuccessHandler(function(lista){
DB.historico = lista || [];
const found = DB.historico.find(x => Number(x.id) === Number(id));
if(!found){ toast('Registro não encontrado!', true); return; }
_abrirModalHist(found);
})
.withFailureHandler(function(e){ toast('Erro: ' + e.message, true); })
.loadHistFiltrado(
document.getElementById('hist-de').value,
document.getElementById('hist-ate').value,
_perfilAtivo()
);
return;
}
_abrirModalHist(item);
}
function _abrirModalHist(item){
const id = item.id;
_mod = {type:'hist', id, situacao: item.situacao||'Pendente'};
document.getElementById('modal-title').textContent = 'Editar Ocorrência';
const fornOpts = DB.fornecedores.map(f =>
'<option value="'+esc(f.nome)+'" '+(f.nome===item.fornecedor?'selected':'')+'>'+esc(f.nome)+'</option>').join('');
const lojaOpts = DB.lojas.map(l =>
'<option value="'+esc(l.nome)+'" '+(l.nome===item.loja?'selected':'')+'>'+esc(l.nome)+'</option>').join('');
const erroOpts = DB.codErros.map(e =>
'<option value="'+esc(e.descricao)+'" '+(e.descricao===item.erroDesc?'selected':'')+'>'+esc(e.descricao)+'</option>').join('');
const compOpts = DB.compradores.map(c =>
'<option value="'+esc(c.nome)+'" '+(c.nome===item.comprador?'selected':'')+'>'+esc(c.nome)+'</option>').join('');
let horaFormatada = '';
if(item.hora){ const match = String(item.hora).match(/\d{2}:\d{2}/); horaFormatada = match ? match[0] : String(item.hora); }
let vencValue = '';
const vRaw = String(item.vencimento || '').trim();
if(vRaw && vRaw !== 'undefined' && vRaw !== '') {
if(vRaw.toLowerCase().startsWith('sat')||vRaw.toLowerCase().startsWith('sun')||
vRaw.toLowerCase().startsWith('mon')||vRaw.toLowerCase().startsWith('tue')||
vRaw.toLowerCase().startsWith('wed')||vRaw.toLowerCase().startsWith('thu')||
vRaw.toLowerCase().startsWith('fri')) { vencValue = ''; }
else if(vRaw.includes('/')) {
const p = vRaw.split('/');
if(p.length === 3 && p[2].length === 4) vencValue = p[2]+'-'+p[1].padStart(2,'0')+'-'+p[0].padStart(2,'0');
} else if(vRaw.includes('-') && vRaw.length >= 10 && !isNaN(Date.parse(vRaw.split('T')[0]))) {
vencValue = vRaw.split('T')[0];
}
}
const fornManual = !DB.fornecedores.find(f => f.nome === item.fornecedor);
const erroManual = !DB.codErros.find(e => e.descricao === item.erroDesc);
document.getElementById('modal-fields').innerHTML =
'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
'<div class="field"><label>NF / DANF</label>' +
'<input type="text" id="mf0" value="'+esc(item.danf||'')+'" autocomplete="off"></div>' +
'<div class="field"><label>Fornecedor</label>' +
'<select id="mf1" style="'+(fornManual?'display:none':'')+'">' +
'<option value="">Selecione…</option>'+fornOpts+'</select>' +
'<input type="text" id="mf1-custom" placeholder="Ou digite manualmente…" '+
'style="margin-top:6px;display:'+(fornManual?'block':'none')+'" '+
'value="'+(fornManual?esc(item.fornecedor||''):'')+'">' +
'<label style="margin-top:4px;display:flex;align-items:center;gap:6px;cursor:pointer;'+
'text-transform:none;letter-spacing:0;font-size:.72rem;color:var(--muted)">' +
'<input type="checkbox" id="mf1-manual" onchange="toggleManualForn(this.checked)" '+
(fornManual?'checked ':'')+
'style="width:13px;height:13px;accent-color:var(--accent)"> Digitar manualmente</label></div>' +
'<div class="field"><label>Loja</label>' +
'<select id="mf2"><option value="">Selecione…</option>'+lojaOpts+'</select></div>' +
'<div class="field"><label>Comprador</label>' +
'<select id="mf4"><option value="">Selecione…</option>'+compOpts+'</select></div>' +
'<div class="field"><label>Erro (Descrição)</label>' +
'<select id="mf3" style="'+(erroManual?'display:none':'')+'">' +
'<option value="">Selecione…</option>'+erroOpts+'</select>' +
'<input type="text" id="mf3-custom" placeholder="Ou digite manualmente…" '+
'style="margin-top:6px;display:'+(erroManual?'block':'none')+'" '+
'value="'+(erroManual?esc(item.erroDesc||''):'')+'">' +
'<label style="margin-top:4px;display:flex;align-items:center;gap:6px;cursor:pointer;'+
'text-transform:none;letter-spacing:0;font-size:.72rem;color:var(--muted)">' +
'<input type="checkbox" id="mf3-manual" onchange="toggleManualErro(this.checked)" '+
(erroManual?'checked ':'')+
'style="width:13px;height:13px;accent-color:var(--accent)"> Digitar manualmente</label></div>' +
'<div class="field"><label>Status</label>' +
'<select id="mf-status">' +
'<option value="" '+(!item.status?'selected':'')+'>Sem status…</option>' +
'<option value="Entregando" '+(item.status==='Entregando'?'selected':'')+'>🚚 Entregando</option>' +
'<option value="Antecipado" '+(item.status==='Antecipado'?'selected':'')+'>⚡ Antecipado</option>' +
'</select></div>' +
'<div class="field"><label>Situação</label>' +
'<select id="mf-situacao">' +
'<option value="Pendente" '+((!item.situacao||item.situacao==='Pendente')?'selected':'')+'>Pendente</option>' +
'<option value="Lançada" '+(item.situacao==='Lançada'?'selected':'')+'>✓ Lançada</option>' +
'<option value="Devolvida" '+(item.situacao==='Devolvida'?'selected':'')+'>↩ Devolvida</option>' +
'<option value="Cancelada" '+(item.situacao==='Cancelada'?'selected':'')+'>✕ Cancelada</option>' +
'</select></div>' +
'<div class="field"><label>Data de Vencimento '+
'<span style="color:var(--muted);font-size:.6rem">(opcional)</span></label>' +
'<input type="date" id="mf-vencimento" value="'+vencValue+'" '+
'style="background:var(--inp);border:1px solid var(--inpb);border-radius:var(--r);'+
'color:var(--text);font-family:\'DM Mono\',monospace;font-size:.85rem;'+
'padding:10px 13px;width:100%;outline:none;color-scheme:dark;cursor:pointer;"></div>' +
(item.hora ?
'<div style="grid-column:span 2;font-family:\'DM Mono\',monospace;font-size:.72rem;'+
'color:var(--muted);padding:6px 10px;background:var(--inp);'+
'border-radius:var(--r);border:1px solid var(--inpb)">'+
'⏱ Registrado às <strong style="color:var(--accent)">'+esc(horaFormatada)+'</strong> — a hora não é editável</div>'
: '') +
'</div>';
document.getElementById('modal-bg').classList.add('open');
document.getElementById('mf0').focus();
}
function toggleManualForn(checked){
document.getElementById('mf1').style.display=checked?'none':'block';
document.getElementById('mf1-custom').style.display=checked?'block':'none';
}
function toggleManualErro(checked){
document.getElementById('mf3').style.display=checked?'none':'block';
document.getElementById('mf3-custom').style.display=checked?'block':'none';
}
// ── MODAL ──
const TYPE_CFG={
codErro:{list:()=>DB.codErros,  labels:['Código','Descrição'],keys:['codigo','descricao'],fn:'updateCodErro',dbKey:'codErros'},
forn:   {list:()=>DB.fornecedores,labels:['Código','Nome'],   keys:['codigo','nome'],     fn:'updateFornecedor',dbKey:'fornecedores'},
comp:   {list:()=>DB.compradores, labels:['Nome','E-mail'],   keys:['nome','email'],      fn:'updateComprador',dbKey:'compradores'},
comerc: {list:()=>DB.comerciais,  labels:['Nome','E-mail'],   keys:['nome','email'],      fn:'updateComercial',dbKey:'comerciais'},
loja:   {list:()=>DB.lojas,       labels:['Nome','E-mail'],   keys:['nome','email'],      fn:'updateLoja',dbKey:'lojas'},
manif:  {list:()=>DB.manifestos,  labels:['Nome','E-mail'],   keys:['nome','email'],      fn:'updateManifesto',dbKey:'manifestos'},
just:   {list:()=>DB.justificativas,labels:['Texto'],         keys:['texto'],             fn:'_justSave',dbKey:'justificativas'},
};
let _mod={type:'',id:0};
const RENDER_MAP={
codErro: ()=>{ renderTbl2('tb-erros',DB.codErros,'codErro',['codigo','descricao'],true); renderRegrasEditor(); },
forn:    ()=>{ renderTbl2('tb-forn',DB.fornecedores,'forn',['codigo','nome'],false); },
comp:    ()=>{ renderTbl2('tb-comp',DB.compradores,'comp',['nome','email'],false); popSel('sel_comp',DB.compradores); },
comerc:  ()=>{ renderTbl2('tb-comerc',DB.comerciais,'comerc',['nome','email'],false); popSel('sel_comerc',DB.comerciais); },
loja:    ()=>{ renderTbl2('tb-loja',DB.lojas,'loja',['nome','email'],false); popSel('sel_loja',DB.lojas); },
manif:   ()=>{ renderTbl2('tb-manif',DB.manifestos,'manif',['nome','email'],false); popSel('sel_manif',DB.manifestos); },
just:    ()=>{ renderTblJust(); popSelJust(); },
};
function openEdit(type,id){
const c=TYPE_CFG[type];if(!c)return;
const item=c.list().find(x=>x.id==id);if(!item)return;
_mod={type,id};
document.getElementById('modal-title').textContent='Editar '+c.labels.join(' / ');
document.getElementById('modal-fields').innerHTML=c.keys.map((k,i)=>`<div class="field"><label>${c.labels[i]}</label><input type="text" id="mf${i}" value="${esc(item[k])}"></div>`).join('');
document.getElementById('modal-bg').classList.add('open');
document.getElementById('mf0').focus();
}
function modalSave(){
const btn=document.querySelector('#modal-bg .btn-p[onclick="modalSave()"]');
if(btn){btn.textContent='⏳ Salvando…';btn.disabled=true;}
const restore=()=>{if(btn){btn.textContent='💾 Salvar';btn.disabled=false;}};
if(_mod.type==='hist'){
const item=DB.historico.find(x=>x.id===_mod.id);if(!item){restore();return;}
const fornManual=document.getElementById('mf1-manual')?.checked;
const fornVal=fornManual?(document.getElementById('mf1-custom')?.value?.trim()||''):(document.getElementById('mf1')?.value?.trim()||'');
const lojaVal=document.getElementById('mf2')?.value?.trim()||'';
const lojaObj=DB.lojas.find(l=>l.nome===lojaVal);
const compradorVal=document.getElementById('mf4')?.value||'';
const compradorObj=DB.compradores.find(c=>c.nome===compradorVal);
const erroManual=document.getElementById('mf3-manual')?.checked;
const erroVal=erroManual?(document.getElementById('mf3-custom')?.value?.trim()||''):(document.getElementById('mf3')?.value?.trim()||'');
const erroObj=DB.codErros.find(e=>e.descricao===erroVal);
const statusVal=document.getElementById('mf-status')?.value||'';
const situacaoVal=document.getElementById('mf-situacao')?.value||'Pendente';
const vencRaw = document.getElementById('mf-vencimento') ? document.getElementById('mf-vencimento').value : '';
const data=Object.assign({},item,{
danf: document.getElementById('mf0').value.trim(),
fornecedor: fornVal, loja: lojaVal,
emailLoja: lojaObj?lojaObj.email:item.emailLoja,
comprador: compradorVal,
emailComprador: compradorObj?compradorObj.email:item.emailComprador,
erroDesc: erroVal,
codErro: erroObj?erroObj.codigo:item.codErro,
status: statusVal,
situacao: situacaoVal,
vencimento: vencRaw || '',
perfil: _perfilAtivo(),
});
google.script.run
.withSuccessHandler(r=>{
restore();
if(r.ok){
toast('✓ Atualizado!');closeModal();
const situacaoAnterior=(DB.historico.find(x=>x.id===_mod.id)||{}).situacao||'Pendente';
const idx=DB.historico.findIndex(x=>x.id===_mod.id);
if(idx>=0)DB.historico[idx]=data;
const situacaoNova=data.situacao;
if(situacaoNova!==situacaoAnterior){
const outrasNFs=DB.historico.filter(row=>
row.id!==data.id&&
String(row.danf).trim()===String(data.danf).trim()&&
String(row.loja).trim().toLowerCase()===String(data.loja).trim().toLowerCase()
);
outrasNFs.forEach(row=>{row.situacao=situacaoNova;});
outrasNFs.forEach(row=>{
google.script.run.updateHistorico(Object.assign({},row,{situacao:situacaoNova,perfil:_perfilAtivo()}));
});
}
if(typeof filtrarHist==='function'){filtrarHist();}else{renderTblHist();}
gerarDash();
}else toast('Erro!',true);
})
.withFailureHandler(e=>{restore();toast(e.message,true);})
.updateHistorico(data);
return;
}
if(_mod.type==='just'){
const texto=document.getElementById('mf0').value.trim();
if(!texto){toast('Preencha o texto!',true);restore();return;}
google.script.run
.withSuccessHandler(r=>{
restore();
if(r.ok){
toast('✓ Atualizado!');closeModal();
const idx=DB.justificativas.findIndex(x=>x.id===_mod.id);
if(idx>=0)DB.justificativas[idx].texto=texto;
RENDER_MAP['just']();
}else toast('Erro!',true);
})
.withFailureHandler(e=>{restore();toast(e.message,true);})
.updateJustificativa({id:_mod.id,texto});
return;
}
const c=TYPE_CFG[_mod.type];if(!c){restore();return;}
const f1=document.getElementById('mf0').value.trim(),f2=document.getElementById('mf1')?.value?.trim()||'';
if(!f1){toast('Preencha o campo!',true);restore();return;}
const _payloadModal=(_mod.type==='comp'||_mod.type==='codErro')
? {id:_mod.id,f1,f2,perfil:_perfilAtivo()}
: {id:_mod.id,f1,f2};
google.script.run
.withSuccessHandler(r=>{
restore();
if(r.ok){
toast('✓ Atualizado!');closeModal();
const list=DB[c.dbKey];
const idx=list.findIndex(x=>x.id===_mod.id);
if(idx>=0){list[idx][c.keys[0]]=f1;if(c.keys[1])list[idx][c.keys[1]]=f2;}
RENDER_MAP[_mod.type]&&RENDER_MAP[_mod.type]();
}else toast('Erro!',true);
})
.withFailureHandler(e=>{restore();toast(e.message,true);})
[c.fn](_payloadModal);
}
function closeModal(){document.getElementById('modal-bg').classList.remove('open');}
document.getElementById('modal-bg').addEventListener('click',e=>{if(e.target.id==='modal-bg')closeModal();});
document.getElementById('modal-novo-forn')?.addEventListener('click',e=>{if(e.target.id==='modal-novo-forn')fecharModalNovoForn();});
// ── ADD CADASTROS ─
function _btnBusy(el,txt){if(!el)return;el._orig=el.textContent;el.textContent=txt||'⏳ Salvando…';el.disabled=true;}
function _btnFree(el){if(!el)return;el.textContent=el._orig||'+ Adicionar';el.disabled=false;}
function addErro(){
const cod=document.getElementById('ne-cod').value.trim(),desc=document.getElementById('ne-desc').value.trim();
if(!cod||!desc){toast('Preencha código e descrição!',true);return;}
const btn=document.querySelector('#p-erros .card-sm .btn-p');_btnBusy(btn);
google.script.run
.withSuccessHandler(r=>{
_btnFree(btn);
if(r.ok){
toast('✓ Erro cadastrado!');
DB.codErros.push({id:r.id,codigo:cod,descricao:desc});
document.getElementById('ne-cod').value='';document.getElementById('ne-desc').value='';
renderTbl2('tb-erros',DB.codErros,'codErro',['codigo','descricao'],true);renderRegrasEditor();
}else toast('Erro!',true);
})
.withFailureHandler(e=>{_btnFree(btn);toast(e.message,true);})
.addCodErro({codigo:cod,descricao:desc,perfil:_perfilAtivo()});
}
function addForn(){
const cod=document.getElementById('nf-cod').value.trim(),nome=document.getElementById('nf-nome').value.trim();
if(!nome){toast('Informe o nome!',true);return;}
const btn=document.querySelector('#p-forn .card-sm .btn-p');_btnBusy(btn);
google.script.run
.withSuccessHandler(r=>{
_btnFree(btn);
if(r.ok){
toast('✓ Fornecedor cadastrado!');
DB.fornecedores.push({id:r.id,codigo:cod||'—',nome});
document.getElementById('nf-cod').value='';document.getElementById('nf-nome').value='';
renderTbl2('tb-forn',DB.fornecedores,'forn',['codigo','nome'],false);
}else toast('Erro!',true);
})
.withFailureHandler(e=>{_btnFree(btn);toast(e.message,true);})
.addFornecedor({codigo:cod||'—',nome});
}
function filtrarForn(q) {
const ql = (q || '').trim().toLowerCase();
const lista = ql ? DB.fornecedores.filter(f => f.nome.toLowerCase().includes(ql) || f.codigo.toLowerCase().includes(ql)) : DB.fornecedores;
renderTbl2('tb-forn', lista, 'forn', ['codigo','nome'], false);
}
function filtrarErros(q) {
const ql = (q || '').trim().toLowerCase();
const lista = ql ? DB.codErros.filter(e => e.codigo.toLowerCase().includes(ql) || e.descricao.toLowerCase().includes(ql)) : DB.codErros;
renderTbl2('tb-erros', lista, 'codErro', ['codigo','descricao'], true);
}
function filtrarComp(q) {
const ql = (q || '').trim().toLowerCase();
const lista = ql ? DB.compradores.filter(c => c.nome.toLowerCase().includes(ql) || (c.email||'').toLowerCase().includes(ql)) : DB.compradores;
renderTbl2('tb-comp', lista, 'comp', ['nome','email'], false);
}
function filtrarComerc(q) {
const ql = (q || '').trim().toLowerCase();
const lista = ql ? DB.comerciais.filter(c => c.nome.toLowerCase().includes(ql) || (c.email||'').toLowerCase().includes(ql)) : DB.comerciais;
renderTbl2('tb-comerc', lista, 'comerc', ['nome','email'], false);
}
function filtrarLoja(q) {
const ql = (q || '').trim().toLowerCase();
const lista = ql ? DB.lojas.filter(l => l.nome.toLowerCase().includes(ql) || (l.email||'').toLowerCase().includes(ql)) : DB.lojas;
renderTbl2('tb-loja', lista, 'loja', ['nome','email'], false);
}
function filtrarManif(q) {
const ql = (q || '').trim().toLowerCase();
const lista = ql ? DB.manifestos.filter(m => m.nome.toLowerCase().includes(ql) || (m.email||'').toLowerCase().includes(ql)) : DB.manifestos;
renderTbl2('tb-manif', lista, 'manif', ['nome','email'], false);
}
function addComp(){
const nome=document.getElementById('nc-nome').value.trim(),email=document.getElementById('nc-email').value.trim();
if(!nome){toast('Informe o nome!',true);return;}
const btn=document.querySelector('#p-comp .card-sm .btn-p');_btnBusy(btn);
google.script.run
.withSuccessHandler(r=>{
_btnFree(btn);
if(r.ok){
toast('✓ Comprador adicionado!');
DB.compradores.push({id:r.id,nome,email});
document.getElementById('nc-nome').value='';document.getElementById('nc-email').value='';
renderTbl2('tb-comp',DB.compradores,'comp',['nome','email'],false);popSel('sel_comp',DB.compradores);
}else toast('Erro!',true);
})
.withFailureHandler(e=>{_btnFree(btn);toast(e.message,true);})
.addComprador({nome,email,perfil:_perfilAtivo()});
}
function addComerc(){
const nome=document.getElementById('nco-nome').value.trim(),email=document.getElementById('nco-email').value.trim();
if(!nome){toast('Informe o nome!',true);return;}
const btn=document.querySelector('#p-comerc .card-sm .btn-p');_btnBusy(btn);
google.script.run
.withSuccessHandler(r=>{
_btnFree(btn);
if(r.ok){
toast('✓ Comercial adicionado!');
DB.comerciais.push({id:r.id,nome,email});
document.getElementById('nco-nome').value='';document.getElementById('nco-email').value='';
renderTbl2('tb-comerc',DB.comerciais,'comerc',['nome','email'],false);popSel('sel_comerc',DB.comerciais);
}else toast('Erro!',true);
})
.withFailureHandler(e=>{_btnFree(btn);toast(e.message,true);})
.addComercial({nome,email});
}
function addLoja(){
const nome=document.getElementById('nl-nome').value.trim(),email=document.getElementById('nl-email').value.trim();
if(!nome){toast('Informe o nome!',true);return;}
const btn=document.querySelector('#p-loja .card-sm .btn-p');_btnBusy(btn);
google.script.run
.withSuccessHandler(r=>{
_btnFree(btn);
if(r.ok){
toast('✓ Loja adicionada!');
DB.lojas.push({id:r.id,nome,email});
document.getElementById('nl-nome').value='';document.getElementById('nl-email').value='';
renderTbl2('tb-loja',DB.lojas,'loja',['nome','email'],false);popSel('sel_loja',DB.lojas);
}else toast('Erro!',true);
})
.withFailureHandler(e=>{_btnFree(btn);toast(e.message,true);})
.addLoja({nome,email});
}
function addManif(){
const nome=document.getElementById('nm-nome').value.trim(),email=document.getElementById('nm-email').value.trim();
if(!nome){toast('Informe o nome!',true);return;}
const btn=document.querySelector('#p-manif .card-sm .btn-p');_btnBusy(btn);
google.script.run
.withSuccessHandler(r=>{
_btnFree(btn);
if(r.ok){
toast('✓ Manifesto adicionado!');
DB.manifestos.push({id:r.id,nome,email});
document.getElementById('nm-nome').value='';document.getElementById('nm-email').value='';
renderTbl2('tb-manif',DB.manifestos,'manif',['nome','email'],false);popSel('sel_manif',DB.manifestos);
}else toast('Erro!',true);
})
.withFailureHandler(e=>{_btnFree(btn);toast(e.message,true);})
.addManifesto({nome,email});
}
// ── JUSTIFICATIVAS ──
function renderTblJust(){
const tb=document.getElementById('tb-just');if(!tb)return;
if(!DB.justificativas.length){tb.innerHTML='<tr class="empty-r"><td colspan="3">Nenhuma justificativa cadastrada.</td></tr>';return;}
tb.innerHTML=DB.justificativas.map(j=>`
<tr>
<td style="font-family:'DM Mono',monospace">${esc(j.texto)}</td>
<td><div class="acts">
<button class="btn btn-w btn-sm" onclick="openEditJust(${j.id})">✏ Editar</button>
<button class="btn btn-d btn-sm" onclick="confirmDel('just',${j.id},'${esc(j.texto)}')">🗑</button>
</div></td>
</tr>`).join('');
}
function addJust(){
const texto=document.getElementById('nj-texto').value.trim();
if(!texto){toast('Informe o texto da justificativa!',true);return;}
const btn=document.querySelector('#p-just .card-sm .btn-p');_btnBusy(btn);
google.script.run
.withSuccessHandler(r=>{
_btnFree(btn);
if(r.ok){
toast('✓ Justificativa adicionada!');
DB.justificativas.push({id:r.id,texto});
document.getElementById('nj-texto').value='';
renderTblJust();popSelJust();
}else toast('Erro!',true);
})
.withFailureHandler(e=>{_btnFree(btn);toast(e.message,true);})
.addJustificativa({texto});
}
function openEditJust(id){
const item=DB.justificativas.find(x=>x.id===id);if(!item)return;
_mod={type:'just',id};
document.getElementById('modal-title').textContent='Editar Justificativa';
document.getElementById('modal-fields').innerHTML=`<div class="field"><label>Texto</label><input type="text" id="mf0" value="${esc(item.texto)}"></div>`;
document.getElementById('modal-bg').classList.add('open');
document.getElementById('mf0').focus();
}
// ─ DELETE ──
const DB_KEY_MAP={codErro:'codErros',forn:'fornecedores',comp:'compradores',comerc:'comerciais',loja:'lojas',manif:'manifestos',hist:'historico',regra:'regras',just:'justificativas',grupoLoja:'gruposLoja'};
const FN_DEL={codErro:'deleteCodErro',forn:'deleteFornecedor',comp:'deleteComprador',comerc:'deleteComercial',loja:'deleteLoja',manif:'deleteManifesto',hist:'deleteHistorico',regra:'deleteRegra',just:'deleteJustificativa',grupoLoja:'deleteGrupoLoja'};
let _cfCb=null;
function confirmDel(type,id,label){
document.getElementById('cf-msg').textContent=`Excluir "${label}" (ID #${id})?`;
document.getElementById('cfbg').classList.add('open');
_cfCb=()=>{
const dbKey=DB_KEY_MAP[type];
const afterOk=r=>{
if(r&&r.ok!==false){
toast('✓ Excluído!');
if(dbKey){DB[dbKey]=DB[dbKey].filter(x=>Number(x.id)!==Number(id));}
if(type==='codErro'){renderTbl2('tb-erros',DB.codErros,'codErro',['codigo','descricao'],true);renderRegrasEditor();}
else if(type==='forn'){renderTbl2('tb-forn',DB.fornecedores,'forn',['codigo','nome'],false);}
else if(type==='comp'){renderTbl2('tb-comp',DB.compradores,'comp',['nome','email'],false);popSel('sel_comp',DB.compradores);}
else if(type==='comerc'){renderTbl2('tb-comerc',DB.comerciais,'comerc',['nome','email'],false);popSel('sel_comerc',DB.comerciais);}
else if(type==='loja'){renderTbl2('tb-loja',DB.lojas,'loja',['nome','email'],false);popSel('sel_loja',DB.lojas);}
else if(type==='manif'){renderTbl2('tb-manif',DB.manifestos,'manif',['nome','email'],false);popSel('sel_manif',DB.manifestos);}
else if(type==='hist'){renderTblHist();gerarDash();}
else if(type==='regra'){renderTblRegras();renderRegrasEditor();}
else if(type==='just'){renderTblJust();popSelJust();}
else if(type==='grupoLoja'){renderGruposLoja();popHistFiltros();}
}else toast('Erro!',true);
};
if(type==='hist'){
google.script.run
.withSuccessHandler(afterOk)
.withFailureHandler(e=>toast(e.message,true))
.deleteHistorico(id, _perfilAtivo());
} else if(type==='comp'){
google.script.run
.withSuccessHandler(afterOk)
.withFailureHandler(e=>toast(e.message,true))
.deleteComprador(id, _perfilAtivo());
} else if(type==='codErro'){
google.script.run
.withSuccessHandler(afterOk)
.withFailureHandler(e=>toast(e.message,true))
.deleteCodErro(id, _perfilAtivo());
} else {
google.script.run
.withSuccessHandler(afterOk)
.withFailureHandler(e=>toast(e.message,true))
[FN_DEL[type]](id);
}
};
}
function closeCf(){document.getElementById('cfbg').classList.remove('open');_cfCb=null;}
document.getElementById('cf-yes').onclick=()=>{const fn=_cfCb;closeCf();if(fn)fn();};
document.getElementById('cfbg').addEventListener('click',e=>{if(e.target.id==='cfbg')closeCf();});
// ── COPY ──
function cpF(id,btn){
const el=document.getElementById(id),v=el.value||el.textContent||'';if(!v)return;
if(id==='out_corpo'){
_copiarComHtml(v,buildEmailHtml(),btn);
return;
}
navigator.clipboard.writeText(v).then(()=>{
el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),600);
const o=btn.innerHTML;btn.innerHTML='✓ Copiado!';btn.classList.add('ok');
setTimeout(()=>{btn.innerHTML=o;btn.classList.remove('ok');},1500);
toast('✓ Copiado!');
}).catch(()=>{
try{
const ta=document.createElement('textarea');ta.value=v;document.body.appendChild(ta);
ta.select();document.execCommand('copy');document.body.removeChild(ta);
const o=btn.innerHTML;btn.innerHTML='✓ Copiado!';btn.classList.add('ok');
setTimeout(()=>{btn.innerHTML=o;btn.classList.remove('ok');},1500);
toast('✓ Copiado!');
}catch(e){
toast('Não foi possível copiar automaticamente. Selecione e copie o texto manualmente.', true);
}
});
}
function _copiarComHtml(textoPlano,htmlFormatado,btn){
const sucesso=()=>{
const el=document.getElementById('out_corpo');
if(el){el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),600);}
if(btn){const o=btn.innerHTML;btn.innerHTML='✓ Copiado!';btn.classList.add('ok');
setTimeout(()=>{btn.innerHTML=o;btn.classList.remove('ok');},1500);}
toast('✓ Copiado com formatação!');
};
const copiarViaSelecao = () => {
let div;
try{
div = document.createElement('div');
div.contentEditable = 'true';
div.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;white-space:pre-wrap;'+
'background-color:#ffffff;color:#000000;font-family:Arial,Helvetica,sans-serif;font-size:14px;';
div.innerHTML = htmlFormatado;
document.body.appendChild(div);
const range = document.createRange();
range.selectNodeContents(div);
const sel = window.getSelection();
sel.removeAllRanges();
sel.addRange(range);
const ok = document.execCommand('copy');
sel.removeAllRanges();
document.body.removeChild(div);
return ok;
}catch(e){
if(div && div.parentNode) div.parentNode.removeChild(div);
return false;
}
};
if (copiarViaSelecao()) { sucesso(); return; }
if(navigator.clipboard && window.ClipboardItem){
try{
const blobHtml=new Blob([htmlFormatado],{type:'text/html'});
const blobTxt=new Blob([textoPlano],{type:'text/plain'});
const item=new ClipboardItem({'text/html':blobHtml,'text/plain':blobTxt});
navigator.clipboard.write([item]).then(sucesso).catch(()=>{
navigator.clipboard.writeText(textoPlano).then(sucesso).catch(()=>_copiarFallback(textoPlano,sucesso));
});
return;
}catch(e){
navigator.clipboard.writeText(textoPlano).then(sucesso).catch(()=>_copiarFallback(textoPlano,sucesso));
return;
}
}
_copiarFallback(textoPlano,sucesso);
}
function _copiarFallback(texto,cb){
try{
const ta=document.createElement('textarea');ta.value=texto;document.body.appendChild(ta);
ta.select();document.execCommand('copy');document.body.removeChild(ta);
cb();
}catch(e){
toast('Não foi possível copiar automaticamente. Selecione e copie o texto manualmente.', true);
}
}
// ── ENTER ──
[['ne-cod','ne-desc',addErro],['nf-cod','nf-nome',addForn],['nc-nome','nc-email',addComp],
['nco-nome','nco-email',addComerc],['nl-nome','nl-email',addLoja],['nm-nome','nm-email',addManif],
['ia-e-cod','ia-e-desc',qAddErro],
].forEach(([a,b,fn])=>{[a,b].forEach(id=>{const el=document.getElementById(id);if(el)el.addEventListener('keydown',e=>{if(e.key==='Enter')fn();});});});
// ── UTILS ─
let _tt;
function toast(msg,err=false,duracao){
const t=document.getElementById('toast');t.textContent=msg;t.className=err?'show err':'show';
clearTimeout(_tt);_tt=setTimeout(()=>t.className='',duracao||2500);
}
function show(id){document.getElementById(id).style.display='flex';}
function hide(id){document.getElementById(id).style.display='none';}
// ════════════════════════════════════════════════════════════════
//  DASHBOARD NFS
// ════════════════════════════════════════════════════════════════
document.addEventListener('_SistemaCarregado', function() {
var el = document.getElementById('dashnfs-saud');
if (el && typeof getSaud === 'function') { var s = getSaud(); el.textContent = s.e + ' ' + s.l + '!'; }
if (typeof dnfsCfgLoad === 'function') dnfsCfgLoad();
});
var DNFS = { sheets:{}, activeSheet:null, allRows:[], allHeaders:[], filteredRows:[], charts:{} };
var DNFS_CFG = {
semPedido_exclHorti:  false,
comPedido_exclHorti:  false,
autoIncl_exclHorti:   false,
manualIncl_exclHorti: false,
ranking_autoExclHorti: true,
};
function dnfsCfgLoad() {
try { var s=localStorage.getItem(_key('nfs_dnfs_cfg')); if(s) DNFS_CFG=Object.assign(DNFS_CFG,JSON.parse(s)); } catch {}
dnfsCfgRenderToggles();
}
function dnfsCfgSave() {
try { localStorage.setItem(_key('nfs_dnfs_cfg'), JSON.stringify(DNFS_CFG)); } catch {}
toast('✓ Configurações NFS salvas!');
if(DNFS.activeSheet && DNFS.sheets[DNFS.activeSheet]) { dnfsRenderKPIs(); dnfsRenderCharts(); }
}
function dnfsCfgToggle(key) { DNFS_CFG[key]=!DNFS_CFG[key]; dnfsCfgRenderToggles(); }
function dnfsCfgRenderToggles() {
var fields=['semPedido_exclHorti','comPedido_exclHorti','autoIncl_exclHorti','manualIncl_exclHorti','ranking_autoExclHorti'];
fields.forEach(function(f){
var el=document.getElementById('dnfscfg-'+f);
var lbl=document.getElementById('dnfscfgtgl-'+f);
if(el) el.checked=DNFS_CFG[f];
if(lbl) lbl.classList.toggle('checked',DNFS_CFG[f]);
});
}
var DNFS_AL = {
fornecedor:   ['fornecedor','supplier','razão social','razao social','forne'],
cfop:         ['cfop'],
numero:       ['número','numero','nf','nota','number','num. nota','num nota'],
emissao:      ['emissão','emissao','data emissão','data emissao','emission','dt emis','data emit'],
valor:        ['valor','value','total','montante','vl total','vl. total','vlr'],
condpagto:    ['cond. pagto','cond pagto','condição','cond.','pagamento','cond pag'],
carga:        ['carga','load','num carga','nº carga'],
incluiunf:    ['incluiu nf','incluiu','operador','usuario','usuário','incluído'],
pedido:       ['pedido','order','num pedido','nº pedido','com pedido','sem pedido','c/ pedido','s/ pedido'],
xml:          ['xml','com xml','sem xml','possui xml','tem xml'],
tipoinclusao: ['tipo inclusao','tipo inclusão','tipo inc','inclusao','inclusão','automático','automatico','manual'],
categoria:    ['categoria','segmento','setor','tipo fornecedor','hortifrut','hortifruit','outros'],
};
function dnfsDetCol(headers, key) {
var al=DNFS_AL[key]||[];
var low=headers.map(function(h){return String(h).toLowerCase().trim();});
for(var i=0;i<al.length;i++){for(var j=0;j<low.length;j++){if(low[j].includes(al[i]))return j;}}
return -1;
}
function dnfsDragOver(e) { e.preventDefault(); var d=document.getElementById('dnfs-drop');if(d)d.classList.add('drag-over'); }
function dnfsDragLeave(e){ var d=document.getElementById('dnfs-drop');if(d)d.classList.remove('drag-over'); }
function dnfsDrop(e)     { e.preventDefault(); dnfsDragLeave(e); dnfsProcess(e.dataTransfer.files); }
function dnfsOnFiles(e)  { dnfsProcess(e.target.files); }
async function dnfsProcess(fileList) {
if(!fileList||!fileList.length) return;
if(typeof XLSX==='undefined'){dnfsAlert('warn','⚠️ SheetJS não carregado.');return;}
var pw=document.getElementById('dnfs-prog-wrap'),pf=document.getElementById('dnfs-prog-fill');
if(pw)pw.style.display='block';if(pf)pf.style.width='0%';
for(var i=0;i<fileList.length;i++){
if(pf)pf.style.width=Math.round(((i+0.5)/fileList.length)*100)+'%';
await dnfsReadFile(fileList[i]);
if(pf)pf.style.width=Math.round(((i+1)/fileList.length)*100)+'%';
}
setTimeout(function(){if(pw)pw.style.display='none';if(pf)pf.style.width='0%';},600);
var inp=document.getElementById('dnfs-file-input');if(inp)inp.value='';
dnfsRenderPills();
var keys=Object.keys(DNFS.sheets);
if(keys.length){var t=(DNFS.activeSheet&&DNFS.sheets[DNFS.activeSheet])?DNFS.activeSheet:keys[0];dnfsRenderSheetTabs();dnfsSetSheet(t);}
}
function dnfsReadFile(file){
return new Promise(function(resolve){
var reader=new FileReader();
reader.onload=function(e){
try{
var wb=XLSX.read(new Uint8Array(e.target.result),{type:'array',cellDates:true});
wb.SheetNames.forEach(function(sn){
var raw=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false});
if(!raw||raw.length<2)return;
var hRow=0;
for(var r=0;r<Math.min(raw.length,50);r++){
var ne=raw[r].filter(function(c){return c!==''&&c!==null&&c!==undefined&&String(c).trim()!=='';});
if(ne.length>=3){hRow=r;break;}
}
var colIdx=[],cleanH=[];
raw[hRow].forEach(function(h,ci){
var hs=String(h||'').trim();if(!hs)return;
for(var r=hRow+1;r<Math.min(raw.length,hRow+200);r++){
if(raw[r][ci]!==''&&raw[r][ci]!==null&&raw[r][ci]!==undefined){colIdx.push(ci);cleanH.push(hs);return;}
}
});
if(!cleanH.length)return;
var rows=[];
for(var r=hRow+1;r<raw.length;r++){
var row=raw[r];
var hasData=colIdx.some(function(ci){return row[ci]!==''&&row[ci]!==null&&row[ci]!==undefined;});
if(!hasData)continue;
var obj={};colIdx.forEach(function(ci,j){obj[cleanH[j]]=row[ci]!==undefined?row[ci]:'';});
rows.push(obj);
}
if(!rows.length)return;
var key=file.name.replace(/\.[^/.]+$/,'')+' :: '+sn;
DNFS.sheets[key]={headers:cleanH,rows:rows};
dnfsAlert('ok','✅ <b>'+esc(sn)+'</b> ('+esc(file.name)+') — '+rows.length.toLocaleString('pt-BR')+' registros importados.');
});
}catch(err){dnfsAlert('warn','⚠️ Erro ao ler: '+esc(err.message));}
resolve();
};
reader.onerror=function(){dnfsAlert('warn','⚠️ Falha ao ler o arquivo.');resolve();};
reader.readAsArrayBuffer(file);
});
}
function dnfsRenderPills(){
var wrap=document.getElementById('dnfs-pills');if(!wrap)return;
wrap.innerHTML='';
Object.keys(DNFS.sheets).forEach(function(key){
var p=document.createElement('div');p.className='dnfs-pill';
var sk=key.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
p.innerHTML='<span class="dot"></span><span>'+esc(key)+'</span><span class="rm" onclick="dnfsRemove(\''+sk+'\')">&nbsp;✕</span>';
wrap.appendChild(p);
});
}
function dnfsRemove(key){
delete DNFS.sheets[key];if(DNFS.activeSheet===key)DNFS.activeSheet=null;
dnfsRenderPills();dnfsRenderSheetTabs();
var keys=Object.keys(DNFS.sheets);if(keys.length)dnfsSetSheet(keys[0]);else dnfsClearAll();
}
function dnfsRenderSheetTabs(){
var wrap=document.getElementById('dnfs-sheet-sel-wrap'),tabs=document.getElementById('dnfs-sheet-tabs');
if(!tabs)return;
var keys=Object.keys(DNFS.sheets);
if(!keys.length){if(wrap)wrap.style.display='none';return;}
if(wrap)wrap.style.display='block';tabs.innerHTML='';
keys.forEach(function(key){
var btn=document.createElement('button');
btn.className='dnfs-stab'+(key===DNFS.activeSheet?' on':'');
btn.textContent=key;
var sk=key.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
btn.setAttribute('onclick',"dnfsSetSheet('"+sk+"')");
tabs.appendChild(btn);
});
}
function dnfsSetSheet(key){
var entry=DNFS.sheets[key];if(!entry){dnfsAlert('warn','⚠️ Aba não encontrada.');return;}
DNFS.activeSheet=key;DNFS.allHeaders=entry.headers;DNFS.allRows=entry.rows;DNFS.filteredRows=entry.rows.slice();
dnfsRenderSheetTabs();
['dnfs-kpi-wrap','dnfs-charts-wrap','dnfs-tbl-wrap'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='block';});
var em=document.getElementById('dnfs-empty');if(em)em.style.display='none';
dnfsRenderKPIs();dnfsRenderCharts();dnfsRenderTbl(DNFS.filteredRows);
}
function dnfsClearAll(){
Object.keys(DNFS.charts).forEach(function(k){if(DNFS.charts[k]){DNFS.charts[k].destroy();delete DNFS.charts[k];}});
['dnfs-kpi-wrap','dnfs-charts-wrap','dnfs-tbl-wrap','dnfs-sheet-sel-wrap'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
var em=document.getElementById('dnfs-empty');if(em)em.style.display='block';
var p=document.getElementById('dnfs-pills');if(p)p.innerHTML='';
}
function dnfsRenderKPIs() {
var rows=DNFS.allRows, h=DNFS.allHeaders;
if(!rows.length)return;
function setEl(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
rows=rows.filter(function(r){
var valores=Object.values(r).map(function(v){return String(v).trim().toLowerCase();});
var tipoI_Check=h.findIndex(function(c){return String(c).toLowerCase().includes('tipo');});
if(tipoI_Check!==-1){if(String(r[h[tipoI_Check]]||'').trim()==='')return false;}
return valores.join('')!==''&&!valores.includes('total')&&!valores.includes('totais');
});
var pedidoI=dnfsDetCol(h,'pedido'),xmlI=dnfsDetCol(h,'xml'),inclI=dnfsDetCol(h,'incluiunf'),
tipoI=dnfsDetCol(h,'tipoinclusao'),vI=dnfsDetCol(h,'valor'),fI=dnfsDetCol(h,'fornecedor'),
cI=dnfsDetCol(h,'cfop'),tipoDetI=h.findIndex(function(c){return String(c).toLowerCase().includes('tipo');});
var total=rows.length,comPedido=0,semPedido=0,comXml=0,semXml=0,automatica=0,manual=0,hortifrutCount=0,outrosCount=0;
rows.forEach(function(r){
var vTipoRow=tipoDetI!==-1?String(r[h[tipoDetI]]||'').toLowerCase():'';
var isHortiRow=vTipoRow.includes('horti')||vTipoRow.includes('frut');
if(pedidoI!==-1){
var v=String(r[h[pedidoI]]||'').toLowerCase().trim();
var isCom=v.includes('sim')||v.includes('com')||v==='s'||v==='1'||v==='true';
var isSem=v.includes('nao')||v.includes('não')||v.includes('sem')||v==='n'||v==='0';
if(isSem&&!(DNFS_CFG.semPedido_exclHorti&&isHortiRow))semPedido++;
if(isCom&&!(DNFS_CFG.comPedido_exclHorti&&isHortiRow))comPedido++;
}
if(xmlI!==-1){var v=String(r[h[xmlI]]||'').toLowerCase().trim();if(v==='sim'||v==='com'||v.includes('com'))comXml++;else if(v!=='')semXml++;}
var tipoKey=tipoI!==-1?h[tipoI]:(inclI!==-1?h[inclI]:null);
if(tipoKey){
var v=String(r[tipoKey]||'').toLowerCase().trim();
var isAuto=v.includes('auto')||v.includes('xml')||v.includes('sistema')||v.includes('bot');
var isManual=v.includes('manual')||v.includes('operador')||v.includes('usuario');
if(isAuto&&!(DNFS_CFG.autoIncl_exclHorti&&isHortiRow))automatica++;
if(isManual&&!(DNFS_CFG.manualIncl_exclHorti&&isHortiRow))manual++;
}
if(tipoDetI!==-1){if(isHortiRow)hortifrutCount++;else outrosCount++;}
});
if(comPedido===0&&semPedido===0){semPedido=total;}
if(tipoDetI===-1){outrosCount=total;}
var totalComHT=0;
if(tipoDetI!==-1){totalComHT=rows.filter(function(r){return String(r[h[tipoDetI]]||'').trim()!=='';}).length;}
else{totalComHT=total;}
setEl('dnfs-kpi-tot',total.toLocaleString('pt-BR'));
setEl('dnfs-kpi-com-pedido',comPedido.toLocaleString('pt-BR'));
setEl('dnfs-kpi-sem-pedido',semPedido.toLocaleString('pt-BR'));
setEl('dnfs-kpi-automatica',automatica.toLocaleString('pt-BR'));
setEl('dnfs-kpi-manual',manual.toLocaleString('pt-BR'));
setEl('dnfs-kpi-com-ht',totalComHT.toLocaleString('pt-BR'));
setEl('dnfs-kpi-sem-ht',outrosCount.toLocaleString('pt-BR'));
if(vI!==-1){var t=rows.reduce(function(s,r){return s+(parseFloat(String(r[h[vI]]||'').replace(',','.'))||0);},0);setEl('dnfs-kpi-val','R$ '+t.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}));}
if(fI!==-1)setEl('dnfs-kpi-forn',new Set(rows.map(function(r){return String(r[h[fI]]||'').trim();})).size.toLocaleString('pt-BR'));
if(cI!==-1)setEl('dnfs-kpi-cfop',new Set(rows.map(function(r){return String(r[h[cI]]||'').trim();})).size.toLocaleString('pt-BR'));
var periodoV1='';
if(DNFS.allHeaders&&DNFS.allHeaders.length>21){var raw21=String(DNFS.allHeaders[21]||'').trim();if(raw21&&raw21!=='undefined')periodoV1=raw21;}
if(!periodoV1&&DNFS.allHeaders){DNFS.allHeaders.forEach(function(hdr){var s=String(hdr||'').trim();if(!periodoV1&&/\d{2}\/\d{2}\/\d{4}/.test(s))periodoV1=s;});}
if(!periodoV1&&DNFS.allRows&&DNFS.allRows.length>0){Object.keys(DNFS.allRows[0]).forEach(function(k){if(!periodoV1&&/\d{2}\/\d{2}\/\d{4}/.test(k))periodoV1=k;});}
DNFS._periodo=periodoV1;
var badgePer=document.getElementById('dnfs-periodo-badge');
if(badgePer){if(periodoV1){badgePer.textContent='📅 '+periodoV1;badgePer.style.display='inline-flex';}else{badgePer.textContent='';badgePer.style.display='none';}}
var cardPer=document.getElementById('dnfs-periodo-card');
if(cardPer){cardPer.style.display=periodoV1?'flex':'none';var spanPer=document.getElementById('dnfs-periodo-valor');if(spanPer)spanPer.textContent=periodoV1;}
DNFS._kpis={semPedido,comPedido,comXml,semXml,automatica,manual,total,outrosCount,hortifrutCount};
}
function _dnfsKill(id){if(DNFS.charts[id]){DNFS.charts[id].destroy();delete DNFS.charts[id];}}
function _dnfsTog(cId,nId,has){var c=document.getElementById(cId),n=document.getElementById(nId);if(c)c.style.display=has?'block':'none';if(n)n.style.display=has?'none':'block';}
var _DC_TIP={backgroundColor:'#1a2236',borderColor:'#1e2d48',borderWidth:1,titleColor:'#e8edf8',bodyColor:'#8899bb',padding:10};
var _dnfsInsideLabel={id:'dnfsInsideLabel',afterDatasetsDraw:function(chart){var ctx=chart.ctx;var isH=chart.config.options&&chart.config.options.indexAxis==='y';chart.data.datasets.forEach(function(ds,di){var meta=chart.getDatasetMeta(di);if(meta.hidden)return;meta.data.forEach(function(bar,i){var val=ds.data[i];if(!val&&val!==0)return;var label=String(chart.data.labels[i]||'');ctx.save();if(isH){var barW=bar.x-bar.base,cy=bar.y;ctx.font='bold 11px "DM Mono",monospace';var tw=ctx.measureText(label).width;if(barW>tw+20){ctx.fillStyle='#fff';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,bar.base+8,cy);}else{ctx.fillStyle='#e8edf8';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(val,bar.x+6,cy);}ctx.font='bold 12px "DM Mono",monospace';ctx.fillStyle=barW>30?'#fff':'#e8edf8';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(val,bar.x+6,cy);}else{ctx.font='bold 11px "DM Mono",monospace';ctx.fillStyle='#e8edf8';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(val,bar.x,bar.y-4);}ctx.restore();});});}};
var _dnfsPieLabel={id:'dnfsPieLabel',afterDatasetsDraw:function(chart){var ctx=chart.ctx;var meta=chart.getDatasetMeta(0);meta.data.forEach(function(arc,i){var val=chart.data.datasets[0].data[i];if(!val)return;var total=chart.data.datasets[0].data.reduce(function(a,b){return a+b;},0);var pct=Math.round(val/total*100);if(pct<5)return;var mid=(arc.startAngle+arc.endAngle)/2;var r=(arc.outerRadius+arc.innerRadius)/2;var x=arc.x+r*Math.cos(mid),y=arc.y+r*Math.sin(mid);ctx.save();ctx.font='bold 13px Arial';ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(pct+'%',x,y);ctx.restore();});}};
function dnfsRenderCharts(){
var rows=DNFS.allRows,h=DNFS.allHeaders;
if(!rows.length)return;
var kpis=DNFS._kpis||{},inclI=dnfsDetCol(h,'incluiunf'),catI=dnfsDetCol(h,'categoria'),
fornI=dnfsDetCol(h,'fornecedor'),cfopI=dnfsDetCol(h,'cfop'),valorI=dnfsDetCol(h,'valor'),
condI=dnfsDetCol(h,'condpagto'),cargaI=dnfsDetCol(h,'carga'),emisI=dnfsDetCol(h,'emissao');
_dnfsKill('dnfs-ch-pedidos');
var semP=kpis.semPedido||0,comP=kpis.comPedido||0,hasP=(semP+comP)>0;
_dnfsTog('dnfs-ch-pedidos','dnfs-ch-pedidos-nd',hasP);
if(hasP){DNFS.charts['dnfs-ch-pedidos']=new Chart(document.getElementById('dnfs-ch-pedidos').getContext('2d'),{type:'bar',data:{labels:['SEM PEDIDO','COM PEDIDO'],datasets:[{data:[semP,comP],backgroundColor:['#a8c87088','#6ca3e088'],borderColor:['#a8c870','#6ca3e0'],borderWidth:2,borderRadius:6}]},plugins:[_dnfsInsideLabel],options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:Object.assign({},_DC_TIP,{callbacks:{label:function(c){return c.label+': '+c.raw.toLocaleString('pt-BR');}}})},layout:{padding:{top:28}},scales:{x:{ticks:{color:'#8899bb',font:{size:11}},grid:{color:'#1e2d48'}},y:{ticks:{color:'#8899bb',font:{size:10}},grid:{color:'#1e2d48'},suggestedMax:Math.max(semP,comP)*1.3}}}});}
_dnfsKill('dnfs-ch-categorias');
var catData=[];
if(catI!==-1){var cm={};rows.forEach(function(r){var k=String(r[h[catI]]||'N/D').trim();cm[k]=(cm[k]||0)+1;});catData=Object.entries(cm).sort(function(a,b){return b[1]-a[1];}).slice(0,8);}
else{var hort=0,out=0;var tipoI=h.findIndex(function(c){return String(c).toLowerCase().includes('tipo');});if(tipoI!==-1){rows.forEach(function(r){var v=String(r[h[tipoI]]||'').toLowerCase();if(v.includes('horti')||v.includes('frut'))hort++;else out++;});}else{out=rows.length;}catData=[['OUTROS',out],['HORTIFRUT',hort]].filter(function(d){return d[1]>0;});}
_dnfsTog('dnfs-ch-categorias','dnfs-ch-categorias-nd',catData.length>0);
if(catData.length){var catColors=['#4d9fff99','#a8c87099','#a78bfa99','#f5a62399','#ff4d6d99','#00d4aa99','#ffd16699','#06d6a099'];DNFS.charts['dnfs-ch-categorias']=new Chart(document.getElementById('dnfs-ch-categorias').getContext('2d'),{type:'bar',data:{labels:catData.map(function(d){return d[0];}),datasets:[{data:catData.map(function(d){return d[1];}),backgroundColor:catData.map(function(_,i){return catColors[i%catColors.length];}),borderColor:catData.map(function(_,i){return catColors[i%catColors.length].slice(0,-2);}),borderWidth:2,borderRadius:6}]},plugins:[_dnfsInsideLabel],options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:Object.assign({},_DC_TIP)},layout:{padding:{top:28}},scales:{x:{ticks:{color:'#8899bb',font:{size:10}},grid:{color:'#1e2d48'}},y:{ticks:{color:'#8899bb',font:{size:10}},grid:{color:'#1e2d48'},suggestedMax:(catData[0]?catData[0][1]:1)*1.3}}}});}
_dnfsKill('dnfs-ch-xml');
var comXml=0,semXml=0,xmlColI=h.findIndex(function(c){return String(c).toLowerCase().includes('xml');});
if(xmlColI!==-1){rows.forEach(function(r){var v=String(r[h[xmlColI]]||'').toLowerCase().trim();if(v==='sim'||v==='com'||v.includes('com'))comXml++;else if(v!=='')semXml++;});}
else{comXml=kpis.comXml||0;semXml=kpis.semXml||0;}
var hasXml=(comXml+semXml)>0;_dnfsTog('dnfs-ch-xml','dnfs-ch-xml-nd',hasXml);
if(hasXml){var totalXml=comXml+semXml;DNFS.charts['dnfs-ch-xml']=new Chart(document.getElementById('dnfs-ch-xml').getContext('2d'),{type:'doughnut',data:{labels:['COM XML — '+comXml.toLocaleString('pt-BR')+' ('+Math.round(comXml/totalXml*100)+'%)','SEM XML — '+semXml.toLocaleString('pt-BR')+' ('+Math.round(semXml/totalXml*100)+'%)'],datasets:[{data:[comXml,semXml],backgroundColor:['#4d9fff','#ff4d6d'],borderColor:'#0b0f1a',borderWidth:3}]},options:{responsive:true,maintainAspectRatio:true,aspectRatio:1,cutout:'52%',plugins:{legend:{display:true,position:'bottom',labels:{color:'#8899bb',font:{family:"'DM Mono',monospace",size:10},boxWidth:12,padding:10}},tooltip:{callbacks:{label:function(c){return c.label;}}}}}});}
_dnfsKill('dnfs-ch-inclusao');
var auto=kpis.automatica||0,man=kpis.manual||0,hasInc=(auto+man)>0;
_dnfsTog('dnfs-ch-inclusao','dnfs-ch-inclusao-nd',hasInc);
if(hasInc){var totalInc=auto+man;DNFS.charts['dnfs-ch-inclusao']=new Chart(document.getElementById('dnfs-ch-inclusao').getContext('2d'),{type:'doughnut',data:{labels:['Automático — '+auto.toLocaleString('pt-BR')+' ('+Math.round(auto/totalInc*100)+'%)','Manual — '+man.toLocaleString('pt-BR')+' ('+Math.round(man/totalInc*100)+'%)'],datasets:[{data:[auto,man],backgroundColor:['#4d9fff','#ff4d6d'],borderColor:'#0b0f1a',borderWidth:3}]},options:{responsive:true,maintainAspectRatio:true,aspectRatio:1,cutout:'52%',plugins:{legend:{display:true,position:'bottom',labels:{color:'#8899bb',font:{family:"'DM Mono',monospace",size:10},boxWidth:12,padding:10}},tooltip:{callbacks:{label:function(c){return c.label;}}}}}});}
_dnfsKill('dnfs-ch-colab');
var colabData=[];
if(inclI!==-1){
var colMap={};
var tipoIdxColab=h.findIndex(function(c){return String(c).toLowerCase().includes('tipo');});
rows.forEach(function(r){
var nomeColab=String(r[h[inclI]]||'').trim().replace(/\(.*?\)\s*/g,'').trim().toLowerCase();
var vTipo=tipoIdxColab!==-1?String(r[h[tipoIdxColab]]||'').toLowerCase():'';
var isHorti=vTipo.includes('horti')||vTipo.includes('frut');
if(DNFS_CFG.ranking_autoExclHorti&&nomeColab.includes('autom')&&isHorti)return;
var k=String(r[h[inclI]]||'').trim().replace(/\(.*?\)\s*/g,'').trim();
if(!k||k==='0'||k.toLowerCase()==='nan')return;
colMap[k]=(colMap[k]||0)+1;
});
colabData=Object.entries(colMap).sort(function(a,b){return b[1]-a[1];}).slice(0,10);
}
_dnfsTog('dnfs-ch-colab','dnfs-ch-colab-nd',colabData.length>0);
if(colabData.length){
var wrapEl=document.getElementById('dnfs-ch-colab-wrap');if(wrapEl)wrapEl.style.height='260px';
var colabLabels=colabData.map(function(d){var nome=d[0];var match=nome.match(/^\(([^)]+)\)\s*(.*)/);if(match)return['('+match[1]+')',match[2]];return[nome];});
var colabValPlugin={id:'colabVal',afterDatasetsDraw:function(chart2){var ctx2=chart2.ctx;chart2.data.datasets.forEach(function(ds2,di2){var meta2=chart2.getDatasetMeta(di2);if(meta2.hidden)return;meta2.data.forEach(function(bar2,i2){var val2=ds2.data[i2];if(!val2)return;ctx2.save();ctx2.font='bold 11px "DM Mono",monospace';ctx2.fillStyle='#e8edf8';ctx2.textAlign='center';ctx2.textBaseline='bottom';ctx2.fillText(val2.toLocaleString('pt-BR'),bar2.x,bar2.y-3);ctx2.restore();});});}};
DNFS.charts['dnfs-ch-colab']=new Chart(document.getElementById('dnfs-ch-colab').getContext('2d'),{type:'bar',data:{labels:colabLabels,datasets:[{data:colabData.map(function(d){return d[1];}),backgroundColor:'#4d9fff',borderColor:'#4d9fff',borderWidth:1,borderRadius:4}]},plugins:[colabValPlugin],options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:Object.assign({},_DC_TIP,{callbacks:{title:function(items){var lbl=colabLabels[items[0].dataIndex];return Array.isArray(lbl)?lbl.join(' '):lbl;},label:function(c){return 'NFs incluídas: '+c.raw.toLocaleString('pt-BR');}}})},layout:{padding:{top:24,left:4,right:4}},scales:{x:{ticks:{color:'#8899bb',font:{size:9},maxRotation:25,minRotation:0,callback:function(val,idx){var lbl=colabLabels[idx];return Array.isArray(lbl)?lbl:[lbl];}},grid:{display:false}},y:{ticks:{color:'#8899bb',font:{size:10}},grid:{color:'#1e2d48'},suggestedMax:(colabData[0]?colabData[0][1]:1)*1.25}}}});}
_dnfsKill('dnfs-ch-forn');
_dnfsKill('dnfs-ch-cfop');
var cfopData=[];
if(cfopI!==-1){var cm2={};rows.forEach(function(r){var k=String(r[h[cfopI]]||'N/D').trim();cm2[k]=(cm2[k]||0)+1;});cfopData=Object.entries(cm2).sort(function(a,b){return b[1]-a[1];});}
_dnfsTog('dnfs-ch-cfop','dnfs-ch-cfop-nd',cfopData.length>0);
if(cfopData.length){
var cfopLabelPlugin={id:'cfopLabel',afterDatasetsDraw:function(chart){var ctx=chart.ctx;chart.data.datasets.forEach(function(ds,di){var meta=chart.getDatasetMeta(di);if(meta.hidden)return;meta.data.forEach(function(bar,i){var val=ds.data[i];if(!val&&val!==0)return;ctx.save();ctx.font='bold 11px "DM Mono",monospace';ctx.fillStyle='#e8edf8';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(val,bar.x,bar.y-4);ctx.restore();});});}};
DNFS.charts['dnfs-ch-cfop']=new Chart(document.getElementById('dnfs-ch-cfop').getContext('2d'),{type:'bar',data:{labels:cfopData.map(function(d){return d[0];}),datasets:[{data:cfopData.map(function(d){return d[1];}),backgroundColor:'#a78bfa',borderRadius:4,maxBarThickness:35}]},plugins:[cfopLabelPlugin],options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:25}},scales:{x:{grid:{display:false},ticks:{color:'#8899bb',font:{family:"'DM Mono', monospace",size:10}}},y:{display:false,beginAtZero:true,grace:'15%'}},plugins:{legend:{display:false},tooltip:Object.assign({},_DC_TIP)}}});}
_dnfsKill('dnfs-ch-cond');_dnfsKill('dnfs-ch-carga');_dnfsKill('dnfs-ch-emis');
}
function dnfsRenderTbl(rows){
var h=DNFS.allHeaders,thead=document.getElementById('dnfs-thead'),tbody=document.getElementById('dnfs-tbody'),cnt=document.getElementById('dnfs-tbl-count');
if(!thead||!tbody)return;
if(cnt)cnt.textContent=rows.length.toLocaleString('pt-BR')+' registros';
thead.innerHTML='<tr>'+h.map(function(x){return '<th>'+esc(x)+'</th>';}).join('')+'</tr>';
var vI=dnfsDetCol(h,'valor'),cI=dnfsDetCol(h,'cfop'),MAX=300;
tbody.innerHTML=rows.slice(0,MAX).map(function(row){
var cells=h.map(function(hh,i){
var val=row[hh]!==undefined?row[hh]:'',display=String(val);
if(i===vI){var n=parseFloat(String(val).replace(',','.'));if(!isNaN(n))display='R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:2});}
var style=i===vI?'color:var(--accent);font-family:"DM Mono",monospace':i===cI?'color:var(--info);font-family:"DM Mono",monospace':'';
return '<td style="'+style+'">'+(display===''?'<span style="color:var(--muted)">—</span>':esc(display))+'</td>';
}).join('');
return '<tr>'+cells+'</tr>';
}).join('');
if(rows.length>MAX){var tr=document.createElement('tr');tr.innerHTML='<td colspan="'+h.length+'" style="text-align:center;color:var(--muted);padding:10px;font-family:\'DM Mono\',monospace;font-size:.72rem">… mais '+(rows.length-MAX).toLocaleString('pt-BR')+' registros — use o filtro acima</td>';tbody.appendChild(tr);}
}
function dnfsFilterTbl(q){
var ql=(q||'').trim().toLowerCase();
DNFS.filteredRows=ql?DNFS.allRows.filter(function(r){return Object.values(r).some(function(v){return String(v).toLowerCase().includes(ql);});}):DNFS.allRows.slice();
dnfsRenderTbl(DNFS.filteredRows);
}
function dnfsAlert(type,msg){
var area=document.getElementById('dnfs-alerts');if(!area)return;
var d=document.createElement('div');d.className='dnfs-alert '+type;d.innerHTML=msg;area.appendChild(d);
setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d);},6000);
}
// ── CALCULADORA MVA ──
function _mvaParseNum(str){if(!str)return NaN;return parseFloat(String(str).trim().replace(',','.'));}
function calcMVA(){
const cadastroRaw=document.getElementById('mva-cadastro').value;
const mvaRaw=document.getElementById('mva-pct').value;
const resEl=document.getElementById('mva-resultado');
const copyBtn=document.getElementById('mva-copiar-btn');
const validEl=document.getElementById('mva-validacao');
const cadastro=_mvaParseNum(cadastroRaw),mva=_mvaParseNum(mvaRaw);
if(isNaN(cadastro)||isNaN(mva)||cadastroRaw.trim()===''){resEl.value='';resEl.style.color='var(--accent)';resEl.placeholder='Preencha os campos acima…';if(copyBtn)copyBtn.style.display='none';if(validEl)validEl.style.display='none';return;}
const resultado=cadastro-(cadastro*(mva/100));
const resultadoFmt=resultado.toFixed(2).replace('.',',');
resEl.value=resultadoFmt;resEl.style.color=resultado>=0?'var(--accent)':'var(--danger)';
if(copyBtn)copyBtn.style.display='';
if(validEl){const fator=(1-mva/100).toFixed(4).replace('.',',');const reducao=(cadastro*mva/100).toFixed(2).replace('.',',');validEl.style.display='block';validEl.innerHTML=`<span style="color:var(--accent);">${String(cadastro.toFixed(2)).replace('.',',')}</span> − (${String(cadastro.toFixed(2)).replace('.',',')} × ${String(mva).replace('.',',')}%) = <strong style="color:var(--accent);">${resultadoFmt}</strong>&nbsp;&nbsp;·&nbsp;&nbsp;Redução: <span style="color:var(--warn);">−${reducao}</span>&nbsp;&nbsp;·&nbsp;&nbsp;Fator: <span style="color:var(--info);">× ${fator}</span>`;}
}
function mvacopiar(btn){const val=document.getElementById('mva-resultado').value;if(!val)return;navigator.clipboard.writeText(val).then(()=>{btn.textContent='Copiado!';btn.classList.add('ok');setTimeout(()=>{btn.textContent='Copiar';btn.classList.remove('ok');},1500);toast('✓ Resultado copiado!');}).catch(()=>{try{const ta=document.createElement('textarea');ta.value=val;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);btn.textContent='Copiado!';btn.classList.add('ok');setTimeout(()=>{btn.textContent='Copiar';btn.classList.remove('ok');},1500);toast('✓ Resultado copiado!');}catch(e){toast('Não foi possível copiar automaticamente. Selecione e copie manualmente.',true);}});}
function mvaLimpar(){document.getElementById('mva-cadastro').value='';document.getElementById('mva-pct').value='33,5';document.getElementById('mva-resultado').value='';document.getElementById('mva-resultado').placeholder='Preencha os campos acima…';const copyBtn=document.getElementById('mva-copiar-btn');if(copyBtn)copyBtn.style.display='none';const validEl=document.getElementById('mva-validacao');if(validEl)validEl.style.display='none';document.getElementById('mva-cadastro').focus();}
// ── CÁLCULO DIRETO (Redução Fixa) — ICMS + FECP sobre base já reduzida ──
function _fmtBRL(n){if(isNaN(n))n=0;return 'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function calcReducaoDireta(){
const valorProduto=_mvaParseNum(document.getElementById('red-valor').value)||0;
const pctReducao=_mvaParseNum(document.getElementById('red-pct').value)||0;
const pctIcms=_mvaParseNum(document.getElementById('red-icms').value)||0;
const pctFecp=_mvaParseNum(document.getElementById('red-fecp').value)||0;
const valorReducao=valorProduto*(pctReducao/100);
const baseReduzida=valorProduto-valorReducao;
const valorIcms=baseReduzida*(pctIcms/100);
const valorFecp=baseReduzida*(pctFecp/100);
const total=valorIcms+valorFecp;
document.getElementById('red-out-valor').textContent=_fmtBRL(valorProduto);
document.getElementById('red-out-reducao').textContent=_fmtBRL(valorReducao);
document.getElementById('red-out-base').textContent=_fmtBRL(baseReduzida);
document.getElementById('red-out-icms').textContent=_fmtBRL(valorIcms);
document.getElementById('red-out-fecp').textContent=_fmtBRL(valorFecp);
document.getElementById('red-out-total').textContent=_fmtBRL(total);
}
// ── EXPORTAR PDF DASHBOARD NFS ─
async function exportarDashNfsPdf() {
if(!DNFS.activeSheet||!DNFS.sheets[DNFS.activeSheet]){toast('Importe uma planilha primeiro!',true);return;}
const btn=document.querySelector('button[onclick="exportarDashNfsPdf()"]');
const orig=btn?btn.textContent:'';
if(btn){btn.textContent=' Gerando PDF...';btn.disabled=true;}
toast('⏳ Gerando PDF, aguarde...');
try{
const{jsPDF}=window.jspdf;
const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
const pw=277,ph=190;
function canvasImg(id){const c=document.getElementById(id);if(!c||!c.width||!c.height)return null;try{return c.toDataURL('image/png',1.0);}catch(e){return null;}}
function bgPage(){pdf.setFillColor(11,15,26);pdf.rect(0,0,pw+20,ph+20,'F');}
function pdfHeader(){const periodo=DNFS._periodo||'';pdf.setFontSize(14);pdf.setTextColor(0,212,170);pdf.setFont('helvetica','bold');pdf.text('Dashboard NFS',10,10);pdf.setFontSize(7.5);pdf.setTextColor(107,122,153);pdf.setFont('helvetica','normal');pdf.text('Gerado em: '+new Date().toLocaleString('pt-BR'),10,16);if(periodo){const bx=pw-70,by=5,bw=68,bh=14;pdf.setFillColor(20,35,60);pdf.roundedRect(bx,by,bw,bh,3,3,'F');pdf.setDrawColor(77,159,255);pdf.setLineWidth(0.4);pdf.roundedRect(bx,by,bw,bh,3,3,'S');pdf.setLineWidth(0.2);pdf.setFontSize(6.5);pdf.setTextColor(107,153,220);pdf.setFont('helvetica','bold');pdf.text('PERÍODO DA PLANILHA',bx+bw/2,by+4.5,{align:'center'});pdf.setFontSize(8.5);pdf.setTextColor(200,220,255);pdf.setFont('helvetica','bold');pdf.text(periodo,bx+bw/2,by+10.5,{align:'center'});}}
function drawCard(id,titulo,x,y,w,h){pdf.setFillColor(21,30,48);pdf.roundedRect(x,y,w,h,3,3,'F');pdf.setDrawColor(30,45,72);pdf.setLineWidth(0.3);pdf.roundedRect(x,y,w,h,3,3,'S');pdf.setLineWidth(0.2);pdf.setFontSize(7.5);pdf.setTextColor(0,212,170);pdf.setFont('helvetica','bold');pdf.text(titulo.toUpperCase(),x+4,y+6.5);pdf.setDrawColor(0,212,170);pdf.setLineWidth(0.3);pdf.line(x+4,y+8,x+w-4,y+8);pdf.setLineWidth(0.2);pdf.setDrawColor(30,45,72);const img=canvasImg(id);if(img){const c=document.getElementById(id);const physW=c?c.width:1,physH=c?c.height:1,ratio=physW/physH,imgW=w-8,imgH=Math.min(h-13,imgW/ratio),imgY=y+10+((h-13-imgH)/2);pdf.addImage(img,'PNG',x+4,imgY,imgW,imgH,'','NONE');}else{pdf.setFontSize(8);pdf.setTextColor(107,122,153);pdf.text('Sem dados',x+w/2,y+h/2,{align:'center'});}}
function drawDonutCard(id,titulo,labels,colors,x,y,w,h){pdf.setFillColor(21,30,48);pdf.roundedRect(x,y,w,h,3,3,'F');pdf.setDrawColor(30,45,72);pdf.setLineWidth(0.3);pdf.roundedRect(x,y,w,h,3,3,'S');pdf.setLineWidth(0.2);pdf.setDrawColor(30,45,72);pdf.setFontSize(7.5);pdf.setTextColor(0,212,170);pdf.setFont('helvetica','bold');pdf.text(titulo.toUpperCase(),x+4,y+6.5);pdf.setDrawColor(0,212,170);pdf.setLineWidth(0.3);pdf.line(x+4,y+8,x+w-4,y+8);pdf.setLineWidth(0.2);pdf.setDrawColor(30,45,72);const legendH=labels.length*8.5+5,chartH=h-13-legendH;const img=canvasImg(id);if(img){const c=document.getElementById(id);const sz=Math.min(w-16,chartH),imgX=x+(w-sz)/2,imgY=y+10+(chartH-sz)/2;pdf.addImage(img,'PNG',imgX,imgY,sz,sz,'','NONE');}const legY0=y+h-legendH+3;labels.forEach(function(lbl,i){const rgb=hexToRgb(colors[i]||'#888'),legY=legY0+i*8.5;pdf.setFillColor(rgb.r,rgb.g,rgb.b);pdf.roundedRect(x+6,legY,4,4,1,1,'F');pdf.setFontSize(7.2);pdf.setTextColor(180,200,220);pdf.setFont('helvetica','normal');pdf.text(lbl,x+13,legY+3.2);});}
const kpiIds=[{id:'dnfs-kpi-sem-pedido',lbl:'NFs Sem Pedido',cor:'#00d4aa'},{id:'dnfs-kpi-com-pedido',lbl:'NFs Com Pedido',cor:'#4d9fff'},{id:'dnfs-kpi-com-ht',lbl:'Inclusão Com HT',cor:'#a78bfa'},{id:'dnfs-kpi-automatica',lbl:'Incl. Automática',cor:'#00d4aa'},{id:'dnfs-kpi-manual',lbl:'Inclusão Manual',cor:'#f5a623'},{id:'dnfs-kpi-sem-ht',lbl:'Inclusão Sem HT',cor:'#ff4d6d'}];
function getLegendaXml(){const kpis=DNFS._kpis||{},com=kpis.comXml||0,sem=kpis.semXml||0,tot=com+sem,pCom=tot>0?Math.round(com/tot*100):0,pSem=tot>0?Math.round(sem/tot*100):0;return['COM XML — '+com.toLocaleString('pt-BR')+' ('+pCom+'%)','SEM XML — '+sem.toLocaleString('pt-BR')+' ('+pSem+'%)'];}
function getLegendaInclusao(){const kpis=DNFS._kpis||{},aut=kpis.automatica||0,man=kpis.manual||0,tot=aut+man,pAut=tot>0?Math.round(aut/tot*100):0,pMan=tot>0?Math.round(man/tot*100):0;return['Automático — '+aut.toLocaleString('pt-BR')+' ('+pAut+'%)','Manual — '+man.toLocaleString('pt-BR')+' ('+pMan+'%)'];}
const headerH=20,kpiW=42,kpiH=28,kpiY=headerH+2,kpiGap=3;
bgPage();pdfHeader();
kpiIds.forEach(function(k,i){const x=10+i*(kpiW+kpiGap),val=document.getElementById(k.id)?document.getElementById(k.id).textContent:'—',rgb=hexToRgb(k.cor);pdf.setFillColor(21,30,48);pdf.roundedRect(x,kpiY,kpiW,kpiH,3,3,'F');pdf.setFillColor(rgb.r,rgb.g,rgb.b);pdf.rect(x,kpiY,kpiW,2.5,'F');pdf.setFontSize(18);pdf.setTextColor(rgb.r,rgb.g,rgb.b);pdf.setFont('helvetica','bold');pdf.text(val,x+kpiW/2,kpiY+14,{align:'center'});pdf.setFontSize(5.8);pdf.setTextColor(107,122,153);pdf.setFont('helvetica','normal');pdf.text(pdf.splitTextToSize(k.lbl.toUpperCase(),kpiW-4),x+kpiW/2,kpiY+20.5,{align:'center'});});
const barY=kpiY+kpiH+5,barH=Math.round((ph-barY-8)*0.50),cfopY=barY+barH+5,cfopH=Math.round((ph-barY-8)*0.50),barW=(pw-24)/2,cfopW=barW*2+4;
drawCard('dnfs-ch-pedidos','Total C/Pedidos S/ Pedidos',10,barY,barW,barH);
drawCard('dnfs-ch-categorias','Total de Pedidos por Categoria',14+barW,barY,barW,barH);
drawCard('dnfs-ch-cfop','Notas por CFOP',10,cfopY,cfopW,cfopH);
pdf.addPage();bgPage();pdfHeader();
const r2Y=headerH+1,donutH=90,donutW=(pw-24)/2;
drawDonutCard('dnfs-ch-xml','Pedidos com e sem XML',getLegendaXml(),['#4d9fff','#ff4d6d'],10,r2Y,donutW,donutH);
drawDonutCard('dnfs-ch-inclusao','Inclusão de NFs (Auto x Manual)',getLegendaInclusao(),['#4d9fff','#ff4d6d'],14+donutW,r2Y,donutW,donutH);
const colabY2=r2Y+donutH+4;drawCard('dnfs-ch-colab','Ranking 10 Mais — Colaboradores por Inclusão de NFs',10,colabY2,pw-10,ph-colabY2-4);
_salvarPdfCompativel(pdf, 'Dashboard_NFS_'+new Date().toISOString().slice(0,10)+'.pdf');
toast('✓ PDF gerado com sucesso!');
}catch(err){console.error(err);toast('Erro ao gerar PDF: '+err.message,true);}
finally{if(btn){btn.textContent=orig;btn.disabled=false;}}
}
function mostrarAlertasVencimento(lista) {
const hoje = new Date(); hoje.setHours(0,0,0,0);
let vencidas = [], proximas = [];
lista.forEach(function(r) {
if (!r.vencimento || String(r.vencimento).trim() === '') return;
if (r.situacao === 'Lançada') return;
const vencStr = String(r.vencimento).trim().split('T')[0];
let vencDate = null;
if (vencStr.includes('/')) { const p = vencStr.split('/'); if (p.length === 3) vencDate = new Date(Number(p[2]), Number(p[1])-1, Number(p[0])); }
else if (vencStr.includes('-')) { const p = vencStr.split('-'); if (p.length === 3) vencDate = new Date(Number(p[0]), Number(p[1])-1, Number(p[2])); }
if (!vencDate || isNaN(vencDate.getTime())) return;
vencDate.setHours(0,0,0,0);
const diffDays = Math.ceil((vencDate - hoje) / 86400000);
if (diffDays < 0) vencidas.push({ danf: r.danf, dias: Math.abs(diffDays), fornecedor: r.fornecedor });
else if (diffDays <= 7) proximas.push({ danf: r.danf, dias: diffDays, fornecedor: r.fornecedor });
});
if (!vencidas.length && !proximas.length) return;
const existing = document.getElementById('venc-alert-box');
if (existing) existing.remove();
const box = document.createElement('div');
box.id = 'venc-alert-box';
box.style.cssText = 'position:fixed;top:24px;right:24px;z-index:9997;display:flex;flex-direction:column;gap:8px;max-width:370px;pointer-events:none';
if (vencidas.length > 0) {
const el = document.createElement('div');
el.style.cssText = 'background:#3a1f1f;border:1px solid #ff4d6d;border-left:4px solid #ff4d6d;border-radius:12px;padding:12px 16px;font-family:"DM Mono",monospace;font-size:.78rem;color:#ffb3be;line-height:1.6;animation:slideInRight .3s ease both;pointer-events:auto;box-shadow:0 8px 24px #00000060';
const nfList = vencidas.slice(0, 3).map(v => `NF <strong style="color:#ff4d6d">${esc(v.danf)}</strong> — <span style="color:#ff9aaa">${v.dias} dia${v.dias!==1?'s':''} vencida</span>`).join('<br>');
const extra = vencidas.length > 3 ? `<br><span style="color:#ff4d6d;font-weight:700">+ ${vencidas.length - 3} outra(s)...</span>` : '';
el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:1.1rem"></span><strong style="color:#ff4d6d;font-size:.82rem;letter-spacing:.5px">${vencidas.length} NF${vencidas.length>1?'S':''} VENCIDA${vencidas.length>1?'S':''}</strong></div>${nfList}${extra}`;
box.appendChild(el);
}
if (proximas.length > 0) {
const el = document.createElement('div');
el.style.cssText = 'background:#3a2f1f;border:1px solid #f5a623;border-left:4px solid #f5a623;border-radius:12px;padding:12px 16px;font-family:"DM Mono",monospace;font-size:.78rem;color:#ffd9a0;line-height:1.6;animation:slideInRight .35s .05s ease both;pointer-events:auto;box-shadow:0 8px 24px #00000060';
const nfList = proximas.slice(0, 3).map(v => { const label = v.dias===0?'<span style="color:#f5a623;font-weight:700">VENCE HOJE</span>':`<span style="color:#ffd9a0">${v.dias} dia${v.dias!==1?'s':''} para vencer</span>`; return `NF <strong style="color:#f5a623">${esc(v.danf)}</strong> — ${label}`; }).join('<br>');
const extra = proximas.length > 3 ? `<br><span style="color:#f5a623;font-weight:700">+ ${proximas.length - 3} outra(s)...</span>` : '';
el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:1.1rem">🟠</span><strong style="color:#f5a623;font-size:.82rem;letter-spacing:.5px">${proximas.length} NF${proximas.length>1?'S':''} PRÓXIMA${proximas.length>1?'S':''} DO VENCIMENTO</strong></div>${nfList}${extra}`;
box.appendChild(el);
}
if (!document.getElementById('venc-keyframes')) {
const style = document.createElement('style'); style.id = 'venc-keyframes';
style.textContent = '@keyframes slideInRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}@keyframes fadeOutRight{from{opacity:1;transform:none}to{opacity:0;transform:translateX(30px)}}';
document.head.appendChild(style);
}
document.body.appendChild(box);
setTimeout(function() {
Array.from(box.children).forEach(function(child, i) { child.style.animation = `fadeOutRight .35s ${i*0.05}s ease both`; });
setTimeout(function() { if (box.parentNode) box.remove(); }, 700);
}, 6000);
}
function renderGruposLoja() {
const wrap = document.getElementById('grupos-loja-lista');
if (!wrap) return;
if (!DB.gruposLoja.length) { wrap.innerHTML = '<div class="nd">Nenhum grupo cadastrado.</div>'; return; }
wrap.innerHTML = DB.gruposLoja.map(g => {
const lojasSelecionadas = g.lojas ? g.lojas.split(',').map(x => x.trim()).filter(Boolean) : [];
const checkboxes = DB.lojas.map(l => {
const checked = lojasSelecionadas.includes(l.nome) ? 'checked' : '';
return `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-family:'DM Mono',monospace;font-size:.76rem;color:var(--text);padding:4px 0;user-select:none">
<input type="checkbox" data-grupo-id="${g.id}" data-loja="${esc(l.nome)}" ${checked}
style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;flex-shrink:0">
${esc(l.nome)}
</label>`;
}).join('');
return `<div style="background:var(--inp);border:1px solid var(--inpb);border-radius:var(--r2);padding:16px 18px">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:10px;flex-wrap:wrap">
<div style="display:flex;align-items:center;gap:10px;flex:1">
<span style="font-family:'DM Mono',monospace;font-size:.68rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted)">Grupo</span>
<input type="text" id="ng-edit-${g.id}" value="${esc(g.grupo)}" oninput="this.value=this.value.toUpperCase()"
style="background:var(--bg2,#0d1525);border:1px solid var(--inpb);border-radius:var(--r);color:var(--text);font-family:'DM Mono',monospace;font-size:.85rem;padding:6px 12px;outline:none;width:200px">
</div>
<div style="display:flex;gap:8px">
<button class="btn btn-p btn-sm" onclick="salvarGrupoLoja(${g.id})"> Salvar</button>
<button class="btn btn-d btn-sm" onclick="confirmDel('grupoLoja',${g.id},'grupo ${esc(g.grupo)}')">🗑</button>
</div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:4px 16px">${checkboxes}</div>
</div>`;
}).join('');
}
function addGrupoLoja() {
const nome = (document.getElementById('ng-nome')?.value || '').trim();
if (!nome) { toast('Informe o nome do grupo!', true); return; }
const btn = document.querySelector('#ng-nome').closest('.g2')?.querySelector('.btn-p');
if (btn) { btn.textContent = '⏳ Salvando…'; btn.disabled = true; }
google.script.run
.withSuccessHandler(r => {
if (btn) { btn.textContent = '+ Adicionar Grupo'; btn.disabled = false; }
if (r.ok) {
DB.gruposLoja.push({ id: r.id, grupo: nome, lojas: '' });
document.getElementById('ng-nome').value = '';
renderGruposLoja(); popHistFiltros();
toast('✓ Grupo criado!');
} else toast('Erro ao criar grupo!', true);
})
.withFailureHandler(e => {
if (btn) { btn.textContent = '+ Adicionar Grupo'; btn.disabled = false; }
toast('Falha: ' + e.message, true);
})
.saveGrupoLoja({ id: 0, grupo: nome, lojas: '' });
}
function salvarGrupoLoja(id) {
const nomeEl = document.getElementById('ng-edit-' + id);
const nome = nomeEl ? nomeEl.value.trim() : '';
if (!nome) { toast('Informe o nome do grupo!', true); return; }
const checkboxes = document.querySelectorAll(`input[data-grupo-id="${id}"]`);
const lojasMarcadas = Array.from(checkboxes).filter(c => c.checked).map(c => c.dataset.loja).join(',');
google.script.run
.withSuccessHandler(r => {
if (r.ok) {
const idx = DB.gruposLoja.findIndex(g => g.id === id);
if (idx >= 0) { DB.gruposLoja[idx].grupo = nome; DB.gruposLoja[idx].lojas = lojasMarcadas; }
renderGruposLoja(); popHistFiltros();
const ind = document.getElementById('grupos-loja-saved-ind');
if (ind) { ind.textContent = '✓ Grupo salvo!'; ind.classList.add('show'); setTimeout(() => ind.classList.remove('show'), 3000); }
toast('✓ Grupo salvo!');
} else toast('Erro ao salvar!', true);
})
.withFailureHandler(e => toast('Falha: ' + e.message, true))
.saveGrupoLoja({ id, grupo: nome, lojas: lojasMarcadas });
}
function hexToRgb(hex){const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:{r:0,g:212,b:170};}
function histCarregarMais() {
    const btn = document.getElementById('btn-hist-carregar-mais');
    if (btn) {
        btn.textContent = '⏳ Carregando...';
        btn.disabled = true;
    }
    
    // Pega os próximos 100 registros a partir do tamanho atual de DB.historico
    const atuais = DB.historico.length;
    const proximos = _histCompleto.slice(atuais, atuais + 100);
    
    if (proximos.length > 0) {
        // Adiciona os novos registros à lista visível instantaneamente (sem consulta ao banco)
        DB.historico = DB.historico.concat(proximos);
        filtrarHist(); // Atualiza a tabela na tela
        
        // Se ainda houver mais registros, mantém o botão, senão esconde
        if (DB.historico.length >= _histCompleto.length) {
            if (btn) {
                btn.textContent = '✓ Todos os registros carregados';
                setTimeout(() => { btn.style.display = 'none'; }, 1500);
            }
        } else {
            if (btn) {
                btn.textContent = `📥 Carregar Mais (100 registros)`;
                btn.disabled = false;
            }
        }
    }
}
