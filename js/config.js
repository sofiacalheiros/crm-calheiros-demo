/* ==========================================================================
   Configuração do CRM Calheiros (v1)
   --------------------------------------------------------------------------
   Por omissão usa dados de exemplo no browser (FONTE_DADOS = "local").
   Para ligar aos dados reais da empresa, o departamento de IT só precisa de:
     1) expor uma API REST com os endpoints do RestAdapter (ver store.js);
     2) mudar FONTE_DADOS para "rest" e API_BASE para o endereço da API.
   É o ÚNICO ponto a mudar para trocar de dados de exemplo para dados reais.
   ========================================================================== */

const FONTE_DADOS = "local";                      // "local" (dados de exemplo) | "rest" (API do IT)
const API_BASE = "https://api.empresa.pt/crm";    // usado só com "rest"
const CAMPO_VALOR = "ValorEstimado";              // campo do ERP com o valor estimado da venda (€, sem IVA). CONFIRMAR com o IT.
const EMAIL_ORCAMENTOS = "orcamentos@calheiros.pt"; // destino do "Pedir orçamento" (enviado também ao próprio vendedor)

/* Coleções carregadas pela app (nomes alinhados com o ERP / dados-exemplo.js).
   Nota: "contactos" existe nos dados de exemplo mas o ecrã de contactos ainda
   não está construído, por isso não está nesta lista (fica para uma próxima versão). */
const COLECOES = ["vendedores", "clientes", "projetos", "vendas", "pendentes", "atividades", "producao", "cortantes", "artigos", "stock", "seguroCredito", "concorrentes", "feiras", "relatoriosFeira"];

/* Listas do "Pedir orçamento" que, nos dados reais, vêm de tabelas do PRIMAVERA
   (nomes confirmados pelo IT em 2026-11-24). Para cada uma: o `endpoint` que a app
   chama em modo "rest" e a `tabela` do ERP de onde o IT alimenta esse endpoint.
   - Modo "local": usam-se as opções de exemplo (derivadas dos dados fictícios / listas fixas).
   - Modo "rest": a app vai buscar as opções ao endpoint → tabela indicada abaixo.
   (É aqui que fica "escrito no código" de onde vem cada lista.) */
const LISTAS_ERP = {
  materiaPrima: { endpoint: "listas/materia-prima", tabela: "PR_MOBILIDADE_MatPrima" },
  tipoCaixa:    { endpoint: "listas/tipo-caixa",    tabela: "PR_MOBILIDADE_TipoCaixa" },
  revestimento: { endpoint: "listas/revestimento",  tabela: "PR_MOBILIDADE_Revestimento" },
  acabamento:   { endpoint: "listas/acabamento",    tabela: "PR_MOBILIDADE_Acabamento" }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FONTE_DADOS, API_BASE, CAMPO_VALOR, EMAIL_ORCAMENTOS, COLECOES, LISTAS_ERP };
}
