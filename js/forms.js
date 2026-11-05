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
const TIPO_MERCADO = ["", "Nacional", "Exportação"];
const TIPO_ASA = ["", "Simples", "Dupla"];
const PROD_CONTACTO = ["", "Direto", "Indireto"];
const PROD_TIPO_CONTACTO = ["", "Seco", "Gorduroso", "Húmido"];
const PROD_ARMAZENAMENTO = ["", "Refrigerado", "Congelado", "Quente", "Temperatura ambiente"];
const BARREIRAS = ["", "Vácuo", "Plástico", "Papel alimentar", "Frasco", "Embalagem primária", "Outros"];
/* 🔧 lista oficial a confirmar com o IT */
const REVESTIMENTOS = ["", "Sem revestimento", "Verniz aquoso", "Verniz UV", "Plastificação brilho", "Plastificação mate", "Barreira a gorduras", "Barreira à humidade"];
const ACABAMENTOS = ["", "Sem acabamento", "Colada", "Agrafada", "Fundo automático (pré-colada)", "Pega recortada", "Picotado de abertura fácil", "Fita de rasgar", "Gravação a seco / relevo"];
/* 🔧 LISTA PROVISÓRIA — a confirmar/fornecer pela utilizadora (ponto 6). "Outros" abre campo livre. */
const EXIGENCIAS_EMBALAMENTO = ["Palete Euro (1200×800)", "Palete 1000×1200", "Filme estirável", "Cantoneiras / esquineiros", "Intercalares entre camadas", "Nº de caixas por palete definido", "Altura máxima de palete", "Cinta / cintagem", "Outros"];
/* 🔧 LISTA PROVISÓRIA — a confirmar/fornecer pela utilizadora (ponto 11). */
const ORIGEM_CLIENTE = ["", "Recomendação de cliente", "Feira / evento", "Website / pesquisa online", "Contacto do vendedor", "Campanha / marketing", "Outro"];

/* ---------- construtor genérico de formulário em folha ---------- */
function campoHTML(c, val) {
  const v = val[c.n] != null ? val[c.n] : "";
  const lbl = `<label>${esc(c.l)}</label>`;
  if (c.type === "checkbox") {
    return `<div class="fld"><label class="chk"><input type="checkbox" name="${c.n}" ${v ? "checked" : ""}> ${esc(c.l)}</label></div>`;
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
    // seleção múltipla: várias caixas; guarda um array de valores escolhidos
    const arr = Array.isArray(v) ? v : [];
    const boxes = (c.options || []).map(o => {
      const ov = typeof o === "string" ? o : o.v, ol = typeof o === "string" ? o : (o.l || o.v);
      return `<label class="chk"><input type="checkbox" name="${c.n}" value="${esc(ov)}" ${arr.includes(ov) ? "checked" : ""}> ${esc(ol)}</label>`;
    }).join("");
    return `<div class="fld">${lbl}<div class="checklist">${boxes}</div></div>`;
  }
  if (c.type === "textarea") return `<div class="fld">${lbl}<textarea name="${c.n}" placeholder="${esc(c.placeholder || "")}">${esc(v)}</textarea></div>`;
  if (c.type === "file") return `<div class="fld">${lbl}<input type="file" name="${c.n}" multiple><small class="muted">No protótipo guarda-se só o nome dos ficheiros.</small></div>`;
  return `<div class="fld">${lbl}<input name="${c.n}" type="${c.type || "text"}" value="${esc(v)}" ${c.readonly ? "readonly" : ""} ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ""} ${c.inputmode ? `inputmode="${c.inputmode}"` : ""}></div>`;
}

function abrirForm(titulo, campos, valores, onGravar) {
  valores = { ...valores };
  const visivel = c => !c.se || c.se(valores);
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
    const html = campos.map(c => c.sec ? `<div class="frm-sec">${esc(c.sec)}</div>` : (visivel(c) ? campoHTML(c, valores) : "")).join("");
    $("#sheet").innerHTML = `<div class="grab"></div>
      <div class="sh-h"><h3>${esc(titulo)}</h3><button class="x" data-act="fechar" aria-label="Fechar">×</button></div>
      <form id="frmSheet" novalidate>${html}
        <p class="late" id="frmErro" hidden></p>
        <div class="actions"><button class="btn pri" type="submit">Gravar</button></div>
      </form>`;
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
  }
  openSheet(desenha);
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
    d.dimensao = c.CDU_Dimensao || (c.NumEmpregados ? c.NumEmpregados + " colaboradores" : "");
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
  // ponto 9: contacto direto alimentar → "uso previsto" começa por "Embalagem primária para…"
  const preencheUsoPrevisto = d => {
    if (d.prodAlimentares && d.contactoProdAlimentar === "Direto" && !String(d.prodUsoPrevisto || "").trim())
      d.prodUsoPrevisto = "Embalagem primária para ";
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
    { n: "dimensao", l: "Dimensão da empresa", type: "text" },
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
