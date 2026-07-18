import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

const getCol = (base: string, perfil: string) => {
  const p = String(perfil || '').toLowerCase();
  if (['compradores', 'erros', 'historico'].includes(base)) {
    return p === 'matriz' ? `${base}_matriz` : `${base}_lojas`;
  }
  return base;
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
    // === LOAD ALL ===
    if (action === 'loadAll') {
      const colComp = getCol('compradores', perfil);
      const colErros = getCol('erros', perfil);
      
      const getSimple = async (col: string) => {
        const s = await db.collection(col).orderBy('id').get();
        return s.docs.map(d => ({ 
          id: d.data().id, 
          nome: d.data().nome || d.data().f1 || '', 
          email: d.data().email || d.data().f2 || '' 
        }));
      };
      
      const getErros = async (col: string) => {
        const s = await db.collection(col).orderBy('id').get();
        return s.docs.map(d => ({ 
          id: d.data().id, 
          codigo: d.data().codigo || d.data().f1 || '', 
          descricao: d.data().descricao || d.data().f2 || '' 
        }));
      };
      
      const getForn = async () => {
        const s = await db.collection('fornecedores').orderBy('id').get();
        return s.docs.map(d => ({ 
          id: d.data().id, 
          codigo: d.data().codigo || d.data().f1 || '', 
          nome: d.data().nome || d.data().f2 || '' 
        }));
      };

      const [compradores, comerciais, lojas, manifestos, codErros, fornecedores, regras, justificativas, gruposLoja] = await Promise.all([
        getSimple(colComp), 
        getSimple('comerciais'), 
        getSimple('lojas'), 
        getSimple('manifestos'),
        getErros(colErros), 
        getForn(),
        (async () => { const s = await db.collection('regras').get(); return s.docs.map(d => d.data()); })(),
        (async () => { const s = await db.collection('justificativas').get(); return s.docs.map(d => d.data()); })(),
        (async () => { const s = await db.collection('grupos_loja').get(); return s.docs.map(d => d.data()); })()
      ]);
      
      return NextResponse.json({ 
        compradores, comerciais, lojas, manifestos, codErros, fornecedores, 
        historico: [], regras, justificativas, gruposLoja, assinatura: {} 
      });
    }

    // === ADD HISTORICO ===
    if (action === 'addHistorico') {
      const d = args[0];
      const colHist = getCol('historico', perfil);
      const id = await getNextId(colHist);
      const hoje = new Date().toLocaleDateString('pt-BR');
      const hojeISO = new Date().toISOString().split('T')[0];
      const hora = d.hora || new Date().toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'});
      
      let vencimentoStr = '';
      if (d.vencimento) {
        const p = String(d.vencimento).split('T')[0].split('-');
        if (p.length === 3) vencimentoStr = `${p[2]}/${p[1]}/${p[0]}`;
      }

      await db.collection(colHist).doc(String(id)).set({
        id, dataISO: hojeISO, data: hoje, hora, 
        danf: d.danf, fornecedor: d.fornecedor,
        codErro: d.codErro, erroDesc: d.erroDesc, 
        comprador: d.comprador, emailComprador: d.emailComprador,
        comercial: d.comercial, emailComercial: d.emailComercial, 
        loja: d.loja, emailLoja: d.emailLoja,
        manifesto: d.manifesto, emailManifesto: d.emailManifesto, 
        para: d.para, status: d.status,
        situacao: d.situacao || 'Pendente', 
        vencimento: vencimentoStr
      });
      
      return NextResponse.json({ ok: true, id });
    }

    return NextResponse.json({ error: 'Ação não implementada', ok: false }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, ok: false }, { status: 500 });
  }
}
