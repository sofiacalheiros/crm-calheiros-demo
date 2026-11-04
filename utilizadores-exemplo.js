/* Utilizadores de TESTE (fictícios), usados só com FONTE_DADOS = "local".
   ATENÇÃO: este ficheiro é público para quem abrir a app. Não serve para proteger
   dados e não deve conter passwords reais. Em produção, o login é feito pela API
   (POST /login) e este ficheiro deixa de ser usado.
   - nome:   tem de ser igual ao nome do vendedor no ERP (Vendedor / CDU_NomeAbreviado).
   - perfil: "vendedor" (só a sua carteira) ou "gestor" (toda a equipa). */
window.UTILIZADORES_EXEMPLO = [
  { email:"geral@rumo-teste.pt",           password:"rumo2026", nome:"Geral Gestão",    perfil:"gestor" },
  { email:"ana.costa@rumo-teste.pt",       password:"rumo2026", nome:"Ana Costa",       perfil:"vendedor" },
  { email:"joao.martins@rumo-teste.pt",    password:"rumo2026", nome:"João Martins",    perfil:"vendedor" },
  { email:"pedro.sousa@rumo-teste.pt",     password:"rumo2026", nome:"Pedro Sousa",     perfil:"vendedor" },
  { email:"rita.almeida@rumo-teste.pt",    password:"rumo2026", nome:"Rita Almeida",    perfil:"vendedor" }
];
