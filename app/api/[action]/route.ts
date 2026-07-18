import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

// Helpers
const getCol = (base: string, perfil: string) => {
  const p = String(perfil || '').toLowerCase();
  if (['compradores', 'erros', 'historico'].includes(base)) {
    return p === 'matriz' ? `${base}_matriz` : `${base}_lojas`;
  }
  return base;
};

const fmtDate = (v: any) => {
  if (!v) return '';
  if (v.toDate) v = v.toDate();
  if (v instanceof Date) {
    return `${String(v.getDate()).padStart(2,'0')}/${String(v.getMonth()+1).padStart(2,'0')}/${v.getFullYear()}`;
  }
  return String(v);
};

const getNextId = async (colName: string) => {
  const snap = await db.collection(colName).orderBy('id', 'desc').limit(1).get();
  if (snap.empty) return 1;
  return (snap.docs[0].data().id || 0) + 1;
};

export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  const action = params.action;
  const body = await req.json();
  const { args, perfil } = body;

  try {
    // ==================== LOAD ALL ====================
    if (action === 'loadAll') {
      const colComp = getCol('compradores', perfil);
      const colErros = getCol('erros', perfil);
      
      const getSimple = async (col: string) => {
        const s = await db.collection(col).orderBy('id').get();
        return s.docs.map(d => ({ id: d.data().id, nome: d.data().nome || d.data().f1 || '', email: d.data().email || d.data().f2 || '' }));
      };
      const getErros = async (col: string) => {
        const s = await db.collection(col).orderBy('id').get();
        return s.docs.map(d => ({ id: d.data().id, codigo: d.data().codigo || d.data().f1 || '', descricao: d.data().descricao || d.data().f2 || '' }));
      };
      const getForn = async () => {
        const s = await db.collection('fornecedores').orderBy('id').get();
        return s.docs.map(d => ({ id: d.data().id, codigo: d.data().codigo || d.data().f1 || '', nome: d.data().nome || d.data().f2 || '' }));
      };

      const [compradores, comerciais, lojas, manifestos, codErros, fornecedores, regras, justificativas, gruposLoja] = await Promise.all([
        getSimple(colComp), getSimple('comerciais'), getSimple('lojas'), getSimple('manifestos'),
        getErros(colErros), getForn(),
        (async () => { const s = await db.collection('regras').get(); return s.docs.map(d => d.data()); })(),
        (async () => { const s = await db.collection('justificativas').get(); return s.docs.map(d => d.data()); })(),
        (async () => { const s = await db.collection('grupos_loja').get(); return s.docs.map(d => d.data()); })()
      ]);

      return NextResponse.json({ compradores, comerciais, lojas, manifestos, codErros, fornecedores, historico: [], regras, justificativas, gruposLoja, assinatura: {} });
    }

    // ==================== HISTÓRICO ====================
    if (action === 'loadHistFiltrado') {
      const [de, ate] = args;
      const colHist = getCol('historico', perfil);
      let q = db.collection(colHist);
      
      if (de) q = q.where('dataISO', '>=', de);
      if (ate) q = q.where('dataISO', '<=', ate + 'T23:59:59');
      
      const snap = await q.orderBy('dataISO').get();
      const lista = snap.docs.map(d => {
        const data = d.data();
        return {
          id: data.id, data: fmtDate(data.dataISO), danf: data.danf, fornecedor: data.fornecedor,
          codErro: data.codErro, erroDesc: data.erroDesc, comprador: data.comprador, emailComprador: data.emailComprador,
          comercial: data.comercial, emailComercial: data.emailComercial, loja: data.loja, emailLoja: data.emailLoja,
          manifesto: data.manifesto, emailManifesto: data.emailManifesto, para: data.para, status: data.status,
          situacao: data.situacao, hora: data.hora, vencimento: data.vencimento
        };
      });
      return NextResponse.json(lista);
    }

    if (action === 'addHistorico') {
      const d = args[0];
      const colHist = getCol('historico', perfil);
      const id = await getNextId(colHist);
      const hoje = new Date().toLocaleDateString('pt-BR');
      const hojeISO = new Date().toISOString().split('T')[0];
      const hora = d.hora || new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
      
      let vencimentoStr = '';
      if (d.vencimento) {
        const p = String(d.vencimento).split('T')[0].split('-');
        if (p.length === 3) vencimentoStr = `${p[2]}/${p[1]}/${p[0]}`;
      }

      await db.collection(colHist).doc(String(id)).set({
        id, dataISO: hojeISO, data: hoje, hora, danf: d.danf, fornecedor: d.fornecedor,
        codErro: d.codErro, erroDesc: d.erroDesc, comprador: d.comprador, emailComprador: d.emailComprador,
        comercial: d.comercial, emailComercial: d.emailComercial, loja: d.loja, emailLoja: d.emailLoja,
        manifesto: d.manifesto, emailManifesto: d.emailManifesto, para: d.para, status: d.status,
        situacao: d.situacao || 'Pendente', vencimento: vencimentoStr
      });
      return NextResponse.json({ ok: true, id });
    }

    if (action === 'updateHistorico') {
      const d = args[0];
      const colHist = getCol('historico', perfil);
      const snap = await db.collection(colHist).where('id', '==', Number(d.id)).limit(1).get();
      if (snap.empty) return NextResponse.json({ ok: false });
      
      let vencimentoStr = '';
      if (d.vencimento) {
        const p = String(d.vencimento).split('T')[0].split('-');
        if (p.length === 3) vencimentoStr = `${p[2]}/${p[1]}/${p[0]}`;
      }

      await snap.docs[0].ref.update({
        danf: d.danf, fornecedor: d.fornecedor, codErro: d.codErro, erroDesc: d.erroDesc,
        comprador: d.comprador, emailComprador: d.emailComprador, comercial: d.comercial, emailComercial: d.emailComercial,
        loja: d.loja, emailLoja: d.emailLoja, manifesto: d.manifesto, emailManifesto: d.emailManifesto,
        para: d.para, status: d.status, situacao: d.situacao || 'Pendente', vencimento: vencimentoStr
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'deleteHistorico') {
      const [id] = args;
      const colHist = getCol('historico', perfil);
      const snap = await db.collection(colHist).where('id', '==', Number(id)).limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.delete();
      return NextResponse.json({ ok: true });
    }

    if (action === 'updateHistoricoSituacaoPorDANF') {
      const [danf, loja, perf] = args;
      const colHist = getCol('historico', perf || perfil);
      let q = db.collection(colHist).where('danf', '==', String(danf).trim());
      if (loja) q = q.where('loja', '==', String(loja).trim());
      
      const snap = await q.get();
      const batch = db.batch();
      snap.docs.forEach(doc => batch.update(doc.ref, { situacao: 'Lançada' }));
      await batch.commit();
      return NextResponse.json({ ok: true, totalMarcadas: snap.size });
    }

    // ==================== CRUD GENÉRICO ====================
    if (['addComprador', 'addComercial', 'addLoja', 'addManifesto', 'addCodErro', 'addFornecedor'].includes(action)) {
      const d = args[0];
      let colName = '';
      if (action.includes('Comprador')) colName = getCol('compradores', d.perfil || perfil);
      else if (action.includes('Comercial')) colName = 'comerciais';
      else if (action.includes('Loja')) colName = 'lojas';
      else if (action.includes('Manifesto')) colName = 'manifestos';
      else if (action.includes('CodErro')) colName = getCol('erros', d.perfil || perfil);
      else if (action.includes('Fornecedor')) colName = 'fornecedores';

      const id = await getNextId(colName);
      const f1 = d.nome || d.codigo || d.f1 || '';
      const f2 = d.email || d.descricao || d.f2 || '';
      
      await db.collection(colName).doc(String(id)).set({ id, nome: f1, email: f2, codigo: f1, descricao: f2, f1, f2 });
      return NextResponse.json({ ok: true, id });
    }

    if (['updateComprador', 'updateComercial', 'updateLoja', 'updateManifesto', 'updateCodErro', 'updateFornecedor'].includes(action)) {
      const d = args[0];
      let colName = '';
      if (action.includes('Comprador')) colName = getCol('compradores', d.perfil || perfil);
      else if (action.includes('Comercial')) colName = 'comerciais';
      else if (action.includes('Loja')) colName = 'lojas';
      else if (action.includes('Manifesto')) colName = 'manifestos';
      else if (action.includes('CodErro')) colName = getCol('erros', d.perfil || perfil);
      else if (action.includes('Fornecedor')) colName = 'fornecedores';

      const snap = await db.collection(colName).where('id', '==', Number(d.id)).limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.update({ f1: d.f1, f2: d.f2, nome: d.f1, email: d.f2, codigo: d.f1, descricao: d.f2 });
      return NextResponse.json({ ok: true });
    }

    if (['deleteComprador', 'deleteComercial', 'deleteLoja', 'deleteManifesto', 'deleteCodErro', 'deleteFornecedor'].includes(action)) {
      const [id, perf] = args;
      let colName = '';
      if (action.includes('Comprador')) colName = getCol('compradores', perf || perfil);
      else if (action.includes('Comercial')) colName = 'comerciais';
      else if (action.includes('Loja')) colName = 'lojas';
      else if (action.includes('Manifesto')) colName = 'manifestos';
      else if (action.includes('CodErro')) colName = getCol('erros', perf || perfil);
      else if (action.includes('Fornecedor')) colName = 'fornecedores';

      const snap = await db.collection(colName).where('id', '==', Number(id)).limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.delete();
      return NextResponse.json({ ok: true });
    }

    // ==================== REGRAS, JUSTIFICATIVAS, GRUPOS ====================
    if (action === 'saveAllRegras') {
      const regrasArray = args[0];
      let saved = 0;
      for (const r of regrasArray) {
        const snap = await db.collection('regras').where('codErro', '==', r.codErro).where('descErro', '==', r.descErro).limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.update({ destinatarios: r.destinatarios, criadoEm: new Date().toLocaleDateString('pt-BR') });
        } else {
          const id = await getNextId('regras');
          await db.collection('regras').doc(String(id)).set({ id, codErro: r.codErro, descErro: r.descErro, destinatarios: r.destinatarios, criadoEm: new Date().toLocaleDateString('pt-BR') });
        }
        saved++;
      }
      return NextResponse.json({ ok: true, saved });
    }
    
    if (action === 'deleteRegra') {
      const [id] = args;
      const snap = await db.collection('regras').where('id', '==', Number(id)).limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.delete();
      return NextResponse.json({ ok: true });
    }

    if (action === 'addJustificativa') {
      const id = await getNextId('justificativas');
      await db.collection('justificativas').doc(String(id)).set({ id, texto: args[0].texto });
      return NextResponse.json({ ok: true, id });
    }
    if (action === 'updateJustificativa') {
      const snap = await db.collection('justificativas').where('id', '==', Number(args[0].id)).limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.update({ texto: args[0].texto });
      return NextResponse.json({ ok: true });
    }
    if (action === 'deleteJustificativa') {
      const snap = await db.collection('justificativas').where('id', '==', Number(args[0])).limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.delete();
      return NextResponse.json({ ok: true });
    }

    if (action === 'saveGrupoLoja') {
      const d = args[0];
      if (d.id) {
        const snap = await db.collection('grupos_loja').where('id', '==', Number(d.id)).limit(1).get();
        if (!snap.empty) await snap.docs[0].ref.update({ grupo: d.grupo, lojas: d.lojas });
      } else {
        const id = await getNextId('grupos_loja');
        await db.collection('grupos_loja').doc(String(id)).set({ id, grupo: d.grupo, lojas: d.lojas });
        return NextResponse.json({ ok: true, id });
      }
      return NextResponse.json({ ok: true });
    }
    if (action === 'deleteGrupoLoja') {
      const snap = await db.collection('grupos_loja').where('id', '==', Number(args[0])).limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.delete();
      return NextResponse.json({ ok: true });
    }

    // ==================== CONFIG & SENHA ====================
    if (action === 'loadAssinatura') {
      const doc = await db.collection('assinaturas').doc(String(args[0])).get();
      return NextResponse.json(doc.exists ? doc.data() : { nome:'', tel:'', cargo:'', emailCfg:'' });
    }
    if (action === 'saveAssinatura') {
      await db.collection('assinaturas').doc(String(args[1])).set(args[0], { merge: true });
      return NextResponse.json({ ok: true });
    }
    if (action === 'loadSenhaSistema') {
      const doc = await db.collection('config').doc('system').get();
      return NextResponse.json(doc.exists ? doc.data().senhaEdicao : '@MANIFESTO');
    }
    if (action === 'saveSenhaSistema') {
      const doc = await db.collection('config').doc('system').get();
      const atual = doc.exists ? doc.data().senhaEdicao : '@MANIFESTO';
      if (args[0] !== atual) return NextResponse.json({ ok: false, msg: 'Senha atual incorreta' });
      await db.collection('config').doc('system').set({ senhaEdicao: args[1] });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação não encontrada', ok: false }, { status: 404 });
  } catch (error: any) {
    console.error(`[API ${action}]`, error);
    return NextResponse.json({ error: error.message, ok: false }, { status: 500 });
  }
}
