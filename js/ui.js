/* ==========================================================================
   Interface (render, navegação, ecrãs) — CRM Calheiros v1
   Depende de: config.js, store.js, logic.js, forms.js e dos dados de exemplo.
   ========================================================================== */

/* ---------- estado ---------- */
const RAW = {};                 // dados tal como chegam do Store
let S = {};                     // dados visíveis para a sessão (logic.visiveis)
const loaded = new Set();
let Store = null, Auth = null, sessao = null, meNome = null;
let tab = "inicio", pesquisa = "", sheetRender = null;
let projFiltro = "", recSoAtraso = true;   // filtros dos ecrãs Projetos / Recebimentos (recebimentos abre em "Em atraso")
let cortTipo = "", cortMedidas = { A: "", B: "", C: "" }, cortCruzada = false;   // filtros do ecrã Cortantes (tipo de caixa, medidas ±5 mm, cruzamento de medidas)
const TAB_PAI = { artigos: "ferramentas", cortantes: "ferramentas", stock: "ferramentas", tarefas: "ferramentas", projetos: "ferramentas", recebimentos: "ferramentas", feiras: "ferramentas" };  // separador a destacar nos sub-ecrãs
const COR_ESTADO = { "Pendente": "b-a1", "Aceite": "b-ok", "Não Aceite": "b-a3", "Anulado": "b-a2" };
const COR_STEPPER = { "Pendente": "var(--f-orcamento)", "Aceite": "var(--f-ganho)", "Não Aceite": "var(--f-perdido)", "Anulado": "var(--ink-2)" };
const NOVO_CONCORRENTE = "Outro concorrente (novo)";
const NAO_REVELA = "Cliente não revela";
const CHAVE_SESSAO = "crm-calheiros-sessao";
const PERFIS = { vendedor: "Vendedor", gestor: "Gestor comercial" };

/* ---------- utilitários ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = n => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const eur2 = n => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const eurU = n => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 3, maximumFractionDigits: 4 }).format(n || 0);
const unid = n => (+n || 0).toLocaleString("pt-PT") + " un";
const isoHoje = () => new Date().toLocaleDateString("sv-SE");
const dataPT = iso => iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "short" }) : "—";
const dataCompleta = iso => iso ? new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("pt-PT") : "—";
const dataLonga = iso => new Date(iso + "T12:00:00").toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
const haDias = iso => { if (!iso) return "sem registo"; const d = L.diasEntre(iso, isoHoje()); return d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`; };
const iniciais = nome => (nome || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
const primeiro = nome => (nome || "").split(" ")[0];
const telHref = t => "tel:" + String(t).replace(/\s/g, "");
const ehGestor = () => sessao && sessao.perfil === "gestor";
const cliNome = ent => (S.clientes || []).find(c => String(c.id) === String(ent))?.Nome || ("Cliente " + ent);
const cliDe = ent => (S.clientes || []).find(c => String(c.id) === String(ent));
const ICON_TEL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';
const ICON_MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
const mailHref = e => "mailto:" + String(e).trim();

/* ---------- arranque e dados ---------- */
let rq = false;
function render() { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; renderAll(); }); }

function iniciarDados() {
  if (FONTE_DADOS === "rest") { Store = RestAdapter(API_BASE, () => (sessao && sessao.token) || ""); }
  else { Store = LocalAdapter("crm-calheiros-dados-v8"); }
  COLECOES.forEach(col => {
    Store.subscribe(col, rows => {
      RAW[col] = rows; loaded.add(col);
      S = L.visiveis(RAW, sessao);
      render();
    }, () => { });
  });
  render();
}

function terminarSessao() {
  try { localStorage.removeItem(CHAVE_SESSAO); } catch (_) { }
  location.reload();
}

/* ---------- render principal ---------- */
function renderAll() {
  const logado = !!sessao;
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "v-" + (logado ? tab : "login"));
  $(".nav").hidden = !logado; $("#meChip").hidden = !logado; $(".top").hidden = !logado;
  if (!logado) { vLogin($("#v-login")); return; }
  const navTab = TAB_PAI[tab] || tab;
  document.querySelectorAll(".nav [data-tab]").forEach(b => b.dataset.tab === navTab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  $("#meChip").innerHTML = `<span class="av">${esc(iniciais(meNome))}</span><span>${esc(primeiro(meNome))}</span>`;
  const ready = loaded.size === COLECOES.length;
  const el = $("#v-" + tab);
  if (!ready) { el.innerHTML = '<p class="loading">A carregar dados…</p>'; return; }
  ({ inicio: vInicio, clientes: vClientes, ferramentas: vFerramentas, artigos: vArtigos, cortantes: vCortantes, stock: vStock, tarefas: vTarefas, projetos: vProjetos, recebimentos: vRecebimentos, dashboards: vDashboards, feiras: vFeiras })[tab](el);
  if (sheetRender) sheetRender();
}

/* ---------- Login ---------- */
function vLogin(el) {
  const teste = FONTE_DADOS !== "rest" ? (window.UTILIZADORES_EXEMPLO || []) : [];
  el.innerHTML = `<div class="login">
    <img class="logo-img login-logo-img" src="logotipo.png" alt="Calheiros Embalagens" width="720" height="259">
    <p class="sub">CRM comercial. Entre com as suas credenciais.</p>
    <form id="frmLogin" novalidate>
      <div class="fld"><label for="lgEmail">Email</label><input id="lgEmail" name="email" type="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck="false" required></div>
      <div class="fld"><label for="lgPass">Palavra-passe</label><input id="lgPass" name="password" type="password" autocomplete="current-password" required></div>
      <p class="late login-erro" id="lgErro" hidden></p>
      <button class="btn pri login-btn" type="submit">Entrar</button>
    </form>
    ${teste.length ? `<div class="rec">
      <b>Protótipo: utilizadores de teste</b>
      <p class="muted nota" style="margin:4px 0 8px">Toque num nome para preencher as credenciais.</p>
      <div class="menu">${teste.map(u => `<button class="btn" type="button" data-act="lgTeste" data-v="${esc(u.email)}"><b>${esc(u.nome)}</b><span class="menu-s">${esc(PERFIS[u.perfil] || u.perfil)}, ${esc(u.email)}</span></button>`).join("")}</div>
    </div>` : ""}
  </div>`;
  const frm = $("#frmLogin"), erro = $("#lgErro");
  frm.onsubmit = async ev => {
    ev.preventDefault();
    if (!frm.checkValidity()) { frm.reportValidity(); return; }
    const btn = frm.querySelector("[type=submit]"); btn.disabled = true; erro.hidden = true;
    try {
      sessao = await Auth.login(frm.elements.email.value.trim(), frm.elements.password.value);
      try { localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao)); } catch (_) { }
      meNome = sessao.nome; tab = "inicio"; pesquisa = "";
      iniciarDados();
    } catch (e) {
      erro.textContent = e.message === "credenciais" ? "Email ou palavra-passe errados." : "Não foi possível ligar ao servidor. Tente outra vez.";
      erro.hidden = false; btn.disabled = false;
    }
  };
}

/* ---------- helpers de clientes ---------- */
function ultimaVisitaDe(ent) {
  const vs = (S.atividades || []).filter(a => a.tipo === "visita" && String(a.Entidade) === String(ent)).map(a => a.data).filter(Boolean).sort();
  return vs.length ? vs[vs.length - 1] : null;
}
function rowCliente(c, ult) {
  const sub = c.Localidade || c.CPLocalidade || c.DescricaoZona || "";
  return `<button class="row" data-ent="${esc(c.id)}">
    <span class="av">${esc(iniciais(c.Nome))}</span>
    <span class="grow"><span class="t">${esc(c.Nome)}</span><span class="s">${esc(sub)}</span></span>
    <span class="s">${ult ? haDias(ult) : "sem visita"}</span>
  </button>`;
}
function ligarPesquisa(sel) {
  const inp = $(sel); if (!inp) return;
  inp.oninput = () => { pesquisa = inp.value; const pos = inp.selectionStart; renderAll(); const n = $(sel); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) { } } };
}

/* ---------- Início ---------- */
function vInicio(el) {
  const hoje = isoHoje();
  const clientes = S.clientes || [];
  const ordenados = clientes.map(c => ({ c, ult: ultimaVisitaDe(c.id) }))
    .sort((a, b) => String(a.ult || "").localeCompare(String(b.ult || "")));
  const top = ordenados.slice(0, 6);
  // Pagamentos em atraso ou a vencer hoje (dentro do prazo não aparece aqui). Já vem ordenado.
  const atraso = L.recebimentosPorCliente(S.pendentes || [], hoje).filter(r => r.atrasado > 0 || r.venceHoje > 0);
  const totalAtraso = atraso.reduce((s, r) => s + r.atrasado, 0);
  const rg = L.recebimentosGeral(S.pendentes || [], hoje);
  const ag = L.agendaTarefas(S.atividades || [], hoje);
  const pend = (S.projetos || []).filter(p => p.Estado === "Pendente")
    .sort((a, b) => String(a.DataUltimaActividade || "").localeCompare(String(b.DataUltimaActividade || "")));
  const linhaAtraso = r => {
    const hoje0 = r.atrasado === 0 && r.venceHoje > 0;
    const cls = hoje0 ? "aviso" : "late";
    const txt = hoje0 ? "vence hoje" : `há ${r.maiorAtrasoDias} ${r.maiorAtrasoDias === 1 ? "dia" : "dias"} em atraso`;
    const val = hoje0 ? r.venceHoje : r.atrasado;
    return `<button class="row" data-ent="${esc(r.entidade)}">
      <span class="grow"><span class="t">${esc(cliNome(r.entidade))}</span><span class="s ${cls}">${txt}</span></span>
      <span class="v ${cls}">${eur2(val)}</span></button>`;
  };
  el.innerHTML = `
    <h1>Olá, ${esc(primeiro(meNome))}</h1>
    <p class="sub">${esc(dataLonga(hoje))}${ehGestor() ? ", toda a equipa" : ", a sua carteira"}</p>
    <button class="search" data-tab="clientes" style="text-align:left;color:var(--ink-2)">Procurar cliente…</button>
    <div class="kpis">
      <button class="kpi" data-tab="recebimentos"><b class="${totalAtraso ? "late" : ""}">${eur(totalAtraso)}</b><span>Pagamentos em atraso</span></button>
      <button class="kpi" data-tab="recebimentos"><b>${eur(rg.total)}</b><span>Total por receber</span></button>
      <button class="kpi" data-tab="projetos"><b>${pend.length}</b><span>Projetos pendentes</span></button>
      <button class="kpi" data-tab="tarefas"><b>${ag.aFazer.length + ag.porAlocar.length}</b><span>Tarefas a fazer</span></button>
    </div>
    <h2>Tarefas pendentes</h2>
    <div class="list">${(ag.porAlocar.length || ag.aFazer.length)
      ? ag.porAlocar.map(t => rowTarefa(t, true)).join("") + ag.aFazer.slice(0, 6).map(t => rowTarefa(t)).join("")
      : '<div class="empty">Sem tarefas pendentes.</div>'}</div>
    <h2>Pagamentos em atraso</h2>
    <div class="list">${atraso.length ? atraso.map(linhaAtraso).join("") : '<div class="empty">Sem pagamentos em atraso.</div>'}</div>
    <h2>Projetos pendentes <span class="muted" style="font-weight:400">(parados há mais tempo primeiro)</span></h2>
    <div class="list">${pend.length ? pend.map(rowProjeto).join("") : '<div class="empty">Sem projetos pendentes.</div>'}</div>
    <h2>Clientes sem contacto há mais tempo</h2>
    <div class="list">${top.length ? top.map(x => rowCliente(x.c, x.ult)).join("") : '<div class="empty">Sem clientes na carteira.</div>'}</div>`;
}

/* ---------- Clientes (lista + pesquisa) ---------- */
function vClientes(el) {
  const lista = L.pesquisaClientes(S.clientes || [], pesquisa);
  el.innerHTML = `
    <h1>Clientes</h1>
    <p class="sub">${(S.clientes || []).length} ${ehGestor() ? "clientes (toda a equipa)" : "na sua carteira"}</p>
    <input class="search" id="buscaCli" placeholder="Procurar por nome ou código…" value="${esc(pesquisa)}" autocomplete="off">
    <div class="list">${lista.length ? lista.map(c => rowCliente(c, ultimaVisitaDe(c.id))).join("") : '<div class="empty">Nenhum cliente encontrado.</div>'}</div>`;
  ligarPesquisa("#buscaCli");
}

/* ---------- Ficha do cliente ---------- */
function sheetCliente(ent) {
  openSheet(() => {
    const c = cliDe(ent);
    if (!c) { $("#sheet").innerHTML = `<div class="grab"></div><p class="empty">Cliente não encontrado.</p>`; return; }
    const f = L.fichaCliente(ent, S, isoHoje());
    const r = f.recebimentos;
    const escaloes = [["Não vencido", r.naoVencido, ""], ["Menos de 30 dias", r.d1a30, "b-a1"], ["30 a 60 dias", r.d31a60, "b-a2"], ["60 a 90 dias", r.d61a90, "b-a3"], ["Mais de 90 dias", r.maior90, "b-a3"]].filter(x => x[1] > 0);
    const seg = (S.seguroCredito || []).find(s => String(s.Cliente) === String(ent));
    const cc = L.creditoCliente(c, seg);
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>${esc(c.Nome)}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <dl class="facts">
        ${c.Vendedor ? `<dt>Vendedor</dt><dd>${esc(c.Vendedor)}</dd>` : ""}
        ${c.Telefone ? `<dt>Telefone</dt><dd><a href="${esc(telHref(c.Telefone))}">${esc(c.Telefone)}</a></dd>` : ""}
        ${(c.Localidade || c.CPLocalidade) ? `<dt>Localidade</dt><dd>${esc(c.Localidade || c.CPLocalidade)}</dd>` : ""}
        ${c.Contribuinte ? `<dt>NIF</dt><dd>${esc(c.Contribuinte)}</dd>` : ""}
      </dl>
      ${(c.Telefone || c.EMail) ? `<div class="actions">
        ${c.Telefone ? `<a class="btn apenas-telemovel" href="${esc(telHref(c.Telefone))}">${ICON_TEL} Ligar</a>` : ""}
        ${c.EMail ? `<a class="btn apenas-pc" href="${esc(mailHref(c.EMail))}">${ICON_MAIL} Email</a>` : ""}
      </div>` : ""}
      <div class="big">${eur(f.totalVendas)}</div>
      <p class="muted" style="margin:-6px 0 2px">Vendas em ${isoHoje().slice(0, 4)} (sem IVA)</p>
      <h2>Recebimentos</h2>
      <dl class="facts">
        <dt>Prazo de pagamento</dt><dd>${cc.prazoPagamento != null ? cc.prazoPagamento + " dias" : "—"}</dd>
        <dt>Limite de crédito</dt><dd>${cc.limiteCred != null ? eur(cc.limiteCred) : "—"}</dd>
        ${cc.disponivelSeguro != null ? `<dt>Disponível no seguro</dt><dd class="${cc.excedido ? "late" : ""}">${eur(cc.disponivelSeguro)}${cc.excedido ? " · limite excedido" : ""}</dd>` : ""}
      </dl>
      ${r.total > 0 ? `<div class="list">
          ${escaloes.map(([n, v]) => `<div class="row"><span class="grow"><span class="t">${n}</span></span><span class="v">${eur2(v)}</span></div>`).join("")}
          <div class="row"><span class="grow"><span class="t"><b>Total pendente</b></span></span><span class="v">${eur2(r.total)}</span></div>
        </div>`
        : `<p class="muted">Sem valores pendentes.</p>`}
      <h2>Projetos / orçamentos pendentes</h2>
      ${f.projetosPendentes.length ? `<div class="list">${f.projetosPendentes.map(p => `<div class="row"><span class="grow"><span class="t">${esc(p.DescricaoProjeto || ("Projeto " + p.Projeto))}</span><span class="s">${esc(p["ObservaçoesProjeto"] || "")}</span></span><span class="badge b-a1">${esc(p.Estado)}</span></div>`).join("")}</div>` : `<p class="muted">Nenhum.</p>`}
      <h2>Artigos produzidos</h2>
      ${f.artigos.length ? `<div class="list">${f.artigos.map(a => `<button class="row" data-act="orcArtigo" data-ent="${esc(ent)}" data-artigo="${esc(a.artigo)}">
          <span class="grow"><span class="t">${esc(a.descricao || a.artigo)}</span><span class="s">${esc(a.artigo)} · últ. produção ${a.ultimaProducao ? dataPT(a.ultimaProducao) : "—"} · ${unid(a.ultimaQuantidade)}</span></span>
          <span class="s">Orçamento ›</span></button>`).join("")}</div>` : `<p class="muted">Sem artigos produzidos.</p>`}
      <div class="actions">
        <button class="btn pri" data-act="orcCli" data-ent="${esc(ent)}">Pedir orçamento</button>
        <button class="btn" data-act="visitaCli" data-ent="${esc(ent)}">Registar visita</button>
      </div>
      <p class="muted">${f.ultimaVisita ? `Última visita: ${dataCompleta(f.ultimaVisita)} (${haDias(f.ultimaVisita)})` : "Sem visitas registadas."}</p>`;
  });
}

/* ---------- Dashboards ---------- */
function linhaVendaDash(r) {
  const temPct = r.variacaoPct != null;
  const txt = temPct ? `${r.variacaoPct >= 0 ? "▲" : "▼"} ${Math.round(Math.abs(r.variacaoPct) * 100)}%` : (r.atual > 0 ? "novo" : "");
  const cor = r.variacao > 0 ? "var(--ok)" : r.variacao < 0 ? "var(--danger)" : "var(--ink-2)";
  return `<button class="row" data-ent="${esc(r.entidade)}">
    <span class="grow"><span class="t">${esc(r.nome || cliNome(r.entidade))}</span><span class="s">${eur(r.atual)} · ano ant. ${eur(r.anterior)}</span></span>
    <span class="v" style="color:${cor}">${txt}</span></button>`;
}
/* ---------- Equipa: uma caixa por vendedor (só para o gestor) ---------- */
function cartaoVendedor(v) {
  const ano = new Date().getFullYear();
  const corVar = v.variacao > 0 ? "var(--ok)" : v.variacao < 0 ? "var(--danger)" : "var(--ink-2)";
  const seta = v.variacao > 0 ? "▲" : v.variacao < 0 ? "▼" : "•";
  const pct = v.variacaoPct != null ? `${Math.round(Math.abs(v.variacaoPct) * 100)}%` : eur(Math.abs(v.variacao));
  const cel = (act, n, lbl, cls) => act
    ? `<button class="kpi" data-act="${act}" data-id="${esc(v.vendedor)}"><b class="${cls || ""}">${n}</b><span>${lbl}</span></button>`
    : `<div class="kpi"><b class="${cls || ""}">${n}</b><span>${lbl}</span></div>`;
  return `<section class="rec rec-vend">
    <div class="rec-vh">
      <span class="t">${esc(v.vendedor)}</span>
      <span class="vv"><b>${eur(v.vendas2026)}</b> <span style="color:${corVar}">${seta} ${pct}</span> <span class="muted">· ${ano - 1} ${eur(v.vendas2025)}</span></span>
    </div>
    <div class="kpis-c" style="grid-template-columns:repeat(3,1fr) 1.35fr 1.35fr">
      ${cel("vendAtivos", v.ativos.length, "Ativos")}
      ${cel("vendNovos", v.novos.length, "Novos")}
      ${cel("vendPerdidos", v.perdidos.length, "Perdidos", v.perdidos.length ? "late" : "")}
      ${cel(null, eur(v.pendente), "Pendente")}
      ${cel(null, eur(v.atraso), "Em atraso", v.atraso > 0 ? "late" : "")}
    </div>
  </section>`;
}
function secaoVendedores() {
  const dv = L.dashboardVendedores(S.vendas || [], S.clientes || [], S.pendentes || [], isoHoje());
  if (!dv.length) return "";
  const tot = dv.reduce((a, v) => ({ v26: a.v26 + v.vendas2026, v25: a.v25 + v.vendas2025, pend: a.pend + v.pendente, atr: a.atr + v.atraso, novos: a.novos + v.novos.length, perd: a.perd + v.perdidos.length }), { v26: 0, v25: 0, pend: 0, atr: 0, novos: 0, perd: 0 });
  const varT = tot.v26 - tot.v25, corT = varT > 0 ? "var(--ok)" : varT < 0 ? "var(--danger)" : "var(--ink-2)";
  return `<h2>Equipa — por vendedor</h2>
    ${dv.map(cartaoVendedor).join("")}
    <p class="muted nota" style="margin-top:10px">Equipa: <b style="color:${corT}">${eur(tot.v26)}</b> em ${new Date().getFullYear()} vs ${eur(tot.v25)} em ${new Date().getFullYear() - 1} · ${tot.novos} novos · ${tot.perd} perdidos · pendente ${eur(tot.pend)} · atraso ${eur(tot.atr)}</p>`;
}
// drill-down: lista dos clientes novos/perdidos de um vendedor, com as suas vendas
function sheetClientesVend(vendedor, tipo) {
  openSheet(() => {
    const dv = L.dashboardVendedores(S.vendas || [], S.clientes || [], S.pendentes || [], isoHoje());
    const v = dv.find(x => x.vendedor === vendedor);
    const lista = v ? (tipo === "ativos" ? v.ativos : tipo === "novos" ? v.novos : v.perdidos) : [];
    const titulo = tipo === "ativos" ? "Clientes ativos" : tipo === "novos" ? "Clientes novos" : "Clientes perdidos";
    const nota = tipo === "ativos" ? `com vendas em ${new Date().getFullYear()}` : tipo === "novos" ? `vendas em ${new Date().getFullYear()} e nada em ${new Date().getFullYear() - 1}` : `vendas em ${new Date().getFullYear() - 1} e nada em ${new Date().getFullYear()}`;
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>${titulo}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <p class="muted">${esc(vendedor)} · ${lista.length} ${lista.length === 1 ? "cliente" : "clientes"} <span style="font-weight:400">(${nota})</span></p>
      <div class="list" style="margin-top:12px">${lista.length ? lista.map(linhaVendaDash).join("") : `<div class="empty">Nenhum.</div>`}</div>`;
  });
}

function vDashboards(el) {
  const dc = L.dashboardClientes(S.vendas || [], isoHoje());
  const rp = L.resumoProjetos(S.projetos || []);
  const rg = L.recebimentosGeral(S.pendentes || [], isoHoje());
  const termo = L.normaliza(pesquisa);
  const comVendas = dc.linhas.filter(r => r.atual > 0 || r.anterior > 0).sort((a, b) => b.atual - a.atual);
  // com pesquisa: procura em todos os clientes; sem pesquisa: mostra o top 25
  const vendas = termo ? comVendas.filter(r => L.normaliza(r.nome || cliNome(r.entidade)).includes(termo)) : comVendas.slice(0, 25);
  const listaSimples = (arr, campo, etiqueta) => arr.length
    ? `<div class="list">${arr.map(r => `<button class="row" data-ent="${esc(r.entidade)}"><span class="grow"><span class="t">${esc(r.nome || cliNome(r.entidade))}</span><span class="s">${etiqueta} ${eur(r[campo])}</span></span></button>`).join("")}</div>`
    : '<div class="empty">Nenhum.</div>';
  el.innerHTML = `
    <h1>Dashboards</h1>
    <p class="sub">${ehGestor() ? "Toda a equipa" : "A sua carteira"} · ${dc.ano} vs ${dc.anoAnterior}</p>

    ${ehGestor() ? secaoVendedores() : ""}

    <div class="sec-h"><h2>Recebimentos</h2><button class="linkbtn" data-tab="recebimentos">Ver tudo ›</button></div>
    <div class="kpis" style="grid-template-columns:repeat(2,1fr)">
      <button class="kpi" data-tab="recebimentos"><b>${eur(rg.total)}</b><span>Total pendente</span></button>
      <button class="kpi" data-tab="recebimentos"><b>${eur(rg.d61a90 + rg.maior90)}</b><span>+60 dias de atraso</span></button>
    </div>

    <div class="sec-h"><h2>Projetos</h2><button class="linkbtn" data-tab="projetos">Ver tudo ›</button></div>
    <div class="kpis">
      <button class="kpi" data-tab="projetos"><b>${rp["Não Aceite"]}</b><span>Não aceites</span></button>
      <button class="kpi" data-tab="projetos"><b>${rp.Pendente}</b><span>Pendentes</span></button>
      <button class="kpi" data-tab="projetos"><b>${rp.Aceite}</b><span>Aceites</span></button>
      <button class="kpi" data-tab="projetos"><b>${rp.Anulado}</b><span>Anulados</span></button>
    </div>

    <h2>Vendas por cliente · ${dc.ano} vs ${dc.anoAnterior}</h2>
    <input class="search" id="buscaDash" placeholder="Procurar cliente…" value="${esc(pesquisa)}" autocomplete="off">
    ${termo ? `<p class="muted" style="margin:-4px 0 8px;font-size:13px">${vendas.length} cliente(s) encontrado(s)</p>` : ""}
    <div class="list">${vendas.length ? vendas.map(linhaVendaDash).join("") : `<div class="empty">${termo ? "Nenhum cliente encontrado." : "Sem vendas."}</div>`}</div>

    <h2>Clientes perdidos <span class="muted" style="font-weight:400">(sem compras em ${dc.ano})</span></h2>
    ${listaSimples(dc.perdidos, "anteriorFull", "Ano anterior:")}

    <h2>Clientes novos / reconquistados</h2>
    ${listaSimples(dc.novos, "atual", "Este ano:")}`;
  ligarPesquisa("#buscaDash");
}

/* ---------- Ferramentas (hub) ---------- */
function vFerramentas(el) {
  const nArt = (S.artigos || []).length;
  const nCort = (S.cortantes || []).length;
  const nProj = (S.projetos || []).length;
  const nReceb = L.recebimentosPorCliente(S.pendentes || [], isoHoje()).length;
  const nStock = L.listaStock(S.stock || []).length;
  const ag = L.agendaTarefas(S.atividades || [], isoHoje());
  const atalho = (tabv, titulo, sub) => `<button class="btn atalho" data-tab="${tabv}"><b>${titulo}</b><span class="menu-s">${sub}</span></button>`;
  el.innerHTML = `
    <h1>Ferramentas</h1>
    <p class="sub">${ehGestor() ? "Toda a equipa" : "A sua carteira"}</p>
    <div class="atalhos">
      ${atalho("artigos", "Artigos", `${nArt} artigos · ficha técnica e última produção`)}
      ${atalho("cortantes", "Cortantes", `${nCort} cortantes · por tipo de caixa ou medidas`)}
      ${atalho("stock", "Stock", `${nStock} artigos com stock · por armazém e lote`)}
      ${atalho("tarefas", "Tarefas e calendário", `${ag.aFazer.length + ag.porAlocar.length} a fazer${ag.atrasadas ? " · " + ag.atrasadas + " atrasadas" : ""}${ag.porAlocar.length ? " · " + ag.porAlocar.length + " por alocar" : ""}`)}
      ${atalho("projetos", "Projetos", `${nProj} · pipeline por estado`)}
      ${atalho("recebimentos", "Recebimentos", `${nReceb} clientes · avisos de atraso`)}
      ${atalho("feiras", "Feiras", `${(S.feiras || []).length} ${ehGestor() ? "· atribuir e avaliar relatórios" : "atribuídas a si"}`)}
    </div>`;
}

/* ---------- Cortantes / tipos de caixa ---------- */
function rowCortante(c, nota) {
  const medidas = [c.FTCXA, c.FTCXB, c.FTCXC].filter(v => v != null && v !== 0);
  return `<button class="row" data-act="verCortante" data-id="${esc(c.id)}">
    <span class="grow"><span class="t">${esc(c.TipoCaixaDescricao1 || c.TipoCaixa || ("Cortante " + c.Codigo))}</span><span class="s">${esc(c.Codigo)}${medidas.length ? " · " + medidas.join("×") + " mm" : ""}${nota ? ` · <span class="cort-troca">${esc(nota)}</span>` : ""}</span></span>
    <span class="s">${c.Exemplares ? c.Exemplares + " exempl." : ""}</span>
  </button>`;
}
function vCortantes(el) {
  const tipos = [...new Set((S.cortantes || []).map(c => c.TipoCaixaDescricao1).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt"));
  const temMedidas = ["A", "B", "C"].some(k => +cortMedidas[k] > 0);
  const aplicaFiltros = l => {
    let r = cortTipo ? l.filter(c => c.TipoCaixaDescricao1 === cortTipo) : l;
    return L.pesquisaCortantes(r, pesquisa);
  };
  // combina medidas (±5 mm, posicional ou cruzada) com tipo de caixa e texto
  let lista;
  let trocadas = new Set();
  if (temMedidas) {
    lista = aplicaFiltros(L.cortantesPorMedidas(S.cortantes || [], cortMedidas, 5, cortCruzada));
    if (cortCruzada) {
      // marca os que só aparecem por cruzar medidas (não encaixam na posição original)
      const posId = new Set(L.cortantesPorMedidas(S.cortantes || [], cortMedidas, 5, false).map(c => c.id));
      lista.forEach(c => { if (!posId.has(c.id)) trocadas.add(c.id); });
    }
  } else {
    lista = aplicaFiltros((S.cortantes || []).slice()).sort((a, b) => String(a.Codigo || "").localeCompare(String(b.Codigo || ""), undefined, { numeric: true }));
  }
  // type="text" (não "number"): inputs number não suportam setSelectionRange, e ao
  // re-desenhar a cada tecla o cursor saltava para o início ("200" ficava "002").
  const medInput = (k, lbl) => `<label>${lbl}<input id="cortM${k}" type="text" inputmode="numeric" value="${esc(cortMedidas[k])}" placeholder="mm" autocomplete="off"></label>`;
  const medResumo = ["A", "B", "C"].map(k => cortMedidas[k]).filter(v => +v > 0).join("×");
  const segCruz = (val, txt) => `<button data-act="cortCruzada" data-v="${val}" aria-pressed="${cortCruzada === val}">${txt}</button>`;
  el.innerHTML = `
    <button class="voltar" data-tab="ferramentas">‹ Ferramentas</button>
    <h1>Cortantes</h1>
    <p class="sub">${(S.cortantes || []).length} cortantes / tipos de caixa</p>
    <input class="search" id="buscaCort" placeholder="Procurar por código, tipo de caixa…" value="${esc(pesquisa)}" autocomplete="off">
    <select id="cortTipo" class="search" style="margin-top:8px"><option value="">Todos os tipos de caixa</option>${tipos.map(t => `<option value="${esc(t)}"${t === cortTipo ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>
    <p class="spec-t" style="margin:14px 0 0">Procurar por medidas (±5 mm)</p>
    <p class="muted" style="margin:2px 0 6px;font-size:12px">Comprimento, largura e altura da caixa/artigo, em mm. Preencha as que souber.</p>
    <div class="medidas-bar">${medInput("A", "Comp.")}${medInput("B", "Larg.")}${medInput("C", "Alt.")}</div>
    <div class="seg" style="margin-top:10px">${segCruz(false, "Posição exata")}${segCruz(true, "Cruzar medidas")}</div>
    ${cortCruzada ? `<p class="muted" style="margin:6px 0 0;font-size:12px">Cruza comprimento, largura e altura em qualquer ordem (a mesma caixa pode ir noutra orientação).</p>` : ""}
    ${temMedidas ? `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:8px">
      <p class="muted" style="margin:0;font-size:13px">${lista.length} cortante(s) a ±5 mm de ${esc(medResumo)} mm${cortCruzada ? ", a cruzar medidas" : ""}</p>
      <button class="linkbtn" data-act="cortLimparMedidas">Limpar medidas</button>
    </div>` : ""}
    <div class="list" style="margin-top:10px">${lista.length ? lista.map(c => rowCortante(c, trocadas.has(c.id) ? "orientação trocada" : "")).join("") : `<div class="empty">${temMedidas ? "Nenhum cortante com essas medidas (±5 mm)." : "Nenhum cortante encontrado."}</div>`}</div>`;
  ligarPesquisa("#buscaCort");
  const selT = $("#cortTipo"); if (selT) selT.onchange = () => { cortTipo = selT.value; renderAll(); };
  ["A", "B", "C"].forEach(k => {
    const inp = $("#cortM" + k); if (!inp) return;
    inp.oninput = () => { cortMedidas[k] = inp.value; const pos = inp.selectionStart; renderAll(); const n = $("#cortM" + k); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (_) { } } };
  });
}
function sheetCortante(id) {
  openSheet(() => {
    const c = (S.cortantes || []).find(x => String(x.id) === String(id));
    if (!c) { $("#sheet").innerHTML = `<div class="grab"></div><p class="empty">Cortante não encontrado.</p>`; return; }
    const medidas = [["A (comprimento)", c.FTCXA], ["B (largura)", c.FTCXB], ["C (altura)", c.FTCXC], ["D (aba)", c.FTCXD]].filter(x => x[1] != null && x[1] !== 0);
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>${esc(c.TipoCaixaDescricao1 || c.TipoCaixa || ("Cortante " + c.Codigo))}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <dl class="facts">
        <dt>Código</dt><dd>${esc(c.Codigo)}</dd>
        ${c.TipoCaixa || c.TipoCaixaDescricao1 ? `<dt>Tipo de caixa</dt><dd>${esc([c.TipoCaixaDescricao1, c.TipoCaixa].filter(Boolean).join(" · "))}</dd>` : ""}
        ${c.Exemplares ? `<dt>Exemplares</dt><dd>${esc(c.Exemplares)}</dd>` : ""}
      </dl>
      ${medidas.length ? `<p class="spec-t">Medidas (mm)</p><dl class="facts">${medidas.map(([n, v]) => `<dt>${n}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}`;
  });
}

/* ---------- Stock por artigo (PR_TABLET_ListaStock_PA) ---------- */
function rowStock(a) {
  return `<button class="row" data-act="verStock" data-id="${esc(a.artigo)}">
    <span class="grow"><span class="t">${esc(a.descricao || a.artigo)}</span><span class="s">${esc(a.artigo)} · ${esc(a.clienteNome || cliNome(a.codCliente))}</span></span>
    <span class="v">${unid(a.total)}</span>
  </button>`;
}
function vStock(el) {
  const lista = L.listaStock(S.stock || []);
  const termo = L.normaliza(pesquisa);
  const filt = (termo ? lista.filter(a => L.normaliza([a.descricao, a.artigo, a.clienteNome].filter(Boolean).join(" ")).includes(termo)) : lista)
    .sort((a, b) => b.total - a.total);
  const totalGeral = filt.reduce((s, a) => s + a.total, 0);
  el.innerHTML = `
    <button class="voltar" data-tab="ferramentas">‹ Ferramentas</button>
    <h1>Stock</h1>
    <p class="sub">${lista.length} artigos com stock · ${unid(totalGeral)}${ehGestor() ? " (toda a equipa)" : " (sua carteira)"}</p>
    <input class="search" id="buscaStock" placeholder="Procurar artigo ou cliente…" value="${esc(pesquisa)}" autocomplete="off">
    <div class="list">${filt.length ? filt.map(rowStock).join("") : '<div class="empty">Sem stock.</div>'}</div>`;
  ligarPesquisa("#buscaStock");
}
function sheetStock(artigo) {
  openSheet(() => {
    const a = L.listaStock(S.stock || []).find(x => String(x.artigo) === String(artigo));
    if (!a) { $("#sheet").innerHTML = `<div class="grab"></div><p class="empty">Artigo sem stock.</p>`; return; }
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>${esc(a.descricao || a.artigo)}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <dl class="facts">
        <dt>Artigo</dt><dd>${esc(a.artigo)}</dd>
        <dt>Cliente</dt><dd>${esc(a.clienteNome || cliNome(a.codCliente))}</dd>
      </dl>
      <div class="big">${unid(a.total)}</div>
      <p class="muted" style="margin:-6px 0 2px">Stock total</p>
      <h2>Por armazém / lote</h2>
      <div class="list">${a.linhas.map(l => `<div class="row"><span class="grow"><span class="t">${esc(l.Lote || "—")}</span><span class="s">Armazém ${esc(l.Armazem || "—")}</span></span><span class="v">${unid(l.StkActual)}</span></div>`).join("")}</div>
      <div class="actions"><button class="btn pri" data-act="orcArtigo" data-ent="${esc(a.codCliente)}" data-artigo="${esc(a.artigo)}">Pedir orçamento deste artigo</button></div>`;
  });
}

/* ---------- Tarefas / agenda ---------- */
function rowTarefa(t, porAlocar) {
  const atras = !t.concluida && t.data && t.data < isoHoje();
  const cli = t.Entidade ? cliNome(t.Entidade) : "";
  const meta = porAlocar ? "pendente de alocar" : (t.data ? dataPT(t.data) : "");
  const sub = [cli, meta].filter(Boolean).join(" · ");
  const fb = t.concluida && t.resultadoNotas ? `<span class="s" style="display:block">${esc(t.resultado || "Concluída")}: ${esc(t.resultadoNotas)}</span>` : "";
  return `<div class="row ${t.concluida ? "done" : ""}">
    <button class="check ${t.concluida ? "on" : ""}" data-act="toggleTarefa" data-id="${esc(t.id)}" aria-label="${t.concluida ? "Reabrir" : "Concluir"}"></button>
    <span class="grow"><span class="t">${esc(t.descricao || "Tarefa")}</span><span class="s ${atras || porAlocar ? "late" : ""}">${esc(sub)}${atras ? " · atrasada" : ""}</span>${fb}</span>
    ${porAlocar ? `<button class="btn mini" data-act="alocarData" data-id="${esc(t.id)}">Alocar data</button>` : ""}
    ${t.Vendedor && ehGestor() ? `<span class="s">${esc(primeiro(t.Vendedor))}</span>` : ""}
  </div>`;
}
/* Vista (mês/lista), mês mostrado e filtro por vendedor (só a Gestão usa). */
let tarefaVista = "mes";
let tarefaVend = "";   // "" = todos os vendedores
let calAno = null, calMes = null;
function calInit() { if (calAno == null) { const h = isoHoje(); calAno = +h.slice(0, 4); calMes = +h.slice(5, 7); } }
function calNav(delta) { calInit(); let m = calMes + delta, a = calAno; if (m < 1) { m = 12; a--; } if (m > 12) { m = 1; a++; } calMes = m; calAno = a; renderAll(); }

function estadoTarefa(t) { return t.tipo === "reuniao" ? "reuniao" : (t.concluida ? "done" : (t.data && t.data < isoHoje() ? "late" : "ok")); }

function calendarioHTML(cal, mostrarVend) {
  const dias = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const cel = c => {
    // Na Gestão (sem filtro), cada tarefa mostra o nome do vendedor, para se
    // saber de quem é cada uma no calendário.
    const chips = c.tarefas.slice(0, 3).map(t => {
      if (t.tipo === "reuniao") {
        const lbl = (t.hora ? t.hora + " " : "") + (t.titulo || t.descricao || "Reunião");
        return `<span class="cal-chip reuniao">${esc(lbl)}</span>`;
      }
      const quem = mostrarVend && t.Vendedor ? `<b>${esc(primeiro(t.Vendedor))}:</b> ` : "";
      return `<span class="cal-chip ${estadoTarefa(t)}">${quem}${esc(t.descricao || "")}</span>`;
    }).join("");
    const mais = c.tarefas.length > 3 ? `<span class="cal-mais">+${c.tarefas.length - 3}</span>` : "";
    return `<button class="cal-cell ${c.fora ? "fora" : ""} ${c.hoje ? "hoje" : ""}" data-act="verDia" data-id="${c.iso}">
      <span class="cal-dia">${c.dia}</span>${chips}${mais}</button>`;
  };
  return `<div class="cal-nav"><button class="btn mini" data-act="calPrev" aria-label="Mês anterior">‹</button><b>${esc(cal.label)}</b><button class="btn mini" data-act="calNext" aria-label="Mês seguinte">›</button></div>
    <div class="cal-dow">${dias.map(d => `<span>${d}</span>`).join("")}</div>
    <div class="cal-grid">${cal.semanas.map(sem => sem.map(cel).join("")).join("")}</div>`;
}

function rowReuniao(r) {
  const quem = r.equipa ? "Toda a equipa" : (r.participantes || []).map(primeiro).join(", ");
  const quando = dataPT(r.data) + (r.hora ? " · " + esc(r.hora) : "");
  return `<div class="row reuniao-row"><span class="dot-reuniao"></span>
    <span class="grow"><span class="t">${esc(r.titulo || "Reunião")}</span><span class="s">${quando} · ${esc(quem)}${r.descricao ? " · " + esc(r.descricao) : ""}</span></span></div>`;
}

function listaTarefasHTML(ag, agruparPorVend, reunioes) {
  const reunHTML = (reunioes && reunioes.length)
    ? `<h2>Reuniões</h2><div class="list">${reunioes.map(rowReuniao).join("")}</div>` : "";
  let aFazerHTML;
  if (ag.aFazer.length === 0) {
    aFazerHTML = '<div class="empty">Sem tarefas agendadas.</div>';
  } else if (agruparPorVend) {
    // Gestão, sem filtro: agrupa "A fazer" por vendedor, com cabeçalho por pessoa.
    aFazerHTML = L.agruparTarefasPorVendedor(ag.aFazer).map(g =>
      `<h3 class="grupo-vend">${esc(g.vendedor)} <span class="muted" style="font-weight:400">(${g.tarefas.length})</span></h3>
       <div class="list">${g.tarefas.map(t => rowTarefa(t)).join("")}</div>`).join("");
  } else {
    aFazerHTML = `<div class="list">${ag.aFazer.map(t => rowTarefa(t)).join("")}</div>`;
  }
  return `${reunHTML}
    <h2>A fazer</h2>
    ${aFazerHTML}
    ${ag.concluidas.length ? `<h2>Concluídas</h2><div class="list">${ag.concluidas.slice(0, 20).map(t => rowTarefa(t)).join("")}</div>` : ""}`;
}

function vTarefas(el) {
  calInit();
  // A Gestão pode filtrar por vendedor. O vendedor vê sempre só as suas.
  const souGestor = ehGestor();
  const filtro = souGestor ? tarefaVend : "";
  // Ao filtrar por vendedor, inclui também as reuniões em que ele participa.
  const ativ = filtro
    ? (S.atividades || []).filter(a => a.Vendedor === filtro || (a.tipo === "reuniao" && (a.equipa || (a.participantes || []).includes(filtro))))
    : (S.atividades || []);
  const ag = L.agendaTarefas(ativ, isoHoje());
  const totalAfazer = ag.aFazer.length + ag.porAlocar.length;
  // Reuniões futuras (para a vista de lista), ordenadas por data.
  const reunioes = ativ.filter(a => a.tipo === "reuniao" && a.data >= isoHoje())
    .sort((a, b) => String(a.data + (a.hora || "")).localeCompare(String(b.data + (b.hora || ""))));
  // Agrupa por vendedor na lista só quando é a Gestão e não há filtro escolhido.
  const agrupar = souGestor && !filtro;
  const corpo = tarefaVista === "mes"
    ? calendarioHTML(L.calendarioMes(ativ, calAno, calMes, isoHoje()), agrupar)
    : listaTarefasHTML(ag, agrupar, reunioes);
  // Chips de filtro por vendedor (só a Gestão).
  const chipsVend = souGestor ? `<div class="filtro-vend">
      <button class="chip-vend ${!tarefaVend ? "on" : ""}" data-act="tarefaVend" data-v="">Todos</button>
      ${(S.vendedores || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome))).map(v =>
        `<button class="chip-vend ${tarefaVend === v.nome ? "on" : ""}" data-act="tarefaVend" data-v="${esc(v.nome)}">${esc(primeiro(v.nome))}</button>`).join("")}
    </div>` : "";
  el.innerHTML = `
    <button class="voltar" data-tab="ferramentas">‹ Ferramentas</button>
    <h1>Tarefas e calendário</h1>
    <p class="sub">${totalAfazer} a fazer${ag.atrasadas ? ` · ${ag.atrasadas} atrasadas` : ""}${ag.porAlocar.length ? ` · ${ag.porAlocar.length} por alocar` : ""}${souGestor ? (filtro ? " · " + esc(filtro) : " (toda a equipa)") : ""}</p>
    <div class="tar-top">
      <div class="seg"><button class="seg-b ${tarefaVista === "mes" ? "on" : ""}" data-act="vista" data-v="mes">Mês</button><button class="seg-b ${tarefaVista === "lista" ? "on" : ""}" data-act="vista" data-v="lista">Lista</button></div>
      <div class="tar-acts"><button class="btn" data-act="novaReuniao">+ Reunião</button><button class="btn pri" data-act="novaTarefa">+ Nova tarefa</button></div>
    </div>
    ${chipsVend}
    ${ag.porAlocar.length ? `<h2>Banco de tarefas <span class="muted" style="font-weight:400">(pendente de alocar)</span></h2>
    <div class="list banco-tarefas">${agrupar ? L.agruparTarefasPorVendedor(ag.porAlocar).map(g => `<h3 class="grupo-vend">${esc(g.vendedor)} <span class="muted" style="font-weight:400">(${g.tarefas.length})</span></h3><div class="list">${g.tarefas.map(t => rowTarefa(t, true)).join("")}</div>`).join("") : ag.porAlocar.map(t => rowTarefa(t, true)).join("")}</div>` : ""}
    ${corpo}`;
}

/* Folha de um dia do calendário: lista as tarefas desse dia + criar nova nesse dia. */
function sheetDia(iso) {
  openSheet(() => {
    const dia = (S.atividades || []).filter(a => (a.tipo === "tarefa" || a.tipo === "reuniao") && a.data === iso);
    const linhas = dia.length ? dia.map(t => {
      if (t.tipo === "reuniao") return rowReuniao(t);
      const st = estadoTarefa(t);
      const fb = t.concluida && t.resultadoNotas ? ` · ${esc(t.resultado || "Concluída")}: ${esc(t.resultadoNotas)}` : "";
      return `<div class="row ${t.concluida ? "done" : ""}">
        <button class="check ${t.concluida ? "on" : ""}" data-act="toggleTarefa" data-id="${esc(t.id)}" aria-label="${t.concluida ? "Reabrir" : "Concluir"}"></button>
        <span class="grow"><span class="t">${esc(t.descricao || "Tarefa")}</span><span class="s ${st === "late" ? "late" : ""}">${esc(t.Entidade ? cliNome(t.Entidade) : "")}${fb}</span></span>
        ${!t.concluida ? `<button class="btn mini" data-act="alocarData" data-id="${esc(t.id)}">Reagendar</button>` : ""}
        ${t.Vendedor && ehGestor() ? `<span class="s">${esc(primeiro(t.Vendedor))}</span>` : ""}
      </div>`;
    }).join("") : '<div class="empty">Sem nada neste dia.</div>';
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3 style="text-transform:capitalize">${dataCompleta(iso)}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <div class="list">${linhas}</div>
      <div class="actions"><button class="btn" data-act="novaReuniaoDia" data-id="${iso}">+ Reunião</button><button class="btn pri" data-act="novaTarefaDia" data-id="${iso}">+ Nova tarefa</button></div>`;
  });
}
async function toggleTarefa(id) {
  const t = (S.atividades || []).find(a => String(a.id) === String(id));
  if (!t || !Store) return;
  // Concluir obriga a feedback → abre formulário. Reabrir é direto.
  if (!t.concluida) { if (typeof formConcluirTarefa === "function") formConcluirTarefa(id); return; }
  try { await Store.update("atividades", id, { concluida: false, concluidaEm: null }); }
  catch (e) { toast("Não foi possível guardar."); }
}

/* ---------- Feiras ---------- */
function rowFeira(f) {
  const av = L.avaliacaoFeira(S.relatoriosFeira || [], f.id);
  const nV = (f.vendedores || []).length;
  const periodo = f.dataInicio ? dataPT(f.dataInicio) + (f.dataFim ? "–" + dataPT(f.dataFim) : "") : "";
  const sub = [f.local, periodo].filter(Boolean).join(" · ");
  const badge = ehGestor()
    ? `<span class="s">${av.nRelatorios}/${nV} relat.${av.media != null ? " · ⭐" + av.media : ""}</span>`
    : "";
  return `<button class="row" data-act="verFeira" data-id="${esc(f.id)}">
    <span class="grow"><span class="t">${esc(f.nome)}${f.edicao ? " " + esc(f.edicao) : ""}</span><span class="s">${esc(sub)}</span></span>
    ${badge}</button>`;
}
function vFeiras(el) {
  const feiras = (S.feiras || []).slice().sort((a, b) => String(b.dataInicio || "").localeCompare(String(a.dataInicio || "")));
  el.innerHTML = `
    <button class="voltar" data-tab="ferramentas">‹ Ferramentas</button>
    <h1>Feiras</h1>
    <p class="sub">${feiras.length} ${feiras.length === 1 ? "feira" : "feiras"}${ehGestor() ? " (toda a equipa)" : " atribuídas a si"}</p>
    ${ehGestor() ? `<div class="actions" style="margin:8px 0 14px"><button class="btn pri" data-act="novaFeira">+ Nova feira</button></div>` : ""}
    <div class="list">${feiras.length ? feiras.map(rowFeira).join("") : '<div class="empty">Sem feiras.</div>'}</div>`;
}
function sheetFeira(id) {
  openSheet(() => {
    const f = (S.feiras || []).find(x => String(x.id) === String(id));
    if (!f) { closeSheet(); return; }
    const reps = (S.relatoriosFeira || []).filter(r => String(r.feiraId) === String(f.id));
    const av = L.avaliacaoFeira(S.relatoriosFeira || [], f.id);
    const periodo = f.dataInicio ? dataCompleta(f.dataInicio) + (f.dataFim ? " a " + dataCompleta(f.dataFim) : "") : "—";
    const meuRel = reps.find(r => r.Vendedor === meNome);
    const linhasVend = (f.vendedores || []).map(v => {
      const r = reps.find(x => x.Vendedor === v);
      return `<div class="row"><span class="grow"><span class="t">${esc(v)}</span><span class="s ${r ? "" : "late"}">${r ? ("Relatório entregue" + (r.classificacao ? " · ⭐" + esc(r.classificacao) : "")) : "Sem relatório"}</span></span>${(ehGestor() && r) ? `<button class="btn mini" data-act="verRelatorio" data-id="${esc(r.id)}">Ver</button>` : ""}</div>`;
    }).join("");
    const acoesVend = (!ehGestor() && (f.vendedores || []).includes(meNome))
      ? `<div class="actions"><button class="btn pri" data-act="preencherRelatorio" data-id="${esc(f.id)}">${meuRel ? "Ver / editar o meu relatório" : "Preencher relatório"}</button></div>` : "";
    const acoesGestor = ehGestor()
      ? `<div class="actions"><button class="btn" data-act="editarFeira" data-id="${esc(f.id)}">Editar / atribuir</button><button class="btn pri" data-act="avaliarFeira" data-id="${esc(f.id)}">Avaliação (${av.nRelatorios}/${(f.vendedores || []).length})</button></div>` : "";
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>${esc(f.nome)}${f.edicao ? " " + esc(f.edicao) : ""}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <dl class="facts">
        <dt>Local</dt><dd>${esc(f.local || "—")}</dd>
        <dt>Datas</dt><dd>${esc(periodo)}</dd>
        ${f.notas ? `<dt>Notas</dt><dd>${esc(f.notas)}</dd>` : ""}
      </dl>
      <p class="spec-t">Vendedores atribuídos</p>
      <div class="list">${linhasVend || '<div class="empty">Ninguém atribuído.</div>'}</div>
      ${acoesVend}${acoesGestor}`;
  });
}
function sheetAvaliacaoFeira(id) {
  openSheet(() => {
    const f = (S.feiras || []).find(x => String(x.id) === String(id));
    if (!f) { closeSheet(); return; }
    const reps = (S.relatoriosFeira || []).filter(r => String(r.feiraId) === String(f.id));
    const av = L.avaliacaoFeira(S.relatoriosFeira || [], f.id);
    const cards = reps.map(r => `<div class="row"><span class="grow"><span class="t">${esc(r.Vendedor)}${r.classificacao ? " · ⭐" + esc(r.classificacao) : ""}</span><span class="s">${esc(r.comentariosFinais || "")}</span></span><button class="btn mini" data-act="verRelatorio" data-id="${esc(r.id)}">Abrir</button></div>`).join("");
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>Avaliação · ${esc(f.nome)}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <div class="kpis" style="margin-bottom:12px">
        <div class="kpi"><b>${av.nRelatorios}/${(f.vendedores || []).length}</b><span>Relatórios</span></div>
        <div class="kpi"><b>${av.media != null ? "⭐ " + av.media : "—"}</b><span>Classificação média</span></div>
      </div>
      <div class="list">${cards || '<div class="empty">Ainda sem relatórios.</div>'}</div>`;
  });
}
function sheetRelatorio(id) {
  openSheet(() => {
    const r = (S.relatoriosFeira || []).find(x => String(x.id) === String(id));
    if (!r) { closeSheet(); return; }
    const arr = v => Array.isArray(v) ? v.filter(Boolean).join(", ") : (v || "");
    const linha = (dt, v) => v && String(v).trim() ? `<dt>${esc(dt)}</dt><dd>${esc(String(v))}</dd>` : "";
    const concs = [1, 2, 3].map(i => r["conc" + i + "Nome"] ? `${r["conc" + i + "Nome"]}${r["conc" + i + "Pais"] ? " (" + r["conc" + i + "Pais"] + ")" : ""}` : "").filter(Boolean);
    const nContactos = [1, 2, 3, 4, 5].filter(i => r["cont" + i + "Empresa"] || r["cont" + i + "Nome"]).length;
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>Relatório · ${esc(r.feiraNome || "")}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <dl class="facts">
        ${linha("Comercial", r.comercial || r.Vendedor)}
        ${linha("Data do relatório", r.dataRelatorio ? dataPT(r.dataRelatorio) : "")}
        ${linha("Classificação", r.classificacao ? ("⭐ " + r.classificacao + "/5") : "")}
        ${linha("Objetivos", arr(r.objetivos) + (r.objetivosOutros ? ", " + r.objetivosOutros : ""))}
        ${linha("Setores em destaque", r.setoresDestaque)}
        ${linha("Tendências", arr(r.tendencias) + (r.tendenciasOutros ? ", " + r.tendenciasOutros : ""))}
        ${linha("Concorrentes", concs.join(" · "))}
        ${linha("Contactos registados", nContactos ? String(nContactos) : "")}
        ${linha("Oportunidades comerciais", r.oportComerciais)}
        ${linha("Aprendizagens", r.aprendizagens)}
        ${linha("Custo-eficaz", r.custoEficaz)}
        ${linha("Comentários finais", r.comentariosFinais)}
      </dl>
      ${r.Vendedor === meNome ? `<div class="actions"><button class="btn pri" data-act="preencherRelatorio" data-id="${esc(r.feiraId)}">Editar o meu relatório</button></div>` : ""}`;
  });
}

/* ---------- Projetos (pipeline) ---------- */
function rowProjeto(p) {
  const cor = COR_ESTADO[p.Estado] || "b-ok";
  const cli = p.Nome || cliNome(p.Cliente);
  const val = p.Estado === "Anulado" ? 0 : (+p[CAMPO_VALOR] || 0);   // anulado: valor não faz sentido (pode ter sido engano)
  return `<button class="row" data-act="verProjeto" data-id="${esc(p.id)}">
    <span class="grow"><span class="t">${esc(p.DescricaoProjeto || ("Projeto " + p.Projeto))}</span><span class="s">${esc(cli)}${val ? " · " + eur(val) : ""} · ${p.DataUltimaActividade ? haDias(p.DataUltimaActividade) : "sem atividade"}</span></span>
    <span class="badge ${cor}">${esc(p.Estado)}</span>
  </button>`;
}
function vProjetos(el) {
  const pp = L.pipelineProjetos(S.projetos || [], CAMPO_VALOR);
  const sel = projFiltro ? (pp.estados.find(e => e.estado === projFiltro) || { lista: [] }).lista
    : pp.estados.flatMap(e => e.lista).sort((a, b) => String(b.DataUltimaActividade || "").localeCompare(String(a.DataUltimaActividade || "")));
  const seg = (val, txt) => `<button data-act="projFiltro" data-v="${esc(val)}" aria-pressed="${projFiltro === val}">${esc(txt)}</button>`;
  // "em pipeline" não conta os anulados (valor sem sentido — podem ter sido engano)
  const valorPipeline = pp.estados.filter(e => e.estado !== "Anulado").reduce((s, e) => s + e.valor, 0);
  const kpi = e => e.estado === "Anulado"
    ? `<button class="kpi" data-act="projFiltro" data-v="${esc(e.estado)}"><b>${e.count}</b><span>Anulado</span></button>`
    : `<button class="kpi" data-act="projFiltro" data-v="${esc(e.estado)}"><b>${eur(e.valor)}</b><span>${esc(e.estado)} · ${e.count}</span></button>`;
  el.innerHTML = `
    <button class="voltar" data-tab="ferramentas">‹ Ferramentas</button>
    <h1>Projetos</h1>
    <p class="sub">${pp.total} projetos · ${eur(valorPipeline)} em pipeline${ehGestor() ? " (toda a equipa)" : " (sua carteira)"}</p>
    <div class="kpis">
      ${pp.estados.map(kpi).join("")}
    </div>
    <div class="seg seg-scroll" style="margin-top:14px">${seg("", "Todos")}${pp.estados.map(e => seg(e.estado, e.estado)).join("")}</div>
    ${projFiltro === "Não Aceite" ? painelMotivos() : ""}
    <div class="list">${sel.length ? sel.map(rowProjeto).join("") : '<div class="empty">Nenhum projeto neste estado.</div>'}</div>`;
}

/* Estudo dos motivos de recusa: barras horizontais (comprimento = valor perdido),
   do maior para o menor. Lê-se de relance qual o motivo/concorrente que mais custa. */
function barrasPerda(lista, chave) {
  if (!lista.length) return `<p class="bar-sub">Sem registo.</p>`;
  const max = Math.max(1, ...lista.map(x => x.valor));
  const top = lista.slice(0, 6);
  const resto = lista.length - top.length;
  return top.map(x => {
    const pct = Math.max(4, Math.round(x.valor / max * 100));
    return `<div class="bar-row">
      <div class="bar-top"><span class="bar-lbl">${esc(x[chave])}</span><b class="bar-val">${eur(x.valor)}</b></div>
      <div class="bar-track"><i class="bar-fill" style="width:${pct}%"></i></div>
      <div class="bar-sub">${x.count} ${x.count === 1 ? "projeto" : "projetos"}</div>
    </div>`;
  }).join("") + (resto > 0 ? `<p class="bar-sub" style="margin-top:9px">e mais ${resto}…</p>` : "");
}
function painelMotivos() {
  const m = L.motivosRecusa(S.projetos || [], CAMPO_VALOR);
  if (!m.total) return "";
  return `<div class="perdas">
    <div class="perdas-hero"><b>${eur(m.valorTotal)}</b><span>perdidos em ${m.total} ${m.total === 1 ? "projeto não aceite" : "projetos não aceites"}${ehGestor() ? " · toda a equipa" : " · sua carteira"}</span></div>
    <div class="perdas-grp"><h3 class="perdas-h">Porque perdemos</h3>${barrasPerda(m.porMotivo, "motivo")}</div>
    <div class="perdas-grp"><h3 class="perdas-h">Para quem perdemos</h3>${barrasPerda(m.porConcorrente, "nome")}</div>
  </div>`;
}
function sheetProjeto(id) {
  openSheet(() => {
    const p = (S.projetos || []).find(x => String(x.id) === String(id) || String(x.Projeto) === String(id));
    if (!p) { $("#sheet").innerHTML = `<div class="grab"></div><p class="empty">Projeto não encontrado.</p>`; return; }
    const cor = COR_ESTADO[p.Estado] || "b-ok";
    const val = p.Estado === "Anulado" ? 0 : (+p[CAMPO_VALOR] || 0);   // anulado: sem valor (pode ter sido engano)
    const d = p.DataUltimaActividade ? L.diasEntre(p.DataUltimaActividade, isoHoje()) : null;
    const hist = (S.atividades || []).filter(a => String(a.Projeto) === String(p.id))
      .sort((a, b) => String((b.data || "") + (b.criadoEm || "")).localeCompare(String((a.data || "") + (a.criadoEm || ""))));
    const stepper = `<div class="stepper" role="group" aria-label="Estado do projeto">${L.ESTADOS_PROJETO.map(e =>
      `<button data-act="estado" data-id="${esc(p.id)}" data-v="${esc(e)}" style="--c:${COR_STEPPER[e]}" aria-pressed="${p.Estado === e}">${esc(e)}</button>`).join("")}</div>`;
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>${esc(p.DescricaoProjeto || ("Projeto " + p.Projeto))}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <p style="margin:2px 0 6px"><span class="badge ${cor}">${esc(p.Estado)}</span></p>
      ${stepper}
      <p class="muted" style="margin:2px 0 6px;font-size:13px">Toque num estado para o atualizar.</p>
      ${p.Estado === "Pendente" && d !== null && d > 30 ? `<div class="rec-aviso late">Sem atividade há ${d} dias. Vale a pena contactar o cliente.</div>` : ""}
      ${val ? `<div class="big">${eur(val)}</div><p class="muted" style="margin:-6px 0 2px">Valor estimado</p>` : ""}
      <dl class="facts">
        <dt>Cliente</dt><dd>${esc(p.Nome || cliNome(p.Cliente))}</dd>
        ${p.CodigoProjeto ? `<dt>Código do projeto</dt><dd>${esc(p.CodigoProjeto)}</dd>` : ""}
        ${p.Vendedor ? `<dt>Vendedor</dt><dd>${esc(p.Vendedor)}</dd>` : ""}
        ${p.Ano ? `<dt>Ano</dt><dd>${esc(p.Ano)}</dd>` : ""}
        ${p.DataUltimaActividade ? `<dt>Última atividade</dt><dd>${dataCompleta(p.DataUltimaActividade)} (${haDias(p.DataUltimaActividade)})</dd>` : ""}
        ${p.MotivoAnulacao ? `<dt>Motivo</dt><dd>${esc(p.MotivoAnulacao)}</dd>` : ""}
        ${p.Estado === "Não Aceite" ? `<dt>Perdido para</dt><dd>${esc(p.PerdidoPara || "Sem registo")}</dd>` : ""}
        ${(p.Estado === "Não Aceite" || p.Estado === "Anulado") ? `<dt>Cliente sem interesse</dt><dd>${esc(p.ClienteSemInteresse || "—")}</dd>` : ""}
        ${p.JustificacaoEstado ? `<dt>Justificação</dt><dd>${esc(p.JustificacaoEstado)}</dd>` : ""}
      </dl>
      ${p["ObservaçoesProjeto"] ? `<h2>Observações</h2><p>${esc(p["ObservaçoesProjeto"])}</p>` : ""}
      <div class="actions"><button class="btn" data-ent="${esc(p.Cliente)}">Ver cliente</button></div>
      <h2 style="margin-top:14px">Histórico no CRM</h2>
      ${hist.length ? `<ul class="timeline">${hist.map(a => `<li>${esc(a.descricao || TIPOS_ATIV[a.tipo] || a.tipo)}<small>${esc(TIPOS_ATIV[a.tipo] || a.tipo)}, ${dataPT(a.data)}${a.Vendedor ? ", " + esc(primeiro(a.Vendedor)) : ""}</small></li>`).join("")}</ul>` : `<p class="muted">Ainda sem atividades registadas no CRM.</p>`}`;
  });
}

const TIPOS_ATIV = { visita: "Visita", chamada: "Chamada", reuniao: "Reunião", nota: "Nota", tarefa: "Tarefa", followup: "Follow-up", aviso: "Aviso de pagamento" };

/* Mudança de estado do projeto. Estados fechados (Não Aceite / Anulado) exigem
   motivo; Não Aceite exige ainda para quem se perdeu e o valor. Grava o novo
   estado, regista uma nota no histórico e acrescenta concorrentes novos. */
function formMudarEstado(id, estadoNovo) {
  const p = (S.projetos || []).find(x => String(x.id) === String(id));
  if (!p || !Store) return;
  if (p.Estado === estadoNovo) { sheetProjeto(id); return; }
  const fechado = estadoNovo === "Não Aceite" || estadoNovo === "Anulado";
  const motivos = estadoNovo === "Anulado" ? L.MOTIVOS_RECUSA.filter(m => m !== "Optou pela concorrência") : L.MOTIVOS_RECUSA;
  const concorrentes = (S.concorrentes || []).map(c => c.nome).sort((a, b) => a.localeCompare(b, "pt"));
  const campos = fechado ? [
    { n: "motivo", l: "Motivo", type: "select", options: ["", ...motivos] },
    { n: "motivoOutro", l: "Qual é o motivo?", type: "text", se: d => d.motivo === "Outro" },
    ...(estadoNovo === "Não Aceite" ? [
      { n: "perdidoPara", l: "Cliente perdido para", type: "select", options: ["", ...concorrentes, NAO_REVELA, NOVO_CONCORRENTE] },
      { n: "perdidoParaNovo", l: "Nome do concorrente", type: "text", se: d => d.perdidoPara === NOVO_CONCORRENTE },
      { n: "valor", l: "Valor estimado do projeto (€)", type: "number", inputmode: "numeric" }
    ] : []),
    { n: "clienteSemInteresse", l: "O cliente deixou de ter interesse?", type: "select", options: ["Não", "Sim"] },
    { n: "justificacao", l: "Justificação", type: "textarea", placeholder: "O que aconteceu e como soube" }
  ] : [
    { n: "justificacao", l: "Justificação", type: "textarea", placeholder: estadoNovo === "Aceite" ? "Ex.: cliente aprovou o orçamento e a amostra, encomenda nº…" : "Porque é que o projeto volta a estar pendente?" }
  ];
  const valores = { clienteSemInteresse: "Não", valor: (+p[CAMPO_VALOR] || "") };
  abrirForm(`Marcar como ${estadoNovo}`, campos, valores, async d => {
    const perdido = estadoNovo === "Não Aceite"
      ? (d.perdidoPara === NOVO_CONCORRENTE ? (d.perdidoParaNovo || "").trim() : d.perdidoPara)
      : null;
    const dd = { ...d, perdidoPara: perdido };
    const val = L.validaMudancaEstado(estadoNovo, dd);
    if (!val.ok) return { erros: val.erros };
    // concorrente novo (que não seja "Cliente não revela") passa a constar na lista
    if (perdido && perdido !== NAO_REVELA && !(S.concorrentes || []).some(c => L.normaliza(c.nome) === L.normaliza(perdido)))
      await Store.add("concorrentes", { nome: perdido, criadoEm: new Date().toISOString() });
    const patch = L.patchMudancaEstado(p, estadoNovo, dd, isoHoje(), CAMPO_VALOR);
    await Store.update("projetos", id, patch);
    const motivoTxt = patch.MotivoAnulacao ? " (" + patch.MotivoAnulacao + ")" : "";
    const perdTxt = perdido ? ", perdido para " + perdido : "";
    await Store.add("atividades", {
      tipo: "nota", Entidade: p.Cliente, Nome: cliNome(p.Cliente), Projeto: id, Vendedor: meNome,
      data: isoHoje(), concluida: true, criadoEm: new Date().toISOString(),
      descricao: `${p.Estado} → ${estadoNovo}${motivoTxt}${perdTxt}: ${dd.justificacao}`
    });
    // "Não Aceite" gera automaticamente uma tarefa (por alocar) para o vendedor:
    // ir recolher a caixa ao cliente e pedir o estudo do projeto.
    if (estadoNovo === "Não Aceite") await Store.add("atividades", L.tarefaAutoNaoAceite(p));
    toast("Projeto marcado como " + estadoNovo);
    sheetProjeto(id);
  });
}

/* ---------- Recebimentos (um cartão por cliente, com as faturas em dívida) ---------- */
// faixa de antiguidade: classe do badge + texto (dias de atraso ou a vencer)
function faixaReceb(d) {
  if (d <= 0) return { c: "b-ok", t: d === 0 ? "Vence hoje" : `Vence em ${-d} ${-d === 1 ? "dia" : "dias"}` };
  return { c: d < 30 ? "b-a1" : d < 60 ? "b-a2" : "b-a3", t: `${d} ${d === 1 ? "dia" : "dias"} de atraso` };
}
// uma linha por fatura: vencimento, dias de atraso, valor e faixa (ou nota de crédito)
function rowFatura(f) {
  if (f.credito) return `<div class="row">
    <span class="grow"><span class="t">Nota de crédito por regularizar</span><span class="s">Vencimento ${dataCompleta(f.DataVenc)}</span></span>
    <span style="text-align:right;flex:none"><span class="v num muted" style="display:block">${eur2(f.ValorPendente)}</span><span class="badge b-ok">Crédito</span></span>
  </div>`;
  const fx = faixaReceb(f.diasAtraso);
  const sub = f.diasAtraso > 0 ? "Venceu " + haDias(f.DataVenc) : f.diasAtraso === 0 ? "Vence hoje" : "Ainda dentro do prazo";
  return `<div class="row">
    <span class="grow"><span class="t">Vencimento ${dataCompleta(f.DataVenc)}</span><span class="s">${sub}</span></span>
    <span style="text-align:right;flex:none"><span class="v num" style="display:block">${eur2(f.ValorPendente)}</span><span class="badge ${fx.c}">${fx.t}</span></span>
  </div>`;
}
// cartão de um cliente: cabeçalho + aviso de cobrança + lista de faturas + ações
function cartaoReceb(c) {
  const cl = cliDe(c.entidade) || {};
  const fx = faixaReceb(c.maiorAtrasoDias);
  const nF = c.faturas.filter(f => !f.credito).length;
  const avisos = L.avisosCliente(S.atividades, c.entidade);
  const ult = avisos[0];
  const emAtraso = c.maiorAtrasoDias > 0;
  const prom = ult && ult.dataPromessa ? ` Prometeu pagar até ${dataPT(ult.dataPromessa)}${ult.dataPromessa < isoHoje() ? " (já passou)" : ""}.` : "";
  const avisoTxt = ult
    ? `Último aviso ${haDias(ult.data)}${ult.Vendedor ? " por " + esc(primeiro(ult.Vendedor)) : ""}: ${esc(String(ult.descricao || "").replace(/\.\s*$/, ""))}.${prom}`
    : (emAtraso ? "Cliente ainda não foi avisado." : "Ainda dentro do prazo.");
  return `<section class="rec">
    <div class="rec-h">
      <button class="grow" data-ent="${esc(c.entidade)}" style="border:0;background:none;text-align:left;padding:0;min-width:0">
        <span class="t" style="font-size:17px">${esc(cl.Nome || cliNome(c.entidade))}</span>
        <span class="s">Cliente nº ${esc(c.entidade)}${cl.Vendedor ? " · resp. " + esc(primeiro(cl.Vendedor)) : ""} · ${nF} ${nF === 1 ? "fatura" : "faturas"}</span>
      </button>
      <div style="text-align:right">
        <b class="num" style="font-size:19px">${eur2(c.vencido > 0 ? c.vencido : c.total)}</b>
        <div class="s">${c.vencido > 0 ? "vencido, de " + eur(c.total) : "por receber"}</div>
        ${c.maiorAtrasoDias > 0 ? `<span class="badge ${fx.c}">${fx.t}</span>` : ""}
      </div>
    </div>
    <div class="rec-aviso ${emAtraso && !ult ? "late" : ""}">${avisoTxt}</div>
    <div class="list" style="border-radius:var(--radius-s)">${c.faturas.map(rowFatura).join("")}</div>
    <div class="actions" style="margin:10px 0 0">
      <button class="btn pri" data-act="aviso" data-id="${esc(c.entidade)}">Registar aviso</button>
      ${avisos.length ? `<button class="btn" data-act="avisosCli" data-id="${esc(c.entidade)}">Histórico de avisos (${avisos.length})</button>` : ""}
      ${cl.Telefone ? `<a class="btn apenas-telemovel" href="${telHref(cl.Telefone)}" style="text-decoration:none;color:inherit">${ICON_TEL} Ligar</a>` : ""}
      ${cl.EMail ? `<a class="btn apenas-pc" href="${mailHref(cl.EMail)}" style="text-decoration:none;color:inherit">${ICON_MAIL} Email</a>` : ""}
      <button class="btn" data-ent="${esc(c.entidade)}">Ver cliente</button>
    </div>
  </section>`;
}
const MEIO_AVISO = { chamada: "Chamada", email: "Email", pessoalmente: "Pessoalmente", outro: "Outro" };
function linhaAviso(a) {
  const prom = a.dataPromessa ? ` · prometeu pagar até ${dataPT(a.dataPromessa)}${a.dataPromessa < isoHoje() ? " (já passou)" : ""}` : "";
  return `<li>${esc(a.descricao || "")}<small>${dataCompleta(a.data)}${a.meio ? " · " + esc(MEIO_AVISO[a.meio] || a.meio) : ""}${a.Vendedor ? " · " + esc(a.Vendedor) : ""}${prom}</small></li>`;
}
function sheetAvisos(ent) {
  openSheet(() => {
    const avs = L.avisosCliente(S.atividades, ent);
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>Histórico de avisos</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <p class="muted">${esc(cliNome(ent))} · ${avs.length} ${avs.length === 1 ? "aviso" : "avisos"}</p>
      <div class="actions"><button class="btn pri" data-act="aviso" data-id="${esc(ent)}">Registar aviso</button></div>
      ${avs.length ? `<ul class="timeline" style="margin-top:12px">${avs.map(linhaAviso).join("")}</ul>` : `<p class="muted">Ainda não há avisos registados.</p>`}`;
  });
}
function vRecebimentos(el) {
  const rg = L.recebimentosGeral(S.pendentes || [], isoHoje());
  const cartoes = L.recebimentosCartoes(S.pendentes || [], isoHoje(), recSoAtraso);
  const todos = L.recebimentosCartoes(S.pendentes || [], isoHoje(), false);
  const vencidoGeral = todos.reduce((s, c) => s + c.vencido, 0);
  const clientesAtraso = todos.filter(c => c.vencido > 0).length;
  const escaloes = [
    { n: "Não vencido", v: rg.naoVencido, c: "var(--line)" },
    { n: "< 30 dias", v: rg.d1a30, c: "var(--amarelo)" },
    { n: "30–60 dias", v: rg.d31a60, c: "var(--a2-ink)" },
    { n: "60–90 dias", v: rg.d61a90, c: "var(--danger)" },
    { n: "+90 dias", v: rg.maior90, c: "var(--f-negociacao)" }
  ];
  const seg = (val, txt) => `<button data-act="recFiltro" data-v="${val}" aria-pressed="${recSoAtraso === val}">${esc(txt)}</button>`;
  el.innerHTML = `
    <button class="voltar" data-tab="ferramentas">‹ Ferramentas</button>
    <h1>Recebimentos</h1>
    <p class="sub">Valores por receber por cliente${ehGestor() ? " (toda a equipa)" : " (sua carteira)"}</p>
    <div class="kpis">
      <div class="kpi"><b>${eur(rg.total)}</b><span>Por receber · ${(S.pendentes || []).length} documentos</span></div>
      <div class="kpi"><b class="${vencidoGeral > 0 ? "late" : ""}">${eur(vencidoGeral)}</b><span>Vencido</span></div>
      <div class="kpi"><b class="${rg.maior90 > 0 ? "late" : ""}">${eur(rg.maior90)}</b><span>+90 dias</span></div>
      <div class="kpi"><b>${clientesAtraso}</b><span>Clientes a avisar</span></div>
    </div>
    <div class="funil">
      <div class="funil-bar" role="img" aria-label="Valor por antiguidade">${escaloes.map(x => `<i style="flex-grow:${Math.max(x.v, 0) || 0.0001};background:${x.c}"></i>`).join("")}</div>
      <div class="funil-leg">${escaloes.map(x => `<div><em><span class="dot" style="background:${x.c}"></span>${x.n}</em><b class="num">${eur(x.v)}</b></div>`).join("")}</div>
    </div>
    <div class="seg" style="margin-top:16px">${seg(true, "Em atraso")}${seg(false, "Todos os pendentes")}</div>
    ${cartoes.length ? cartoes.map(cartaoReceb).join("") : `<div class="list"><div class="empty">${recSoAtraso ? "Nenhum cliente com valores em atraso." : "Sem valores por receber."}</div></div>`}
    <p class="muted nota" style="margin-top:16px">Valores com IVA. Os negativos são notas de crédito por regularizar. Na versão final vêm automaticamente do ERP.</p>`;
}

/* ---------- Artigos (catálogo + ficha técnica) ---------- */
function rowArtigo(a) {
  const prod = a.dataUltimaProducao ? `últ. OP ${esc(a.ultimaOP)} · ${dataPT(a.dataUltimaProducao)}` : "sem produção";
  return `<button class="row" data-act="verArtigo" data-artigo="${esc(a.artigo)}" data-ent="${esc(a.CodCliente)}">
    <span class="grow"><span class="t">${esc(a.descricao || a.artigo)}</span><span class="s">${esc(a.artigo)}${a.TipoCaixaDescricao ? " · " + esc(a.TipoCaixaDescricao) : ""} · ${esc(a.clienteNome || cliNome(a.CodCliente))}</span></span>
    <span class="s">${prod}</span>
  </button>`;
}
function vArtigos(el) {
  const arts = L.catalogoArtigos(S.artigos || [], S.vendas || [], S.producao || []);
  const termo = L.normaliza(pesquisa);
  const lista = (termo ? arts.filter(a => L.normaliza([a.descricao, a.artigo, a.TipoCaixaDescricao, a.MatPrimaDesc, a.clienteNome].filter(Boolean).join(" ")).includes(termo)) : arts)
    .sort((a, b) => String(b.dataUltimaProducao || "").localeCompare(String(a.dataUltimaProducao || "")));
  el.innerHTML = `
    <button class="voltar" data-tab="ferramentas">‹ Ferramentas</button>
    <h1>Artigos</h1>
    <p class="sub">${arts.length} artigos${ehGestor() ? " (toda a equipa)" : " (sua carteira)"}</p>
    <input class="search" id="buscaArt" placeholder="Procurar artigo, caixa, matéria-prima…" value="${esc(pesquisa)}" autocomplete="off">
    <div class="list">${lista.length ? lista.map(rowArtigo).join("") : '<div class="empty">Nenhum artigo encontrado.</div>'}</div>`;
  ligarPesquisa("#buscaArt");
}
function sheetArtigo(artigo, ent) {
  openSheet(() => {
    const cat = L.catalogoArtigos(S.artigos || [], S.vendas || [], S.producao || [], ent);
    const a = cat.find(x => String(x.artigo) === String(artigo))
      || L.catalogoArtigos(S.artigos || [], S.vendas || [], S.producao || []).find(x => String(x.artigo) === String(artigo));
    if (!a) { $("#sheet").innerHTML = `<div class="grab"></div><p class="empty">Artigo não encontrado.</p>`; return; }
    const medidas = [a.FTCXA, a.FTCXB, a.FTCXC, a.FTCXD].filter(v => v != null && v !== "" && v !== 0);
    const cores = (a.Cores1 || 0) + (a.Cores2 ? "+" + a.Cores2 : "");
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>${esc(a.descricao || a.artigo)}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <dl class="facts">
        <dt>Artigo</dt><dd>${esc(a.artigo)}</dd>
        <dt>Cliente</dt><dd>${esc(a.clienteNome || cliNome(a.CodCliente))}</dd>
        ${a.RefCliente ? `<dt>Ref. cliente</dt><dd>${esc(a.RefCliente)}</dd>` : ""}
        ${a.EstadoProjeto ? `<dt>Estado</dt><dd>${esc(a.EstadoProjeto)}</dd>` : ""}
      </dl>
      <p class="spec-t">Caixa</p>
      <dl class="facts">
        ${a.TipoCaixaDescricao ? `<dt>Tipo de caixa</dt><dd>${esc(a.TipoCaixaDescricao)}${a.TipoCaixa ? " (" + esc(a.TipoCaixa) + ")" : ""}</dd>` : ""}
        ${medidas.length ? `<dt>Medidas (mm)</dt><dd>${medidas.map(esc).join(" × ")}</dd>` : ""}
        ${a.MatPrimaDesc ? `<dt>Matéria-prima</dt><dd>${esc(a.MatPrimaDesc)}</dd>` : ""}
        ${a.PranchaDescricao ? `<dt>Prancha</dt><dd>${esc(a.PranchaDescricao)}</dd>` : ""}
      </dl>
      <p class="spec-t">Acabamentos</p>
      <dl class="facts">
        <dt>Cores</dt><dd>${esc(cores)}</dd>
        ${a.RevestimentoDesc ? `<dt>Revestimento</dt><dd>${esc(a.RevestimentoDesc)}</dd>` : ""}
        ${a.AcabamentoDesc ? `<dt>Acabamento</dt><dd>${esc(a.AcabamentoDesc)}</dd>` : ""}
        ${a.AsaDesc ? `<dt>Asa</dt><dd>${esc(a.AsaDesc)}</dd>` : ""}
        <dt>Janela</dt><dd>${esc(a.Janela || "Não")}</dd>
        <dt>FSC</dt><dd>${esc(a.FSC || "Não")}</dd>
      </dl>
      ${a.ContactoAlimentar === "Sim" ? `<p class="spec-t">Segurança alimentar</p>
      <dl class="facts">
        <dt>Uso previsto</dt><dd>${esc(a.CAUsoPrevistoEmbalagem || "Contacto alimentar")}</dd>
        ${a.CATipoAlimento ? `<dt>Tipo de alimento</dt><dd>${esc(a.CATipoAlimento)}</dd>` : ""}
      </dl>` : ""}
      <p class="spec-t">Última produção</p>
      <dl class="facts">
        <dt>Ordem de produção</dt><dd>${a.ultimaOP != null ? esc(a.ultimaOP) : "—"}</dd>
        <dt>Data</dt><dd>${a.dataUltimaProducao ? dataCompleta(a.dataUltimaProducao) : "—"}</dd>
        <dt>Qtd. produzida</dt><dd>${a.qtdProduzida != null ? unid(a.qtdProduzida) : "—"}</dd>
        ${L.podeVerPrecoUnitario(sessao) ? `<dt>Preço/unidade</dt><dd>${a.precoUnitario ? eurU(a.precoUnitario) : "—"}</dd>` : ""}
      </dl>
      <div class="actions"><button class="btn pri" data-act="orcArtigo" data-ent="${esc(a.CodCliente)}" data-artigo="${esc(a.artigo)}">Pedir orçamento a partir deste artigo</button></div>`;
  });
}

/* ---------- Folha (bottom-sheet) ----------
   openSheet aceita um segundo argumento `msgSaida`: função que devolve uma
   mensagem de confirmação quando fechar implica perder dados (formulários
   preenchidos), ou null/undefined quando é seguro fechar sem perguntar. */
let msgFolhaSaida = null;
function openSheet(fn, msgSaida) { sheetRender = fn; msgFolhaSaida = msgSaida || null; fn(); $("#back").hidden = false; document.documentElement.classList.add("folha-aberta"); }
function closeSheet() { sheetRender = null; msgFolhaSaida = null; $("#back").hidden = true; $("#sheet").innerHTML = ""; document.documentElement.classList.remove("folha-aberta"); }
/* Pede para fechar a folha: se houver dados por gravar, confirma primeiro
   (Sim, sair / Não). Usado pelo × e pelo toque no fundo escuro. */
async function pedeFecharFolha() {
  const msg = typeof msgFolhaSaida === "function" ? msgFolhaSaida() : null;
  if (msg && !(await confirmar(msg))) return;
  closeSheet();
}

/* ---------- Confirmação (Sim / Não) ---------- */
function confirmar(msg) {
  return new Promise(resolve => {
    const back = $("#confirmBack"), sim = $("#confirmSim"), nao = $("#confirmNao");
    if (!back || !sim || !nao) { resolve(window.confirm(msg)); return; }
    $("#confirmMsg").textContent = msg; back.hidden = false;
    const fim = r => { back.hidden = true; sim.onclick = null; nao.onclick = null; back.onclick = null; resolve(r); };
    sim.onclick = () => fim(true);
    nao.onclick = () => fim(false);
    back.onclick = ev => { if (ev.target.id === "confirmBack") fim(false); };
    nao.focus();
  });
}

/* ---------- Toast ---------- */
let toastT = null;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3000);
}

/* ---------- Novo (menu do botão +) ---------- */
function sheetNovo() {
  openSheet(() => {
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>Novo registo</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <div class="menu">
        <button class="btn" data-act="novoOrcamento"><b>Pedir orçamento</b><span class="menu-s">Cria um projeto pendente</span></button>
        <button class="btn" data-act="novaVisita"><b>Registar visita</b><span class="menu-s">Visita ou despesa a um cliente</span></button>
        <button class="btn" data-act="novaTarefa"><b>Nova tarefa</b><span class="menu-s">${ehGestor() ? "Para si ou para um vendedor" : "Uma tarefa sua"}</span></button>
        <button class="btn" data-act="novaReuniao"><b>Marcar reunião</b><span class="menu-s">Equipa toda ou individual · no calendário</span></button>
      </div>`;
  });
}

/* ---------- Sessão ---------- */
function sheetSessao() {
  openSheet(() => {
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>${esc(meNome)}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <p class="muted">${esc(PERFIS[sessao.perfil] || sessao.perfil)}. ${ehGestor() ? "Vê os dados de toda a equipa." : `Vê os ${(S.clientes || []).length} clientes da sua carteira.`}</p>
      <div class="actions"><button class="btn danger" data-act="sair">Terminar sessão</button></div>`;
  });
}

/* ---------- Delegação de eventos ---------- */
document.addEventListener("click", ev => {
  const t = ev.target.closest("[data-tab],[data-act],[data-ent]");
  if (!t) return;
  const act = t.dataset.act, v = t.dataset.v, ent = t.dataset.ent, artigo = t.dataset.artigo, id = t.dataset.id;
  if (act) {
    switch (act) {
      case "lgTeste": { const e = $("#lgEmail"); if (e) { e.value = v; const p = $("#lgPass"); if (p) { p.value = "rumo2026"; p.focus(); } } break; }
      case "sessao": sheetSessao(); break;
      case "fechar": pedeFecharFolha(); break;
      case "sair": terminarSessao(); break;
      case "novo": sheetNovo(); break;
      case "novaVisita": if (typeof formVisita === "function") formVisita({}); break;
      case "visitaCli": if (typeof formVisita === "function") formVisita({ Entidade: ent }); break;
      case "novoOrcamento": if (typeof formPedidoOrcamento === "function") formPedidoOrcamento({}); break;
      case "orcCli": if (typeof formPedidoOrcamento === "function") formPedidoOrcamento({ cliente: ent }); break;
      case "orcArtigo": if (typeof formPedidoOrcamento === "function") formPedidoOrcamento({ cliente: ent, artigo }); break;
      case "verArtigo": sheetArtigo(artigo, ent); break;
      case "verCortante": sheetCortante(id); break;
      case "verStock": sheetStock(id); break;
      case "toggleTarefa": toggleTarefa(id); break;
      case "novaTarefa": if (typeof formTarefa === "function") formTarefa({}); break;
      case "novaTarefaDia": if (typeof formTarefa === "function") formTarefa({ data: id }); break;
      case "novaReuniao": if (typeof formReuniao === "function") formReuniao({}); break;
      case "novaReuniaoDia": if (typeof formReuniao === "function") formReuniao({ data: id }); break;
      case "alocarData": if (typeof formAlocarData === "function") formAlocarData(id); break;
      case "vista": tarefaVista = (v === "lista" ? "lista" : "mes"); renderAll(); break;
      case "tarefaVend": tarefaVend = v || ""; renderAll(); break;
      case "calPrev": calNav(-1); break;
      case "calNext": calNav(1); break;
      case "verDia": sheetDia(id); break;
      case "verFeira": sheetFeira(id); break;
      case "novaFeira": if (typeof formFeira === "function") formFeira(); break;
      case "editarFeira": if (typeof formFeira === "function") formFeira(id); break;
      case "preencherRelatorio": if (typeof formRelatorioFeira === "function") formRelatorioFeira(id); break;
      case "avaliarFeira": sheetAvaliacaoFeira(id); break;
      case "verRelatorio": sheetRelatorio(id); break;
      case "verProjeto": sheetProjeto(id); break;
      case "estado": formMudarEstado(id, v); break;
      case "cortCruzada": cortCruzada = (v === "true"); renderAll(); break;
      case "cortLimparMedidas": cortMedidas = { A: "", B: "", C: "" }; renderAll(); break;
      case "aviso": if (typeof formAviso === "function") formAviso(id); break;
      case "avisosCli": sheetAvisos(id); break;
      case "vendAtivos": sheetClientesVend(id, "ativos"); break;
      case "vendNovos": sheetClientesVend(id, "novos"); break;
      case "vendPerdidos": sheetClientesVend(id, "perdidos"); break;
      case "projFiltro": projFiltro = v; closeSheet(); renderAll(); break;
      case "recFiltro": recSoAtraso = (v === "true"); closeSheet(); renderAll(); break;
    }
    return;
  }
  if (t.dataset.tab) { tab = t.dataset.tab; pesquisa = ""; projFiltro = ""; recSoAtraso = true; cortTipo = ""; cortMedidas = { A: "", B: "", C: "" }; cortCruzada = false; tarefaVend = ""; closeSheet(); window.scrollTo(0, 0); render(); return; }
  if (ent) { sheetCliente(ent); }
});
/* Fecha a folha só quando o toque/clique COMEÇA e TERMINA no fundo escuro.
   Assim, selecionar texto dentro de um campo (arrastar e largar fora do campo)
   já não fecha a página. */
let backBaixoNoFundo = false;
if ($("#back")) {
  $("#back").addEventListener("pointerdown", ev => { backBaixoNoFundo = (ev.target.id === "back"); });
  $("#back").addEventListener("click", ev => { if (ev.target.id === "back" && backBaixoNoFundo) pedeFecharFolha(); });
}

/* ---------- Arranque ---------- */
(function boot() {
  Auth = FONTE_DADOS === "rest" ? AuthRest(API_BASE) : AuthLocal();
  try { sessao = JSON.parse(localStorage.getItem(CHAVE_SESSAO)); } catch (_) { }
  if (sessao) { meNome = sessao.nome; iniciarDados(); } else { render(); }
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    // Já havia uma versão a controlar esta página? (se sim, uma nova versão
    // que assuma o controlo deve recarregar para o utilizador ver o novo código)
    const jaControlado = !!navigator.serviceWorker.controller;
    // updateViaCache:"none" → o browser vai sempre buscar o sw.js à rede,
    // por isso deteta novas versões depressa (não fica preso em cache).
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then(reg => {
        reg.update();
        // verifica atualizações sempre que a app volta a primeiro plano
        document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update(); });
      })
      .catch(() => { });
    // Quando uma nova versão assume o controlo, recarrega UMA vez — exceto
    // na 1ª instalação ou com um formulário aberto (para não perder dados).
    let recarregou = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recarregou || !jaControlado) return;
      if (document.documentElement.classList.contains("folha-aberta")) return;
      recarregou = true; location.reload();
    });
  }
})();
