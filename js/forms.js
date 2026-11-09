/* ==========================================================================
   Formulários (Registar visita, Pedir orçamento) — CRM Calheiros v1
   Abrem como folha (bottom-sheet). Gravam via Store (dados de exemplo na v1).
   O construtor abrirForm suporta secções, campos condicionais (se), listas,
   checkboxes, anexos e auto-preenchimento (onChange).
   ========================================================================== */

/* Listas fixas (na versão final vêm do ERP; o utilizador pode escrever outro valor). */
const TIPO_PROJETO = ["Novo", "Existente"];
const TIPO_ARTIGO = ["Novo", "Existente", "Existente com alterações"];
const CONDICOES = ["Habituais", "Ex-Works", "DAP"];
const DIMENSAO_EMPRESA = ["", "Micro", "Pequena", "Média", "Grande"];
const TIPO_MERCADO = ["", "Nacional", "Exportação"];
const TIPO_ASA = ["", "Simples", "Dupla"];
const PROD_CONTACTO = ["", "Direto", "Indireto"];
const PROD_TIPO_CONTACTO = ["", "Seco", "Gorduroso", "Húmido"];
const PROD_ARMAZENAMENTO = ["", "Refrigerado", "Congelado", "Quente", "Temperatura ambiente"];
const BARREIRAS = ["", "Vácuo", "Plástico", "Papel alimentar", "Frasco", "Embalagem primária", "Outros"];
/* 🔧 lista oficial a confirmar com o IT */
const REVESTIMENTOS = ["", "Sem revestimento", "Verniz aquoso", "Verniz UV", "Plastificação brilho", "Plastificação mate", "Barreira a gorduras", "Barreira à humidade"];
const ACABAMENTOS = ["", "Sem acabamento", "Colada", "Agrafada", "Fundo automático (pré-colada)", "Pega recortada", "Picotado de abertura fácil", "Fita de rasgar", "Gravação a seco / relevo"];
/* "Outros" abre campo livre (exigOutros) — mantém-se sempre em último. */
const EXIGENCIAS_EMBALAMENTO = ["Caixa cartão", "Maços cintados", "Paletes (800×1200 mm)", "Paletes (1000×1200 mm)", "Europaletes (800×1200 mm)", "Outros"];
const ORIGEM_CLIENTE = ["", "Anúncios / Publicações em revistas", "Contacto direto - telefone, email", "Email marketing", "Recomendação de cliente", "Feira / evento", "Website / pesquisa online", "Prospeção comercial", "Redes sociais", "Outro"];

/* ---------- construtor genérico de formulário em folha ---------- */
function campoHTML(c, val) {
  const v = val[c.n] != null ? val[c.n] : "";
  const rotulo = typeof c.l === "function" ? c.l(val) : c.l;   // rótulo pode depender dos valores
  const lbl = `<label>${esc(rotulo)}</label>`;
  if (c.type === "checkbox") {
    return `<div class="fld"><label class="chk"><input type="checkbox" name="${c.n}" ${v ? "checked" : ""}> ${esc(rotulo)}</label></div>`;
  }
  if (c.type === "select") {
    let options = (c.options || []).slice();
    // garantir que o valor atual (ex.: vindo do auto-preenchimento) aparece na lista
    if (v && !options.some(o => String(typeof o === "string" ? o : o.v) === String(v))) options = [v, ...options];
    const opts = options.map(o => {
      const ov = typeof o === "string" ? o : o.v, ol = typeof o === "string" ? o : o.l;
      return `<option value="${esc(ov)}"${String(ov) === String(v) ? " selected" : ""}>${esc(ol || "—")}</option>`;
    }).join("");
    return `<div class="fld">${lbl}<select name="${c.n}" class="search">${opts}</select></div>`;
  }
  if (c.type === "combo") {
    // input com sugestões (datalist): dá para escolher da lista OU escrever um valor novo
    const listId = "dl_" + c.n;
    const opts = (c.options || []).map(o => `<option value="${esc(typeof o === "string" ? o : o.v)}">${esc(typeof o === "string" ? o : (o.l || o.v))}</option>`).join("");
    return `<div class="fld">${lbl}<input name="${c.n}" list="${listId}" value="${esc(v)}" autocomplete="off" ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ""}><datalist id="${listId}">${opts}</datalist></div>`;
  }
  if (c.type === "checklist") {
    // seleção múltipla num campo que abre (dropdown): fechado mostra o resumo
    // do que está escolhido; abre para selecionar. Guarda um array de valores.
    const arr = Array.isArray(v) ? v : [];
    const boxes = (c.options || []).map(o => {
      const ov = typeof o === "string" ? o : o.v, ol = typeof o === "string" ? o : (o.l || o.v);
      return `<label class="chk"><input type="checkbox" name="${c.n}" value="${esc(ov)}" ${arr.includes(ov) ? "checked" : ""}> ${esc(ol)}</label>`;
    }).join("");
    const resumo = arr.length ? arr.length + (arr.length === 1 ? " opção: " : " opções: ") + arr.join(", ") : "Selecione as opções…";
    return `<div class="fld">${lbl}<details class="multi" id="det_${esc(c.n)}"><summary><span class="multi-txt ${arr.length ? "" : "ph"}">${esc(resumo)}</span></summary><div class="checklist">${boxes}</div></details></div>`;
  }
  if (c.type === "textarea") return `<div class="fld">${lbl}<textarea name="${c.n}" placeholder="${esc(c.placeholder || "")}">${esc(v)}</textarea></div>`;
  if (c.type === "file") return `<div class="fld">${lbl}<input type="file" name="${c.n}" multiple><small class="muted">No protótipo guarda-se só o nome dos ficheiros.</small></div>`;
  return `<div class="fld">${lbl}<input name="${c.n}" type="${c.type || "text"}" value="${esc(v)}" ${c.readonly ? "readonly" : ""} ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ""} ${c.inputmode ? `inputmode="${c.inputmode}"` : ""}></div>`;
}

function abrirForm(titulo, campos, valores, onGravar) {
  valores = { ...valores };
  // Baseline capturado DEPOIS da 1ª renderização (os <select> normalizam o
  // valor mostrado ao renderizar), para "sujo" refletir só mudanças do utilizador.
  let inicial = null;
  const visivel = c => !c.se || c.se(valores);
  // formulário "sujo" = o utilizador alterou algum campo face ao estado inicial.
  function estaSujo() {
    if (inicial === null) return false;
    coletar();
    return campos.some(c => {
      if (!c.n) return false;
      const a = valores[c.n], b = inicial[c.n];
      if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a || []) !== JSON.stringify(b || []);
      return (a == null ? "" : a) !== (b == null ? "" : b);
    });
  }
  function coletar() {
    const frm = $("#frmSheet"); if (!frm) return;
    campos.forEach(c => {
      if (!c.n || !visivel(c)) return;
      if (c.type === "checklist") { valores[c.n] = Array.from(frm.querySelectorAll(`input[name="${c.n}"]:checked`)).map(i => i.value); return; }
      const el = frm.elements[c.n]; if (!el) return;
      if (c.type === "checkbox") valores[c.n] = el.checked;
      else if (c.type === "file") valores[c.n] = Array.from(el.files || []).map(f => f.name);
      else valores[c.n] = el.value;
    });
  }
  function desenha() {
    const sheetEl = $("#sheet"); const scrollAnt = sheetEl ? sheetEl.scrollTop : 0;
    const abertos = Array.from(document.querySelectorAll("#frmSheet details.multi[open]")).map(d => d.id);
    const html = campos.map(c => c.sec ? `<div class="frm-sec">${esc(c.sec)}</div>` : (visivel(c) ? campoHTML(c, valores) : "")).join("");
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>${esc(titulo)}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <form id="frmSheet" novalidate>${html}
        <p class="late" id="frmErro" hidden></p>
        <div class="actions"><button class="btn pri" type="submit">Gravar</button></div>
      </form>`;
    abertos.forEach(id => { const d = document.getElementById(id); if (d) d.open = true; });
    if (scrollAnt) { const s2 = $("#sheet"); if (s2) s2.scrollTop = scrollAnt; }
    const frm = $("#frmSheet");
    campos.forEach(c => {
      if (!c.n) return;
      const recalc = () => { coletar(); if (c.onChange) c.onChange(valores); desenha(); };
      if (c.type === "checklist") { frm.querySelectorAll(`input[name="${c.n}"]`).forEach(inp => inp.addEventListener("change", recalc)); return; }
      const el = frm.elements[c.n]; if (!el) return;
      if (c.type === "select" || c.type === "checkbox" || c.type === "combo") el.addEventListener("change", recalc);
      if (c.recarrega) el.addEventListener("blur", recalc);
    });
    frm.onsubmit = async ev => {
      ev.preventDefault(); coletar();
      const btn = frm.querySelector("[type=submit]"); btn.disabled = true;
      try {
        const res = await onGravar(valores);
        if (res && res.erros && Object.keys(res.erros).length) { const e = $("#frmErro"); e.textContent = Object.values(res.erros)[0]; e.hidden = false; btn.disabled = false; }
      } catch (err) {
        const e = $("#frmErro"); e.textContent = err.code === "quota_exceeded" ? "Sem espaço no dispositivo." : "Não foi possível gravar."; e.hidden = false; btn.disabled = false;
      }
    };
    if (inicial === null) { coletar(); inicial = { ...valores }; }
  }
  openSheet(desenha, () => estaSujo()
    ? `Tem a certeza que pretende sair de «${titulo}»? O que preencheu não será guardado.`
    : null);
}

const optsClientes = () => [{ v: "", l: "Escolha o cliente" },
  ...(S.clientes || []).slice().sort((a, b) => String(a.Nome).localeCompare(String(b.Nome))).map(c => ({ v: c.id, l: c.Nome }))];
/* nomes de clientes para o combo (ponto 13): dá para escolher ou escrever um novo */
const nomesClientes = () => (S.clientes || []).slice().sort((a, b) => String(a.Nome).localeCompare(String(b.Nome))).map(c => c.Nome);

/* ---------- Registar visita ---------- */
function formVisita(preset) {
  preset = preset || {};
  const campos = [
    { n: "Entidade", l: "Cliente", type: "select", options: optsClientes() },
    { n: "data", l: "Data", type: "date" },
    { n: "tipo", l: "Tipo", type: "select", options: [{ v: "visita", l: "Visita" }, { v: "chamada", l: "Chamada" }, { v: "reuniao", l: "Reunião" }] },
    { n: "descricao", l: "Descrição", type: "textarea", placeholder: "O que foi tratado…" }
  ];
  const valores = { data: isoHoje(), tipo: "visita", ...preset };
  abrirForm("Registar visita", campos, valores, async d => {
    if (!d.Entidade) return { erros: { cliente: "Escolha o cliente." } };
    if (!d.descricao || !d.descricao.trim()) return { erros: { descricao: "Descreva a visita." } };
    await Store.add("atividades", {
      tipo: d.tipo, Entidade: d.Entidade, Nome: cliNome(d.Entidade), Vendedor: meNome,
      data: d.data, descricao: d.descricao, concluida: true, criadoEm: new Date().toISOString()
    });
    closeSheet(); toast("Visita registada.");
  });
}

/* ---------- Registar aviso de pagamento (cobrança) ----------
   Fica como atividade tipo "aviso" do cliente: quem avisou (vendedor), quando,
   como, o que ficou combinado e, se houver, a data prometida de pagamento. */
function formAviso(ent) {
  const campos = [
    { n: "meio", l: "Como avisou", type: "select", options: [{ v: "chamada", l: "Chamada" }, { v: "email", l: "Email" }, { v: "pessoalmente", l: "Pessoalmente" }, { v: "outro", l: "Outro" }] },
    { n: "data", l: "Data", type: "date" },
    { n: "descricao", l: "O que foi dito / ficou combinado", type: "textarea", placeholder: "Ex.: falei com o cliente, prometeu pagar amanhã." },
    { n: "dataPromessa", l: "Prometeu pagar até (opcional)", type: "date" }
  ];
  const valores = { meio: "chamada", data: isoHoje() };
  abrirForm("Registar aviso", campos, valores, async d => {
    if (!d.descricao || !d.descricao.trim()) return { erros: { descricao: "Escreva o que foi dito ao cliente." } };
    const Entidade = isNaN(+ent) ? ent : +ent;
    await Store.add("atividades", {
      tipo: "aviso", meio: d.meio, descricao: d.descricao.trim(),
      data: d.data || isoHoje(), dataPromessa: d.dataPromessa || null,
      concluida: true, Entidade, Nome: cliNome(ent), Vendedor: meNome, criadoEm: new Date().toISOString()
    });
    closeSheet(); toast("Aviso registado.");
  });
}

/* ---------- Tarefas (Fase 1) ---------- */
const optsVendedores = () => [{ v: "", l: "Escolha o vendedor" },
  ...(S.vendedores || []).slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome))).map(v => ({ v: v.nome, l: v.nome }))];

/* Nova tarefa. O vendedor cria para si; a Gestão escolhe o vendedor destino.
   Sem data = fica "por alocar" no banco de tarefas desse vendedor. */
function formTarefa(preset) {
  preset = preset || {};
  const souGestor = typeof ehGestor === "function" && ehGestor();
  const campos = [
    souGestor
      ? { n: "Vendedor", l: "Para o vendedor", type: "select", options: optsVendedores() }
      : { n: "Vendedor", l: "Vendedor", type: "text", readonly: true },
    { n: "descricao", l: "Tarefa", type: "textarea", placeholder: "O que há a fazer…" },
    { n: "data", l: "Data (deixe vazio = por alocar)", type: "date" },
    { n: "Entidade", l: "Cliente (opcional)", type: "select", options: optsClientes() }
  ];
  const valores = { Vendedor: souGestor ? "" : (meNome || ""), data: "", Entidade: "", ...preset };
  abrirForm("Nova tarefa", campos, valores, async d => {
    const dono = souGestor ? d.Vendedor : (meNome || "");
    const val = L.validaTarefa({ descricao: d.descricao, Vendedor: dono });
    if (!val.ok) return { erros: val.erros };
    const ent = d.Entidade ? (isNaN(+d.Entidade) ? d.Entidade : +d.Entidade) : null;
    await Store.add("atividades", {
      tipo: "tarefa", descricao: d.descricao.trim(), Vendedor: dono, criadoPor: meNome || "",
      data: d.data || null, concluida: false, Entidade: ent, Nome: ent ? cliNome(ent) : null,
      origem: "manual", criadoEm: new Date().toISOString()
    });
    closeSheet(); toast(d.data ? "Tarefa criada." : "Tarefa criada (por alocar).");
  });
}

/* Concluir uma tarefa: o feedback (nota de resultado) é obrigatório. */
function formConcluirTarefa(id) {
  const t = (S.atividades || []).find(a => String(a.id) === String(id));
  if (!t) return;
  const campos = [
    { n: "resultado", l: "Resultado", type: "select", options: [{ v: "Concluída", l: "Concluída" }, { v: "Não foi possível", l: "Não foi possível" }, { v: "A reagendar", l: "A reagendar (fica por fazer, com nova data)" }] },
    // "A reagendar" NÃO conclui: pede nova data e mantém a tarefa aberta.
    { n: "novaData", l: "Nova data", type: "date", se: d => d.resultado === "A reagendar" },
    { n: "resultadoNotas", l: d => d.resultado === "A reagendar" ? "Motivo do reagendamento (obrigatório)" : "Feedback (obrigatório)", type: "textarea", placeholder: "O que aconteceu / o que ficou decidido…" }
  ];
  abrirForm("Concluir tarefa", campos, { resultado: "Concluída", resultadoNotas: "", novaData: isoHoje() }, async d => {
    if (d.resultado === "A reagendar") {
      const val = L.validaReagendarTarefa(d);
      if (!val.ok) return { erros: val.erros };
      // mantém concluida:false; só muda a data e regista o motivo
      await Store.update("atividades", id, {
        data: d.novaData, concluida: false, concluidaEm: null, resultado: null,
        reagendadoEm: new Date().toISOString(), reagendadoNota: d.resultadoNotas.trim()
      });
      closeSheet(); toast("Tarefa reagendada para " + dataPT(d.novaData) + ".");
      return;
    }
    const val = L.validaConclusaoTarefa(d);
    if (!val.ok) return { erros: val.erros };
    await Store.update("atividades", id, {
      concluida: true, concluidaEm: isoHoje(), resultado: d.resultado, resultadoNotas: d.resultadoNotas.trim()
    });
    closeSheet(); toast("Tarefa concluída.");
  });
}

/* Alocar data a uma tarefa do banco (passa de "por alocar" a "agendada"). */
function formAlocarData(id) {
  const t = (S.atividades || []).find(a => String(a.id) === String(id));
  if (!t) return;
  abrirForm("Alocar data", [{ n: "data", l: "Data", type: "date" }], { data: isoHoje() }, async d => {
    if (!d.data) return { erros: { data: "Escolha uma data." } };
    await Store.update("atividades", id, { data: d.data });
    closeSheet(); toast("Tarefa agendada.");
  });
}

/* Marcar reunião: aparece no calendário (a amarelo). Pode ser de toda a
   equipa ou só com vendedores escolhidos. */
function formReuniao(preset) {
  preset = preset || {};
  const campos = [
    { n: "titulo", l: "Assunto da reunião", type: "text", placeholder: "Ex.: Reunião de equipa mensal" },
    { n: "data", l: "Data", type: "date" },
    { n: "hora", l: "Hora (opcional)", type: "time" },
    { n: "ambito", l: "Quem participa", type: "select", options: [{ v: "equipa", l: "Toda a equipa" }, { v: "individual", l: "Vendedores específicos" }] },
    { n: "participantes", l: "Vendedores", type: "checklist", options: (S.vendedores || []).map(v => v.nome), se: d => d.ambito === "individual" },
    { n: "descricao", l: "Notas (opcional)", type: "textarea", placeholder: "Ordem de trabalhos, local ou link…" }
  ];
  const valores = { ambito: "equipa", data: preset.data || isoHoje(), hora: "", participantes: [], ...preset };
  abrirForm("Nova reunião", campos, valores, async d => {
    const equipa = d.ambito === "equipa";
    const val = L.validaReuniao({ titulo: d.titulo, data: d.data, equipa, participantes: d.participantes });
    if (!val.ok) return { erros: val.erros };
    const participantes = equipa ? (S.vendedores || []).map(v => v.nome) : (d.participantes || []);
    await Store.add("atividades", {
      tipo: "reuniao", titulo: d.titulo.trim(), descricao: (d.descricao || "").trim(),
      data: d.data, hora: d.hora || "", equipa, participantes,
      criadoPor: meNome || "", criadoEm: new Date().toISOString()
    });
    closeSheet(); toast("Reunião marcada.");
  });
}

/* ---------- Feiras (OGCAL 361.00) ---------- */
const OBJETIVOS_FEIRA = ["Pesquisa de Novos Produtos/Tecnologias", "Análise de Concorrência", "Prospeção de Novos Clientes/Parceiros", "Fortalecimento de Relações Existentes", "Pesquisa de Fornecedores de Matéria-Prima", "Entender Tendências de Mercado", "Participar em Conferências/Workshops", "Outros"];
const TENDENCIAS_FEIRA = ["sustentabilidade", "personalização", "digitalização", "materiais inovadores", "automação"];
const CONC_FORTES = ["design", "inovação", "qualidade", "marketing"];
const CONTACTO_TIPOS = ["", "Cliente Potencial", "Cliente Existente", "Parceiro", "Fornecedor", "Outro"];
const CONTACTO_PASSOS = ["Agendar reunião", "Pedir cotação", "Enviar originais", "Enviar amostra", "Outro"];
const DESAFIOS_FEIRA = ["Instabilidade económica", "Aumento da concorrência", "Novas regulamentações", "Novas tecnologias da concorrência", "Preços agressivos"];
const ANEXOS_FEIRA = ["Cartões de visita digitalizados", "Brochuras de concorrentes/produtos", "Fotos/vídeos relevantes", "Notas manuscritas"];
const NIVEL_3 = ["", "Baixa", "Média", "Alta"];

/* Nova feira / editar (só Gestão). Atribui vendedores; cada novo vendedor
   atribuído recebe uma tarefa automática para preencher o relatório. */
function formFeira(id) {
  const f = id ? (S.feiras || []).find(x => String(x.id) === String(id)) : null;
  const campos = [
    { n: "nome", l: "Nome da feira", type: "text", placeholder: "Ex.: Empack Madrid" },
    { n: "edicao", l: "Edição / ano", type: "text", placeholder: "Ex.: 2026" },
    { n: "local", l: "Local (cidade, país)", type: "text" },
    { n: "dataInicio", l: "Data de início", type: "date" },
    { n: "dataFim", l: "Data de fim", type: "date" },
    { n: "vendedores", l: "Vendedores atribuídos", type: "checklist", options: (S.vendedores || []).map(v => v.nome) },
    { n: "notas", l: "Notas (opcional)", type: "textarea" }
  ];
  const valores = f ? { ...f } : { vendedores: [] };
  abrirForm(id ? "Editar feira" : "Nova feira", campos, valores, async d => {
    const val = L.validaFeira(d);
    if (!val.ok) return { erros: val.erros };
    const antes = f ? (f.vendedores || []) : [];
    const base = {
      nome: d.nome.trim(), edicao: (d.edicao || "").trim(), local: (d.local || "").trim(),
      dataInicio: d.dataInicio || null, dataFim: d.dataFim || null,
      vendedores: d.vendedores || [], notas: (d.notas || "").trim()
    };
    let feiraId = id;
    if (id) await Store.update("feiras", id, base);
    else { base.criadoPor = meNome || ""; base.criadoEm = new Date().toISOString(); const novo = await Store.add("feiras", base); feiraId = novo && novo.id; }
    // tarefa automática para cada vendedor recém-atribuído
    for (const v of (d.vendedores || []).filter(x => !antes.includes(x))) {
      if (feiraId) await Store.add("atividades", L.tarefaAutoRelatorioFeira({ id: feiraId, nome: base.nome }, v));
    }
    closeSheet(); toast(id ? "Feira atualizada." : "Feira criada.");
  });
}

/* Relatório de visita a feira (fiel ao OGCAL 361.00) — preenchido pelo vendedor. */
function formRelatorioFeira(feiraId) {
  const f = (S.feiras || []).find(x => String(x.id) === String(feiraId));
  if (!f) return;
  const existente = (S.relatoriosFeira || []).find(r => String(r.feiraId) === String(feiraId) && r.Vendedor === meNome);
  const campos = [];
  const add = (...cs) => cs.forEach(c => campos.push(c));
  // 1
  campos.push({ sec: "1. Informações gerais da feira" });
  add(
    { n: "dataRelatorio", l: "Data do relatório", type: "date" },
    { n: "feiraNome", l: "Nome da feira", type: "text", readonly: true },
    { n: "edicao", l: "Edição / ano", type: "text" },
    { n: "local", l: "Local (cidade, país)", type: "text" },
    { n: "datasVisita", l: "Data(s) da visita do comercial", type: "text" },
    { n: "comercial", l: "Comercial responsável", type: "text", readonly: true }
  );
  // 2
  campos.push({ sec: "2. Objetivos da visita" });
  add(
    { n: "objetivos", l: "Objetivos (selecione os que se aplicam)", type: "checklist", options: OBJETIVOS_FEIRA },
    { n: "objetivosOutros", l: "Outros objetivos — quais?", type: "text", se: d => Array.isArray(d.objetivos) && d.objetivos.includes("Outros") }
  );
  // 3
  campos.push({ sec: "3. Observações e análise do mercado" });
  add(
    { n: "setoresDestaque", l: "Setores/segmentos em destaque", type: "textarea" },
    { n: "tendencias", l: "Principais tendências observadas", type: "checklist", options: TENDENCIAS_FEIRA },
    { n: "tendenciasOutros", l: "Outras tendências", type: "text" },
    { n: "novidades", l: "Novidades de produtos/serviços", type: "textarea" },
    { n: "precosCondicoes", l: "Preços/condições de mercado (observações)", type: "textarea" },
    { n: "numExpositores", l: "Número de expositores", type: "text", inputmode: "numeric" },
    { n: "afluencia", l: "Afluência de visitantes", type: "select", options: NIVEL_3 },
    { n: "qualidadePublico", l: "Qualidade do público", type: "select", options: NIVEL_3 }
  );
  // 4 — concorrência (3)
  campos.push({ sec: "4. Análise de concorrência (mínimo 3)" });
  for (let i = 1; i <= 3; i++) {
    add(
      { n: "conc" + i + "Nome", l: "Concorrente " + i + " — nome da empresa", type: "text" },
      { n: "conc" + i + "Pais", l: "País de origem", type: "text" },
      { n: "conc" + i + "Produtos", l: "Produtos/serviços em destaque", type: "textarea" },
      { n: "conc" + i + "Fortes", l: "Pontos fortes observados", type: "checklist", options: CONC_FORTES },
      { n: "conc" + i + "Fracos", l: "Pontos fracos observados", type: "textarea" },
      { n: "conc" + i + "Estrategia", l: "Estratégia de vendas/marketing", type: "textarea" }
    );
  }
  add({ n: "concAnaliseGeral", l: "Análise geral da concorrência (o que a Calheiros pode aprender/adaptar?)", type: "textarea" });
  // 5 — contactos (5)
  campos.push({ sec: "5. Contactos estabelecidos (mínimo 5)" });
  for (let i = 1; i <= 5; i++) {
    add(
      { n: "cont" + i + "Empresa", l: "Contacto " + i + " — empresa", type: "text" },
      { n: "cont" + i + "Nome", l: "Nome do contacto", type: "text" },
      { n: "cont" + i + "Cargo", l: "Cargo/função", type: "text" },
      { n: "cont" + i + "Pais", l: "País", type: "text" },
      { n: "cont" + i + "Tipo", l: "Tipo de contacto", type: "select", options: CONTACTO_TIPOS },
      { n: "cont" + i + "Resumo", l: "Resumo da conversa/interesse", type: "textarea" },
      { n: "cont" + i + "Passos", l: "Próximos passos", type: "checklist", options: CONTACTO_PASSOS },
      { n: "cont" + i + "Resp", l: "Responsável pelo seguimento (interno)", type: "text" }
    );
  }
  // 6
  campos.push({ sec: "6. Oportunidades identificadas" });
  add(
    { n: "oportComerciais", l: "Oportunidades comerciais", type: "textarea" },
    { n: "oportParceria", l: "Oportunidades de parceria/colaboração", type: "textarea" },
    { n: "oportProduto", l: "Oportunidades de desenvolvimento de produto", type: "textarea" },
    { n: "oportMelhoria", l: "Oportunidades de melhoria interna", type: "textarea" }
  );
  // 7
  campos.push({ sec: "7. Desafios e ameaças observados" });
  add(
    { n: "desafios", l: "Desafios/ameaças", type: "checklist", options: DESAFIOS_FEIRA },
    { n: "desafiosOutros", l: "Outros desafios/ameaças", type: "text" }
  );
  // 8
  campos.push({ sec: "8. Aprendizagens e recomendações" });
  add(
    { n: "aprendizagens", l: "Principais aprendizagens da feira", type: "textarea" },
    { n: "participacaoFutura", l: "Participação em futuras edições", type: "checklist", options: ["Exposição", "Visita"] }
  );
  // 9
  campos.push({ sec: "9. Custos e eficiência (opcional)" });
  add(
    { n: "custoEficaz", l: "Considera a visita custo-eficaz?", type: "select", options: ["", "Sim", "Não"] },
    { n: "custoPorque", l: "Porquê?", type: "textarea" }
  );
  // 10
  campos.push({ sec: "10. Avaliação global da visita" });
  add(
    { n: "classificacao", l: "Classificação (1 a 5 estrelas) — obrigatório", type: "select", options: ["", "1", "2", "3", "4", "5"] },
    { n: "comentariosFinais", l: "Comentários finais", type: "textarea" },
    { n: "anexos", l: "Anexos", type: "checklist", options: ANEXOS_FEIRA }
  );

  const valores = existente ? { ...existente } : {
    feiraNome: f.nome, edicao: f.edicao || "", local: f.local || "",
    datasVisita: (f.dataInicio ? dataPT(f.dataInicio) : "") + (f.dataFim ? "–" + dataPT(f.dataFim) : ""),
    comercial: meNome || "", dataRelatorio: isoHoje(),
    objetivos: [], tendencias: [], desafios: [], participacaoFutura: [], anexos: [],
    conc1Fortes: [], conc2Fortes: [], conc3Fortes: [],
    cont1Passos: [], cont2Passos: [], cont3Passos: [], cont4Passos: [], cont5Passos: []
  };
  abrirForm("Relatório — " + f.nome, campos, valores, async d => {
    const val = L.validaRelatorioFeira(d);
    if (!val.ok) return { erros: val.erros };
    const reg = { ...d, feiraId: f.id, Vendedor: meNome, feiraNome: f.nome, classificacao: +d.classificacao || "", concluido: true };
    if (existente) await Store.update("relatoriosFeira", existente.id, reg);
    else { reg.criadoEm = new Date().toISOString(); await Store.add("relatoriosFeira", reg); }
    // fecha a tarefa automática "Preencher relatório" desta feira, se existir
    const tar = (S.atividades || []).find(a => a.tipo === "tarefa" && a.subtipo === "relatorioFeira" && String(a.feiraId) === String(f.id) && a.Vendedor === meNome && !a.concluida);
    if (tar) await Store.update("atividades", tar.id, { concluida: true, concluidaEm: isoHoje(), resultado: "Concluída", resultadoNotas: "Relatório submetido." });
    closeSheet(); toast("Relatório guardado.");
  });
}

/* ---------- Pedir orçamento (formulário completo, como no CRM atual) ---------- */
function formPedidoOrcamento(preset) {
  preset = preset || {};
  const op = L.opcoesOrcamento(S.vendas || [], S.cortantes || []);
  // pré-preenchimento a partir de um artigo
  let pre = {};
  if (preset.cliente && preset.artigo) {
    const a = L.listaArtigos(S.vendas || [], S.producao || [], preset.cliente).find(x => String(x.artigo) === String(preset.artigo));
    if (a) pre = {
      artigo: a.artigo, descricao: a.descricao, quantidade: a.ultimaQuantidade,
      materia: a.matPrima ? (a.matPrima + (a.matPrimaDescricao ? " - " + a.matPrimaDescricao : "")) : ""
    };
  }
  // auto-preenchimento dos dados do cliente a partir da ficha
  const preencheCliente = d => {
    const c = cliDe(d.cliente);
    if (!c) { d.numCliente = ""; return; }
    d.numCliente = c.Entidade || c.id || "";
    d.nif = c.Contribuinte || ""; d.morada = c.Morada || ""; d.telefone = c.Telefone || "";
    d.localEntrega = c.LocalEntrega || ""; d.email = c.EMail || "";
    d.dimensao = L.dimensaoCliente(c);
    d.ppwr = c.CDU_PPWR_RequisitosCliente || "";
  };
  // auto-preenchimento da embalagem a partir do código do artigo
  const preencheArtigo = d => {
    if (!d.artigo) return;
    const todos = L.listaArtigos(S.vendas || [], S.producao || [], d.cliente).concat(L.listaArtigos(S.vendas || [], S.producao || []));
    const a = todos.find(x => String(x.artigo) === String(d.artigo));
    if (!a) return;
    if (!d.descricao) d.descricao = a.descricao;
    if (!d.quantidade) d.quantidade = a.ultimaQuantidade;
    if (!d.materia) d.materia = a.matPrima ? (a.matPrima + (a.matPrimaDescricao ? " - " + a.matPrimaDescricao : "")) : "";
  };
  // ponto 13: o cliente pode ser escolhido da lista OU escrito (cliente novo)
  const resolveCliente = d => {
    const nome = String(d.clienteNome || "").trim();
    const c = (S.clientes || []).find(x => String(x.Nome).toLowerCase() === nome.toLowerCase());
    if (c) { d.cliente = c.id; d.novoCliente = ""; d.clienteNome = c.Nome; preencheCliente(d); }
    else { d.cliente = ""; d.novoCliente = nome; d.numCliente = ""; } // cliente novo: restantes campos ficam livres
  };
  // ponto 9: contacto alimentar → "uso previsto" arranca por "Embalagem
  // primária para…" (Direto) ou "Embalagem secundária para…" (Indireto);
  // trocar de contacto substitui o prefixo e mantém o resto do texto.
  const preencheUsoPrevisto = d => {
    if (d.prodAlimentares) d.prodUsoPrevisto = L.usoPrevisto(d.contactoProdAlimentar, d.prodUsoPrevisto);
  };

  const campos = [
    { sec: "Dados do pedido" },
    { n: "vendedor", l: "Vendedor", type: "text", readonly: true },
    { n: "tipoProjeto", l: "Tipo de projeto", type: "select", options: TIPO_PROJETO },
    { n: "codigoProjeto", l: "Código do projeto", type: "text" },
    { n: "pedOrcamento", l: "Pedido de orçamento", type: "checkbox" },
    { n: "pedModelo", l: "Pedido de modelo", type: "checkbox" },
    { n: "pedPrint", l: "Pedido de print", type: "checkbox" },
    { n: "pedPDF", l: "Pedido de PDF", type: "checkbox" },
    { n: "norma", l: "Norma", type: "checkbox" },
    { n: "tipoArtigo", l: "Tipo de artigo", type: "select", options: TIPO_ARTIGO },
    { n: "altEstrutura", l: "Estrutura", type: "checkbox", se: d => d.tipoArtigo === "Existente com alterações" },
    { n: "altImagemAcab", l: "Imagem / Acabamentos", type: "checkbox", se: d => d.tipoArtigo === "Existente com alterações" },

    { sec: "Dados do cliente" },
    { n: "clienteNome", l: "Cliente", type: "combo", options: nomesClientes(), placeholder: "Escolha da lista ou escreva (cliente novo)", onChange: resolveCliente },
    { n: "numCliente", l: "Nº de cliente", type: "text", readonly: true },
    { n: "nif", l: "NIF", type: "text" },
    { n: "morada", l: "Morada", type: "text" },
    { n: "localEntrega", l: "Local de entrega (obrigatório)", type: "text" },
    { n: "telefone", l: "Telefone", type: "text" },
    { n: "condicoes", l: "Condições de fornecimento", type: "select", options: CONDICOES },
    { n: "pessoaContacto", l: "Pessoa de contacto", type: "text", placeholder: "Nome (texto livre)" },
    { n: "contactoTelefone", l: "Telefone do contacto", type: "text" },
    { n: "email", l: "Email", type: "text" },
    { n: "dimensao", l: "Dimensão da empresa", type: "select", options: DIMENSAO_EMPRESA },
    { n: "ppwr", l: "Requisitos PPWR", type: "text" },

    { sec: "Dados da embalagem" },
    { n: "artigo", l: "Artigo (código)", type: "text", placeholder: "Se já existe", recarrega: true, onChange: preencheArtigo },
    { n: "descricao", l: "Descrição / o que pretende", type: "textarea", placeholder: "Medidas, cores, detalhes…" },
    { n: "quantidade", l: "Quantidades", type: "text", inputmode: "numeric", placeholder: "ex.: 1000, 5000" },
    { n: "formatoCaixa", l: "Formato da caixa (C x L x A)", type: "text" },
    { n: "tipoCaixa", l: "Tipo de caixa", type: "select", options: ["", ...op.tiposCaixa] },
    { n: "materia", l: "Matéria-prima", type: "select", options: ["", ...op.materiasPrimas] },
    { n: "revestimento", l: "Revestimento", type: "select", options: REVESTIMENTOS },
    { n: "acabamento", l: "Acabamento", type: "select", options: ACABAMENTOS },
    { n: "numCoresInt", l: "Nº de cores (interior)", type: "text", inputmode: "numeric" },
    { n: "numCoresExt", l: "Nº de cores (exterior)", type: "text", inputmode: "numeric" },
    { n: "asaPlastico", l: "Asa plástica", type: "checkbox" },
    { n: "tipoAsa", l: "Tipo de asa", type: "select", options: TIPO_ASA, se: d => d.asaPlastico },
    { n: "corAsa", l: "Cor da asa", type: "text", se: d => d.asaPlastico },
    { n: "cordao", l: "Cordão", type: "checkbox" },
    { n: "cordaoTamanho", l: "Tamanho do cordão", type: "text", se: d => d.cordao },
    { n: "cordaoCor", l: "Cor do cordão", type: "text", se: d => d.cordao },
    { n: "fita", l: "Fita", type: "checkbox" },
    { n: "janelaAcetato", l: "Janela com acetato", type: "checkbox" },
    { n: "aptoCongelacao", l: "Apto para congelação", type: "checkbox", se: d => d.janelaAcetato },
    { n: "variante", l: "Variante", type: "text" },

    { sec: "Exigência Embalamento / Paletes" },
    { n: "exigPaletes", l: "Exigências (selecione as que se aplicam)", type: "checklist", options: EXIGENCIAS_EMBALAMENTO },
    { n: "exigOutros", l: "Outros — qual?", type: "text", se: d => Array.isArray(d.exigPaletes) && d.exigPaletes.includes("Outros") },

    { sec: "Requisitos especiais" },
    { n: "enchimentoAutomatico", l: "Enchimento automático", type: "checkbox" },
    { n: "embalagemServico", l: "Embalagem de serviço", type: "checkbox" },
    { n: "fsc", l: "FSC", type: "checkbox" },
    { n: "tipoMercado", l: "Tipo de mercado", type: "select", options: TIPO_MERCADO, se: d => d.fsc },

    { sec: "Segurança alimentar" },
    { n: "prodAlimentares", l: "Produtos alimentares", type: "checkbox" },
    { n: "contactoProdAlimentar", l: "Tipo de contacto (direto ou indireto)", type: "select", options: PROD_CONTACTO, se: d => d.prodAlimentares, onChange: preencheUsoPrevisto },
    { n: "prodTipoContacto", l: "Contacto com o alimento", type: "select", options: PROD_TIPO_CONTACTO, se: d => d.prodAlimentares && d.contactoProdAlimentar === "Direto" },
    { n: "prodArmazenamento", l: "Armazenamento", type: "select", options: PROD_ARMAZENAMENTO, se: d => d.prodAlimentares && d.contactoProdAlimentar === "Direto" },
    { n: "prodTempCongelacao", l: "Temperatura de congelação", type: "text", se: d => d.prodAlimentares && d.contactoProdAlimentar === "Direto" && d.prodArmazenamento === "Congelado" },
    { n: "prodUsoPrevisto", l: "Uso previsto da embalagem", type: "text", se: d => d.prodAlimentares },
    { n: "tipoBarreira", l: "Tipo de barreira", type: "select", options: BARREIRAS, se: d => d.prodAlimentares && d.contactoProdAlimentar === "Indireto" },
    { n: "tipoBarreiraOutro", l: "Qual a barreira?", type: "text", se: d => d.prodAlimentares && d.contactoProdAlimentar === "Indireto" && d.tipoBarreira === "Outros" },

    { sec: "Observações" },
    { n: "obs", l: "Observações", type: "textarea" },

    { sec: "Clientes novos / Projetos novos" },
    { n: "novoOrigem", l: "O que trouxe o cliente até nós", type: "select", options: ORIGEM_CLIENTE },
    { n: "novoContinuidade", l: "Compra com continuidade", type: "checkbox" },
    { n: "novoPotencial", l: "Cliente com potencial para mais referências de caixas", type: "checkbox" },
    { n: "novoObs", l: "Observações - Clientes novos / Projetos novos", type: "textarea" },

    { sec: "Anexos" },
    { n: "anexos", l: "Ficheiros a anexar", type: "file" }
  ];

  const valores = {
    vendedor: meNome || "", tipoProjeto: "Novo", tipoArtigo: "Novo", pedOrcamento: true,
    condicoes: "Habituais", cliente: preset.cliente || "", exigPaletes: [], ...pre
  };
  if (valores.cliente) { preencheCliente(valores); valores.clienteNome = cliNome(valores.cliente); }

  abrirForm("Pedir orçamento", campos, valores, async d => {
    const val = L.validaPedidoOrcamento(d);
    if (!val.ok) return { erros: val.erros };
    const resumo = (d.tipoCaixa || d.descricao || "Pedido").toString().slice(0, 60);
    const nomeCli = d.cliente ? cliNome(d.cliente) : (String(d.novoCliente || d.clienteNome || "").trim() || "Cliente novo");
    await Store.add("projetos", {
      DescricaoProjeto: "PO (CRM) " + resumo, Cliente: d.cliente || null, Nome: nomeCli,
      Estado: "Pendente", Vendedor: meNome, origem: "crm",
      CodigoProjeto: d.codigoProjeto || null,   // código para associar ao iPortal
      "ObservaçoesProjeto": [d.artigo, d.descricao].filter(Boolean).join(" - "),
      DataUltimaActividade: isoHoje(),
      pedido: d   // guarda todos os campos do pedido
    });
    closeSheet(); toast("Pedido de orçamento criado (fica pendente).");
  });
}
