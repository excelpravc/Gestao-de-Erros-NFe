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
