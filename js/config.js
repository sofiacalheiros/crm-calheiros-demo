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

/* Coleções usadas na v1 (nomes alinhados com o ERP / dados-exemplo.js).
   v2 acrescenta: contactos, concorrentes, cortantes. */
const COLECOES = ["vendedores", "clientes", "projetos", "vendas", "pendentes", "atividades", "producao", "cortantes", "artigos", "stock", "seguroCredito", "concorrentes"];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { FONTE_DADOS, API_BASE, CAMPO_VALOR, COLECOES };
}
