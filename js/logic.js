/* ==========================================================================
   Lógica pura do CRM (sem DOM) — testável em node:test
   Recebe os dados por argumento e devolve resultados. Não toca no ecrã nem
   em variáveis globais, para poder ser testada isoladamente.
   ========================================================================== */

/* ---------- utilitários ---------- */
function normaliza(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function diasEntre(a, b) {
  if (!a || !b) return NaN;
  return Math.round((new Date(b.slice(0, 10) + "T12:00:00") - new Date(a.slice(0, 10) + "T12:00:00")) / 864e5);
}
const soma = (arr, fn) => arr.reduce((acc, x) => acc + (+fn(x) || 0), 0);
const ehNC = v => String(v.TipoDoc || "").startsWith("NC");

/* ---------- visibilidade por carteira ----------
   Copia dos dados brutos (RAW) só o que a sessão pode ver.
   Vendedor: clientes de que é responsável + registos em que é o vendedor.
   Gestor: tudo. */
function visiveis(RAW, sessao) {
  const R = c => (RAW && RAW[c]) || [];
  const cols = ["vendedores", "clientes", "projetos", "vendas", "pendentes", "atividades", "producao", "cortantes", "artigos", "stock", "seguroCredito", "concorrentes", "feiras", "relatoriosFeira"];
  const S = {};
  if (!sessao) { cols.forEach(c => S[c] = []); return S; }
  if (sessao.perfil === "gestor") { cols.forEach(c => S[c] = R(c).slice()); return S; }
  // Carteira = clientes de que o vendedor é responsável. Tudo o resto é limitado
  // a esses clientes, para NÃO expor cartão, NIF ou dívidas de carteiras alheias
  // (uma venda avulsa a um cliente de outro vendedor não dá acesso a esse cliente).
  const eu = sessao.nome;
  const resp = new Set(R("clientes").filter(c => c.Vendedor === eu).map(c => String(c.id)));
  const meuCliente = ent => resp.has(String(ent));
  S.vendedores = R("vendedores").filter(v => v.nome === eu);
  S.clientes = R("clientes").filter(c => meuCliente(c.id));
  S.projetos = R("projetos").filter(p => meuCliente(p.Cliente));
  S.vendas = R("vendas").filter(v => meuCliente(v.Entidade));
  // atividades da carteira + tarefas de que o vendedor é dono (a Gestão pode
  // atribuir-lhe tarefas sem cliente ou de clientes de outra carteira).
  S.atividades = R("atividades").filter(a => meuCliente(a.Entidade) || (a.tipo === "tarefa" && a.Vendedor === eu));
  S.pendentes = R("pendentes").filter(p => meuCliente(p.Entidade));
  S.cortantes = R("cortantes");   // cortantes não têm dados do cliente — lista comum
  S.artigos = R("artigos").filter(a => meuCliente(a.CodCliente));
  S.stock = R("stock").filter(s => meuCliente(s.CDU_CodCliente));
  S.seguroCredito = R("seguroCredito").filter(s => meuCliente(s.Cliente));
  S.concorrentes = R("concorrentes");   // concorrentes são uma lista comum (sem dados do cliente)
  const ops = new Set(S.vendas.map(v => String(v.Lote)));
  S.producao = R("producao").filter(m => ops.has(String(m.OP)));
  // Feiras atribuídas ao vendedor; relatórios de que é autor.
  S.feiras = R("feiras").filter(f => (f.vendedores || []).includes(eu));
  S.relatoriosFeira = R("relatoriosFeira").filter(r => r.Vendedor === eu);
  return S;
}

/* ---------- pesquisa de clientes ---------- */
function pesquisaClientes(clientes, termo) {
  const t = normaliza(termo).trim();
  if (!t) return clientes.slice();
  return clientes.filter(c => normaliza(c.Nome).includes(t) || normaliza(c.Entidade || c.id).includes(t));
}

/* ---------- cortantes por medidas (±tolerância em mm) ----------
   Dado um conjunto de medidas pedidas (A/B/C — comprimento, largura, altura, em
   mm; a aba é ignorada), devolve os cortantes cujas medidas estão dentro da
   tolerância (5 mm por omissão), do mais próximo ao menos próximo. Só conta as
   dimensões preenchidas.
   - posicional (cruzada=false): cada medida casa com a sua (comp.↔comp., etc.).
   - cruzada (cruzada=true): as medidas casam em qualquer ordem, porque a mesma
     caixa pode ser usada noutra orientação (ex.: garrafas de pé vs. deitadas),
     trocando comprimento/largura/altura entre si. */
const CAMPOS_MEDIDA = { A: "FTCXA", B: "FTCXB", C: "FTCXC" };

// menor desvio total ao atribuir cada valor pedido a uma dimensão distinta do
// cortante dentro da tolerância; null se não houver atribuição possível.
function melhorEncaixe(valores, dims, tol) {
  let best = null;
  const usados = new Array(dims.length).fill(false);
  (function rec(i, soma) {
    if (best != null && soma >= best) return;
    if (i === valores.length) { best = best == null ? soma : Math.min(best, soma); return; }
    for (let j = 0; j < dims.length; j++) {
      if (usados[j]) continue;
      const diff = Math.abs(dims[j] - valores[i]);
      if (diff > tol) continue;
      usados[j] = true; rec(i + 1, soma + diff); usados[j] = false;
    }
  })(0, 0);
  return best;
}

function cortantesPorMedidas(cortantes, medidas, tolerancia, cruzada) {
  const tol = tolerancia == null ? 5 : tolerancia;
  const pedidas = Object.keys(CAMPOS_MEDIDA).filter(k => +medidas[k] > 0).map(k => ({ campo: CAMPOS_MEDIDA[k], valor: +medidas[k] }));
  if (!pedidas.length) return [];
  if (cruzada) {
    const vals = pedidas.map(p => p.valor);
    const out = [];
    for (const c of (cortantes || [])) {
      const dims = Object.values(CAMPOS_MEDIDA).map(f => +c[f] || 0).filter(x => x > 0);
      const d = melhorEncaixe(vals, dims, tol);
      if (d != null) out.push({ c, desvio: d });
    }
    return out.sort((a, b) => a.desvio - b.desvio).map(x => x.c);
  }
  const dentro = c => pedidas.every(p => { const cv = +c[p.campo] || 0; return cv > 0 && Math.abs(cv - p.valor) <= tol; });
  const desvio = c => pedidas.reduce((s, p) => s + Math.abs((+c[p.campo] || 0) - p.valor), 0);
  return (cortantes || []).filter(dentro).sort((a, b) => desvio(a) - desvio(b));
}

/* ---------- recebimentos por escalão de atraso ---------- */
function recebimentosEscaloes(pendentes, ent, hojeIso) {
  const r = { naoVencido: 0, d1a30: 0, d31a60: 0, d61a90: 0, maior90: 0, total: 0 };
  for (const p of pendentes) {
    if (String(p.Entidade) !== String(ent)) continue;
    const v = +p.ValorPendente || 0;
    r.total += v;
    const d = diasEntre(p.DataVenc, hojeIso);
    if (d <= 0) r.naoVencido += v;
    else if (d < 30) r.d1a30 += v;
    else if (d < 60) r.d31a60 += v;
    else if (d < 90) r.d61a90 += v;
    else r.maior90 += v;
  }
  return r;
}

/* ---------- artigos produzidos por cliente ----------
   Última produção via Lote da venda = OP dos movimentos de produção.
   Artigo sem movimento de produção fica com ultimaProducao = null. */
function artigosProduzidos(vendas, producao, ent) {
  const doCliente = vendas.filter(v => String(v.Entidade) === String(ent));
  const porArtigo = {};
  for (const v of doCliente) {
    (porArtigo[v.Artigo] || (porArtigo[v.Artigo] = [])).push(v);
  }
  const dataProd = m => m.Fim || m.Inicio || null;
  return Object.keys(porArtigo).map(artigo => {
    const linhas = porArtigo[artigo].slice().sort((a, b) => String(b.Data || "").localeCompare(String(a.Data || "")));
    const ultima = linhas[0] || {};
    const lotes = new Set(linhas.map(l => String(l.Lote)));
    let ultimaProducao = null;
    for (const m of producao) {
      if (!lotes.has(String(m.OP))) continue;
      const d = dataProd(m);
      if (d && (!ultimaProducao || d > ultimaProducao)) ultimaProducao = d;
    }
    return {
      artigo,
      descricao: ultima.Descricao || "",
      matPrima: ultima.MatPrima || "",
      matPrimaDescricao: ultima.MatPrimaDescricao || "",
      ultimaQuantidade: +ultima.Quantidade || 0,
      ultimaProducao
    };
  });
}

/* ---------- lista de artigos (base para orçamentos) ----------
   Por artigo: última ordem de produção (OP mais recente por data de produção),
   quantidade produzida nessa OP e preço/unidade cobrado nessa OP.
   filtroCliente (opcional) limita a um cliente (Entidade). */
function listaArtigos(vendas, producao, filtroCliente) {
  const vF = filtroCliente ? vendas.filter(v => String(v.Entidade) === String(filtroCliente)) : vendas;
  const dataProd = m => m.Fim || m.Inicio || null;
  const prodByOP = {};
  for (const m of producao) {
    const op = String(m.OP), d = dataProd(m), q = +m.QtdProduzida || 0;
    const cur = prodByOP[op];
    if (!cur || (d && (!cur.data || d > cur.data))) prodByOP[op] = { data: d, qtd: Math.max(q, cur ? cur.qtd : 0) };
    else if (cur) cur.qtd = Math.max(cur.qtd, q);
  }
  const porArtigo = {};
  for (const v of vF) (porArtigo[v.Artigo] || (porArtigo[v.Artigo] = [])).push(v);
  return Object.keys(porArtigo).map(artigo => {
    const linhas = porArtigo[artigo];
    // escolher a linha da OP com produção mais recente; se nenhuma tem produção, a venda mais recente
    let escolhida = null, melhorData = null;
    for (const l of linhas) {
      const d = (prodByOP[String(l.Lote)] || {}).data || null;
      if (d && (!melhorData || d > melhorData)) { melhorData = d; escolhida = l; }
    }
    if (!escolhida) escolhida = linhas.slice().sort((a, b) => String(b.Data || "").localeCompare(String(a.Data || "")))[0];
    const prod = prodByOP[String(escolhida.Lote)] || null;
    return {
      artigo,
      descricao: escolhida.Descricao || "",
      cliente: escolhida.Entidade,
      clienteNome: escolhida.Nome || "",
      matPrima: escolhida.MatPrima || "",
      matPrimaDescricao: escolhida.MatPrimaDescricao || "",
      ultimaOP: escolhida.Lote != null ? escolhida.Lote : null,
      dataUltimaProducao: prod ? prod.data : null,
      qtdProduzida: prod ? prod.qtd : null,
      ultimaQuantidade: +escolhida.Quantidade || 0,
      precoUnitario: +escolhida.PrecoVendaUnitario || 0
    };
  });
}

/* ---------- catálogo de artigos (master = PR_Mobilidade_Artigos) ----------
   Junta a ficha técnica do artigo (tipo de caixa, medidas, matéria-prima,
   revestimento, acabamentos, segurança alimentar) com a última OP / preço
   vindos das vendas+produção. Artigo sem vendas cai para CortanteUltimaOP. */
function catalogoArtigos(artigos, vendas, producao, filtroCliente) {
  const masters = filtroCliente ? (artigos || []).filter(a => String(a.CodCliente) === String(filtroCliente)) : (artigos || []);
  const info = {};
  for (const r of listaArtigos(vendas, producao)) info[String(r.artigo)] = r;
  return masters.map(a => {
    const vi = info[String(a.Artigo)] || {};
    return Object.assign({}, a, {
      artigo: a.Artigo,
      descricao: a.Descricao || vi.descricao || "",
      clienteNome: a.Nome || "",
      ultimaOP: vi.ultimaOP != null ? vi.ultimaOP : (a.CortanteUltimaOP != null ? a.CortanteUltimaOP : null),
      dataUltimaProducao: vi.dataUltimaProducao || null,
      qtdProduzida: vi.qtdProduzida != null ? vi.qtdProduzida : null,
      ultimaQuantidade: vi.ultimaQuantidade || 0,
      precoUnitario: vi.precoUnitario || 0
    });
  });
}

/* ---------- stock por artigo (PR_TABLET_ListaStock_PA) ----------
   Agrega as linhas de stock por artigo (soma os lotes/armazéns). */
function listaStock(stock, filtroCliente) {
  const rows = filtroCliente ? (stock || []).filter(s => String(s.CDU_CodCliente) === String(filtroCliente)) : (stock || []);
  const porArt = {};
  for (const s of rows) {
    const k = String(s.Artigo);
    const r = porArt[k] || (porArt[k] = { artigo: s.Artigo, descricao: s.Descricao || "", clienteNome: s.Nome || "", codCliente: s.CDU_CodCliente, total: 0, linhas: [] });
    r.total += +s.StkActual || 0;
    r.linhas.push(s);
  }
  return Object.values(porArt);
}

/* ---------- agenda / tarefas (TDU_PR_Visitas, tipo "tarefa") ----------
   porAlocar: sem data (banco de tarefas). aFazer: com data (atrasadas primeiro).
   concluidas: mais recentes primeiro. atrasadas: contagem das aFazer já vencidas. */
function agendaTarefas(atividades, hojeIso) {
  const tar = (atividades || []).filter(a => a.tipo === "tarefa");
  const porConcluir = tar.filter(a => !a.concluida);
  const porAlocar = porConcluir.filter(a => !a.data).sort((a, b) => String(a.criadoEm || "").localeCompare(String(b.criadoEm || "")));
  const aFazer = porConcluir.filter(a => a.data).sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
  const concluidas = tar.filter(a => a.concluida).sort((a, b) => String(b.concluidaEm || b.data || "").localeCompare(String(a.concluidaEm || a.data || "")));
  const atrasadas = aFazer.filter(a => a.data && a.data < String(hojeIso)).length;
  return { porAlocar, aFazer, concluidas, atrasadas };
}

/* Tarefas visíveis para a sessão: o gestor vê todas; o vendedor vê só aquelas
   de que é dono (Vendedor). Usa-se no ecrã de tarefas e no calendário. */
function tarefasVisiveis(atividades, sessao) {
  const tar = (atividades || []).filter(a => a.tipo === "tarefa");
  if (!sessao) return [];
  if (sessao.perfil === "gestor") return tar.slice();
  return tar.filter(t => t.Vendedor === sessao.nome);
}

/* Tarefa automática criada quando um projeto passa a "Não Aceite":
   ir recolher a caixa ao cliente e pedir o estudo do projeto. Fica por alocar. */
function tarefaAutoNaoAceite(projeto) {
  return {
    tipo: "tarefa", subtipo: "caixaConcorrente", origem: "auto:naoAceite",
    descricao: "Ir recolher a caixa ao cliente e pedir o estudo do projeto",
    Vendedor: projeto.Vendedor, Entidade: projeto.Cliente, Projeto: projeto.id || projeto.Projeto || null,
    data: null, concluida: false, criadoPor: "auto", criadoEm: new Date().toISOString()
  };
}

/* Validação de uma nova tarefa: descrição e vendedor dono obrigatórios. */
function validaTarefa(d) {
  const erros = {};
  if (!d.descricao || !String(d.descricao).trim()) erros.descricao = "Descreva a tarefa.";
  if (!d.Vendedor || !String(d.Vendedor).trim()) erros.Vendedor = "Escolha o vendedor.";
  return { ok: Object.keys(erros).length === 0, erros };
}

/* Validação ao concluir: o feedback (nota de resultado) é obrigatório. */
function validaConclusaoTarefa(d) {
  const erros = {};
  if (!d.resultadoNotas || !String(d.resultadoNotas).trim()) erros.resultadoNotas = "Escreva o feedback.";
  return { ok: Object.keys(erros).length === 0, erros };
}

/* ---------- Feiras e relatórios de visita a feira ---------- */
/* Feiras visíveis: o gestor vê todas; o vendedor vê as que lhe foram atribuídas. */
function feirasVisiveis(feiras, sessao) {
  if (!sessao) return [];
  const lst = (feiras || []).slice();
  if (sessao.perfil === "gestor") return lst;
  return lst.filter(f => (f.vendedores || []).includes(sessao.nome));
}

/* Tarefa automática criada ao atribuir uma feira a um vendedor:
   preencher o relatório da feira. Fica por alocar; fecha ao submeter o relatório. */
function tarefaAutoRelatorioFeira(feira, vendedor) {
  return {
    tipo: "tarefa", subtipo: "relatorioFeira", origem: "auto:feira",
    descricao: "Preencher relatório da feira " + (feira.nome || ""),
    Vendedor: vendedor, feiraId: feira.id, data: null, concluida: false,
    criadoPor: "auto", criadoEm: new Date().toISOString()
  };
}

/* Avaliação de uma feira: nº de relatórios e média das classificações (1-5). */
function avaliacaoFeira(relatorios, feiraId) {
  const rel = (relatorios || []).filter(r => String(r.feiraId) === String(feiraId));
  const cl = rel.map(r => +r.classificacao).filter(n => n >= 1 && n <= 5);
  const media = cl.length ? Math.round((cl.reduce((a, b) => a + b, 0) / cl.length) * 10) / 10 : null;
  return { nRelatorios: rel.length, nClassificados: cl.length, media };
}

/* Validação de uma feira (nome obrigatório). */
function validaFeira(d) {
  const erros = {};
  if (!d.nome || !String(d.nome).trim()) erros.nome = "Indique o nome da feira.";
  return { ok: Object.keys(erros).length === 0, erros };
}

/* Validação do relatório: a classificação global (1-5) é obrigatória. */
function validaRelatorioFeira(d) {
  const erros = {};
  const c = +d.classificacao;
  if (!(c >= 1 && c <= 5)) erros.classificacao = "Dê uma classificação de 1 a 5 à visita.";
  return { ok: Object.keys(erros).length === 0, erros };
}

/* Grelha mensal (estilo Outlook). Devolve 6 semanas de segunda a domingo,
   cada dia com as suas tarefas (por data). Usa UTC para não depender do fuso. */
const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function calendarioMes(atividades, ano, mes, hojeIso) {
  const porDia = {};
  (atividades || []).filter(a => a.tipo === "tarefa" && a.data).forEach(t => { (porDia[t.data] = porDia[t.data] || []).push(t); });
  const diaSemana = (new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay() + 6) % 7;   // 0 = segunda
  const cur = new Date(Date.UTC(ano, mes - 1, 1 - diaSemana));
  const semanas = [];
  for (let w = 0; w < 6; w++) {
    const semana = [];
    for (let d = 0; d < 7; d++) {
      const iso = cur.toISOString().slice(0, 10);
      const lista = (porDia[iso] || []).slice().sort((a, b) => (a.concluida ? 1 : 0) - (b.concluida ? 1 : 0));
      semana.push({ iso, dia: cur.getUTCDate(), fora: cur.getUTCMonth() !== mes - 1, hoje: iso === String(hojeIso), tarefas: lista });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    semanas.push(semana);
  }
  return { semanas, label: MESES_PT[mes - 1] + " " + ano, ano, mes };
}

/* ---------- pesquisa de cortantes ---------- */
function pesquisaCortantes(cortantes, termo) {
  const t = normaliza(termo).trim();
  if (!t) return (cortantes || []).slice();
  return (cortantes || []).filter(c => normaliza([c.Codigo, c.TipoCaixa, c.TipoCaixaDescricao1, c.TipoCaixaDescricao2, c.DescricaoCortante].filter(Boolean).join(" ")).includes(t));
}

/* ---------- ficha (estado) do cliente ---------- */
function fichaCliente(ent, S, hojeIso) {
  const ano = String(hojeIso).slice(0, 4);
  const vendas = (S.vendas || []).filter(v => String(v.Entidade) === String(ent));
  const totalVendas = soma(vendas.filter(v => (v.Data || "").startsWith(ano) && !ehNC(v)), v => v.TotalVenda);
  const visitas = (S.atividades || []).filter(a => a.tipo === "visita" && String(a.Entidade) === String(ent))
    .sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  const projetosPendentes = (S.projetos || []).filter(p => String(p.Cliente) === String(ent) && p.Estado === "Pendente");
  return {
    totalVendas,
    recebimentos: recebimentosEscaloes(S.pendentes || [], ent, hojeIso),
    ultimaVisita: visitas[0] ? visitas[0].data : null,
    projetosPendentes,
    artigos: artigosProduzidos(S.vendas || [], S.producao || [], ent)
  };
}

/* ---------- dashboards ----------
   Vendas por cliente: ano atual (até hoje) vs. mesmo período do ano anterior.
   Clientes perdidos: tinham vendas no ano anterior e este ano não têm.
   Clientes novos/reconquistados: não tinham no ano anterior e este ano têm. */
function dashboardClientes(vendas, hojeIso) {
  const ano = String(hojeIso).slice(0, 4), anoAnt = String(+ano - 1), mmdd = String(hojeIso).slice(5, 10);
  const m = {};
  for (const v of vendas) {
    if (ehNC(v)) continue;
    const data = String(v.Data || ""), y = data.slice(0, 4), md = data.slice(5, 10), tot = +v.TotalVenda || 0;
    const ent = String(v.Entidade);
    const r = m[ent] || (m[ent] = { entidade: v.Entidade, nome: v.Nome || "", atual: 0, anterior: 0, anteriorFull: 0 });
    if (y === ano && md <= mmdd) r.atual += tot;
    if (y === anoAnt) { r.anteriorFull += tot; if (md <= mmdd) r.anterior += tot; }
  }
  const linhas = Object.values(m).map(r => ({ ...r, variacao: r.atual - r.anterior, variacaoPct: r.anterior > 0 ? (r.atual - r.anterior) / r.anterior : null }));
  const perdidos = linhas.filter(r => r.anteriorFull > 0 && r.atual === 0).sort((a, b) => b.anteriorFull - a.anteriorFull);
  const novos = linhas.filter(r => r.anteriorFull === 0 && r.atual > 0).sort((a, b) => b.atual - a.atual);
  return { linhas, perdidos, novos, ano: +ano, anoAnterior: +anoAnt };
}

/* ---------- dashboard por vendedor (para o gestor) ----------
   Uma linha por vendedor com: vendas 2026 YTD vs 2025 YTD (variação), clientes
   novos e perdidos (com as suas vendas, para o drill-down), e os recebimentos
   pendentes/em atraso dos seus clientes. Agrupa pelo Vendedor de cada cliente. */
function dashboardVendedores(vendas, clientes, pendentes, hojeIso) {
  const dc = dashboardClientes(vendas || [], hojeIso);
  const linhaOf = {}, vendOf = {};
  for (const r of dc.linhas) linhaOf[String(r.entidade)] = r;
  const g = {};
  for (const c of (clientes || [])) {
    const vend = c.Vendedor || "—";
    vendOf[String(c.id)] = vend;
    const grp = g[vend] || (g[vend] = { vendedor: vend, vendas2026: 0, vendas2025: 0, ativos: [], novos: [], perdidos: [], pendente: 0, atraso: 0 });
    const r = linhaOf[String(c.id)];
    if (r) { grp.vendas2026 += r.atual; grp.vendas2025 += r.anterior; if (r.atual > 0) grp.ativos.push(r); }
  }
  for (const r of dc.novos) { const v = vendOf[String(r.entidade)]; if (g[v]) g[v].novos.push(r); }
  for (const r of dc.perdidos) { const v = vendOf[String(r.entidade)]; if (g[v]) g[v].perdidos.push(r); }
  for (const p of (pendentes || [])) {
    const v = vendOf[String(p.Entidade)]; if (!g[v]) continue;
    const val = +p.ValorPendente || 0;
    g[v].pendente += val;
    if (val > 0 && diasEntre(p.DataVenc, hojeIso) > 0) g[v].atraso += val;
  }
  return Object.values(g).map(grp => ({
    vendedor: grp.vendedor,
    vendas2026: grp.vendas2026,
    vendas2025: grp.vendas2025,
    variacao: grp.vendas2026 - grp.vendas2025,
    variacaoPct: grp.vendas2025 > 0 ? (grp.vendas2026 - grp.vendas2025) / grp.vendas2025 : null,
    ativos: grp.ativos.slice().sort((a, b) => b.atual - a.atual),
    novos: grp.novos.slice().sort((a, b) => b.atual - a.atual),
    perdidos: grp.perdidos.slice().sort((a, b) => b.anteriorFull - a.anteriorFull),
    pendente: grp.pendente,
    atraso: grp.atraso
  })).sort((a, b) => b.vendas2026 - a.vendas2026);
}

function resumoProjetos(projetos) {
  const r = { Pendente: 0, Aceite: 0, "Não Aceite": 0, Anulado: 0, total: (projetos || []).length };
  for (const p of (projetos || [])) if (r[p.Estado] != null) r[p.Estado]++;
  return r;
}

/* ---------- pipeline de projetos ----------
   Agrupa por estado (ordem comercial), com contagem, valor e lista ordenada
   pela última atividade (mais recente primeiro). campoValor: nome do campo de
   valor (ValorEstimado por omissão). */
function pipelineProjetos(projetos, campoValor) {
  const campo = campoValor || "ValorEstimado";
  const ordem = ["Não Aceite", "Pendente", "Aceite", "Anulado"];   // Não aceites primeiro (chamar a atenção); Anulados no fim
  const porEstado = {};
  for (const p of (projetos || [])) (porEstado[p.Estado || "—"] || (porEstado[p.Estado || "—"] = [])).push(p);
  const nomes = ordem.concat(Object.keys(porEstado).filter(e => !ordem.includes(e)));
  const estados = nomes.map(estado => {
    const lista = (porEstado[estado] || []).slice()
      .sort((a, b) => String(b.DataUltimaActividade || "").localeCompare(String(a.DataUltimaActividade || "")));
    return { estado, lista, count: lista.length, valor: soma(lista, p => p[campo]) };
  });
  return { estados, total: (projetos || []).length, valorTotal: soma(projetos || [], p => p[campo]) };
}

/* ---------- mudança de estado do projeto ----------
   Estados fechados (Não Aceite / Anulado) exigem motivo; Não Aceite exige ainda
   para quem se perdeu e o valor estimado (para o estudo de motivos). Qualquer
   mudança exige justificação. Lógica pura (validação + construção do patch);
   o registo no Store e na lista de concorrentes fica na UI. */
const ESTADOS_PROJETO = ["Pendente", "Aceite", "Não Aceite", "Anulado"];
const MOTIVOS_RECUSA = ["Preço do cartão elevado", "Optou pela concorrência", "Amostra não aprovada",
  "Resistência à compressão insuficiente", "Prazo de produção longo", "Cliente mudou para embalagem plástica", "Outro"];

function validaMudancaEstado(estadoNovo, d) {
  d = d || {};
  const fechado = estadoNovo === "Não Aceite" || estadoNovo === "Anulado";
  const vazio = v => v == null || String(v).trim() === "";
  const erros = {};
  if (vazio(d.justificacao)) erros.justificacao = "Escreva uma justificação.";
  if (fechado) {
    if (vazio(d.motivo)) erros.motivo = "Escolha o motivo.";
    else if (d.motivo === "Outro" && vazio(d.motivoOutro)) erros.motivoOutro = "Indique qual é o motivo.";
  }
  if (estadoNovo === "Não Aceite") {
    if (vazio(d.perdidoPara)) erros.perdidoPara = "Indique para quem se perdeu.";
    if (!(+d.valor > 0)) erros.valor = "Indique o valor estimado do projeto.";
  }
  return { ok: Object.keys(erros).length === 0, erros };
}

function patchMudancaEstado(projeto, estadoNovo, d, hojeIso, campoValor) {
  d = d || {};
  const campo = campoValor || "ValorEstimado";
  const fechado = estadoNovo === "Não Aceite" || estadoNovo === "Anulado";
  const motivo = fechado ? (d.motivo === "Outro" ? (d.motivoOutro || "").trim() : d.motivo) : null;
  const patch = {
    Estado: estadoNovo,
    MotivoAnulacao: motivo,
    PerdidoPara: estadoNovo === "Não Aceite" ? (d.perdidoPara || null) : null,
    ClienteSemInteresse: fechado ? (d.clienteSemInteresse || "Não") : "Não",
    JustificacaoEstado: (d.justificacao || "").trim(),
    DataUltimaActividade: hojeIso
  };
  if (estadoNovo === "Não Aceite") patch[campo] = +d.valor || 0;
  return patch;
}

/* ---------- estudo de motivos de recusa ----------
   Agrega os projetos Não Aceite por motivo e por concorrente (para quem se
   perdeu), com contagem e valor estimado, do maior valor para o menor. */
function motivosRecusa(projetos, campoValor) {
  const campo = campoValor || "ValorEstimado";
  const perdidos = (projetos || []).filter(p => p.Estado === "Não Aceite");
  const agrupar = (chave, fallback) => {
    const m = {};
    for (const p of perdidos) {
      const k = (p[chave] == null || String(p[chave]).trim() === "") ? fallback : p[chave];
      const g = m[k] || (m[k] = { count: 0, valor: 0 });
      g.count++; g.valor += +p[campo] || 0;
    }
    return m;
  };
  const ordenar = (obj, nome) => Object.entries(obj)
    .map(([k, v]) => ({ [nome]: k, count: v.count, valor: v.valor }))
    .sort((a, b) => b.valor - a.valor || b.count - a.count);
  return {
    total: perdidos.length,
    valorTotal: soma(perdidos, p => p[campo]),
    porMotivo: ordenar(agrupar("MotivoAnulacao", "Sem motivo"), "motivo"),
    porConcorrente: ordenar(agrupar("PerdidoPara", "Sem registo"), "nome")
  };
}

/* ---------- recebimentos por cliente ----------
   Agrega os pendentes por entidade, com escalões de atraso. Ordena os clientes
   com valores em atraso primeiro (maior valor atrasado), para destacar avisos. */
function recebimentosPorCliente(pendentes, hojeIso) {
  const porEnt = {};
  for (const p of (pendentes || [])) {
    const ent = String(p.Entidade);
    const r = porEnt[ent] || (porEnt[ent] = { entidade: p.Entidade, total: 0, atrasado: 0, venceHoje: 0, naoVencido: 0, maiorAtrasoDias: 0 });
    const v = +p.ValorPendente || 0;
    r.total += v;
    const d = diasEntre(p.DataVenc, hojeIso);   // dias desde a data de vencimento (>0 = em atraso)
    if (d > 0) { r.atrasado += v; if (d > r.maiorAtrasoDias) r.maiorAtrasoDias = d; }
    else if (d === 0) r.venceHoje += v;         // vence hoje (dia do pagamento)
    else r.naoVencido += v;                      // dentro do prazo
  }
  // Ordem: em atraso primeiro (mais dias), depois vence hoje, depois dentro do prazo
  const rank = r => r.atrasado > 0 ? 2 : r.venceHoje > 0 ? 1 : 0;
  return Object.values(porEnt).sort((a, b) => (rank(b) - rank(a)) || (b.maiorAtrasoDias - a.maiorAtrasoDias) || (b.total - a.total));
}

/* ---------- avisos de pagamento (cobrança) de um cliente ----------
   Avisos = atividades de tipo "aviso" do cliente, do mais recente ao mais antigo.
   Ficam limitados à carteira em visiveis, logo só o vendedor do cliente e o
   gestor (geral) os veem. */
function avisosCliente(atividades, ent) {
  return (atividades || []).filter(a => a.tipo === "aviso" && String(a.Entidade) === String(ent))
    .sort((a, b) => String((b.data || "") + (b.criadoEm || "")).localeCompare(String((a.data || "") + (a.criadoEm || ""))));
}

/* ---------- recebimentos: um cartão por cliente com as faturas em dívida ----------
   Agrupa os valores pendentes por cliente e devolve, por cliente, a lista de
   faturas (cada uma com o seu vencimento, valor e dias de atraso) — para se
   distinguirem duas faturas diferentes em atraso. Negativo = nota de crédito. */
function recebimentosCartoes(pendentes, hojeIso, soAtraso) {
  const g = {};
  for (const p of (pendentes || [])) {
    const ent = String(p.Entidade);
    (g[ent] || (g[ent] = [])).push(p);
  }
  const cartoes = Object.keys(g).map(ent => {
    const faturas = g[ent].map(p => {
      const val = +p.ValorPendente || 0;
      const dias = diasEntre(p.DataVenc, hojeIso);
      return { id: p.id, Entidade: p.Entidade, DataVenc: p.DataVenc, ValorPendente: val, diasAtraso: dias, credito: val < 0 };
    }).sort((a, b) => b.diasAtraso - a.diasAtraso);
    const emAtraso = faturas.filter(f => f.ValorPendente > 0 && f.diasAtraso > 0);
    return {
      entidade: g[ent][0].Entidade,
      total: soma(faturas, f => f.ValorPendente),
      vencido: soma(emAtraso, f => f.ValorPendente),
      maiorAtrasoDias: emAtraso.length ? Math.max(...emAtraso.map(f => f.diasAtraso)) : 0,
      faturas
    };
  });
  return (soAtraso ? cartoes.filter(c => c.vencido > 0) : cartoes)
    .sort((a, b) => b.maiorAtrasoDias - a.maiorAtrasoDias || b.vencido - a.vencido || b.total - a.total);
}

function recebimentosGeral(pendentes, hojeIso) {
  const r = { naoVencido: 0, d1a30: 0, d31a60: 0, d61a90: 0, maior90: 0, total: 0 };
  for (const p of (pendentes || [])) {
    const v = +p.ValorPendente || 0; r.total += v;
    const d = diasEntre(p.DataVenc, hojeIso);
    if (d <= 0) r.naoVencido += v; else if (d < 30) r.d1a30 += v; else if (d < 60) r.d31a60 += v; else if (d < 90) r.d61a90 += v; else r.maior90 += v;
  }
  return r;
}

/* ---------- crédito do cliente (prazo de pagamento + seguro de crédito) ----------
   prazoPagamento: condição de pagamento (dias) — vem das condições do cliente no ERP
     (ainda não exposto; no protótipo é fictício, campo PrazoPagamento do cliente).
   limiteCred / disponivelSeguro / totalDisponivel / totalPend / totalDeb: tabela real
     PR_AnaliseSeguroCredito (um registo por cliente). 'excedido' = disponível < 0. */
function creditoCliente(cliente, seguroRow) {
  const num = v => (v == null || v === "" ? null : +v);
  const campo = c => seguroRow ? num(seguroRow[c]) : null;
  const disp = campo("DisponivelSeguro");
  return {
    prazoPagamento: cliente ? num(cliente.PrazoPagamento) : null,
    limiteCred: campo("LimiteCred"),
    disponivelSeguro: disp,
    totalDisponivel: campo("TotalDisponivel"),
    totalPend: campo("TotalPend"),
    totalDeb: campo("TotalDeb"),
    excedido: disp != null && disp < 0
  };
}

/* ---------- opções (listas) do pedido de orçamento ----------
   Matéria-prima a partir das vendas; tipo de caixa a partir dos cortantes.
   (As listas oficiais e completas vêm do ERP — ponto para o IT.) */
function opcoesOrcamento(vendas, cortantes) {
  const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));
  const materiasPrimas = uniq((vendas || []).map(v => v.MatPrima ? (v.MatPrima + (v.MatPrimaDescricao ? " - " + v.MatPrimaDescricao : "")) : null));
  const tiposCaixa = uniq((cortantes || []).map(c => c.TipoCaixa ? (c.TipoCaixa + (c.TipoCaixaDescricao1 ? " - " + c.TipoCaixaDescricao1 : "")) : null));
  return { materiasPrimas, tiposCaixa };
}

/* ---------- validação do pedido de orçamento ---------- */
function validaPedidoOrcamento(d) {
  const erros = {};
  if (!d.cliente && !d.novoCliente) erros.cliente = "Escolha o cliente.";
  if (!d.descricao || !String(d.descricao).trim()) erros.descricao = "Descreva o que pretende.";
  if (!String(d.quantidade == null ? "" : d.quantidade).trim()) erros.quantidade = "Indique a quantidade.";
  if (!d.localEntrega || !String(d.localEntrega).trim()) erros.localEntrega = "Indique o local de entrega.";
  if (d.prodAlimentares && d.contactoProdAlimentar !== "Direto" && d.contactoProdAlimentar !== "Indireto")
    erros.contactoProdAlimentar = "Indique se o contacto com o alimento é direto ou indireto.";
  return { ok: Object.keys(erros).length === 0, erros };
}

/* ---------- permissões de visibilidade de campos ----------
   O vendedor vê os detalhes do artigo e a última produção (OP, data, qtd),
   mas NÃO o preço/unidade cobrado. Só o gestor vê o preço. */
function podeVerPrecoUnitario(sessao) {
  return !!sessao && sessao.perfil === "gestor";
}

const _API = { normaliza, diasEntre, visiveis, pesquisaClientes, pesquisaCortantes, cortantesPorMedidas, recebimentosEscaloes, artigosProduzidos, listaArtigos, catalogoArtigos, listaStock, agendaTarefas, fichaCliente, dashboardClientes, dashboardVendedores, resumoProjetos, pipelineProjetos, validaMudancaEstado, patchMudancaEstado, motivosRecusa, ESTADOS_PROJETO, MOTIVOS_RECUSA, recebimentosPorCliente, recebimentosGeral, recebimentosCartoes, avisosCliente, creditoCliente, opcoesOrcamento, validaPedidoOrcamento, podeVerPrecoUnitario, tarefasVisiveis, tarefaAutoNaoAceite, validaTarefa, validaConclusaoTarefa, calendarioMes, feirasVisiveis, tarefaAutoRelatorioFeira, avaliacaoFeira, validaFeira, validaRelatorioFeira };
if (typeof module !== "undefined" && module.exports) module.exports = _API;
if (typeof window !== "undefined") window.L = _API;
