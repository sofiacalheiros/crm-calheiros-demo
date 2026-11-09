# CRM Calheiros — app comercial (PWA)

App de telemóvel/web (PWA instalável) para a equipa comercial da Calheiros, com o
design e a interatividade do protótipo `rumo-crm-v2`. **HTML/CSS/JS puro, sem
compilação.**

Funciona com **dados de exemplo (fictícios)**. A ligação aos dados reais do ERP
PRIMAVERA é o passo final, feito pelo departamento de **IT** — ver
[`docs/Especificacao_BD_para_IT.md`](docs/Especificacao_BD_para_IT.md).

## Funcionalidades
- **Login** por vendedor/gestão (gestão vê toda a equipa; vendedor vê só a sua carteira).
- **Início** — pagamentos em atraso, projetos pendentes, tarefas pendentes.
- **Clientes** — lista + ficha (vendas, pendentes, projetos, contactos).
- **Artigos** — ficha técnica + última produção (**preço/unidade só para a gestão**).
- **Cortantes** — procura por tipo de caixa ou por medidas aproximadas, com imagem.
- **Stock** — por armazém e lote.
- **Recebimentos** — dias exatos de atraso, avisos de pagamento, seguro de crédito.
- **Projetos** — pipeline por estado; mudança de estado com classificação de perdidos.
- **Pedido de orçamento** — formulário por secções (fiel ao do CRM atual).
- **Tarefas e calendário** — tarefas (próprias e atribuídas pela gestão), banco de
  tarefas por alocar, calendário mensal, **reuniões** (equipa ou individuais, a amarelo),
  vista por vendedor; detalhe ao tocar.
- **Feiras** — atribuição de feiras a vendedores + **relatório de visita a feira**
  (OGCAL 361.00) e avaliação por feira.
- **Dashboards**, **modo escuro**, **instalável no telemóvel** (PWA).

## Como ver

Como é HTML/CSS/JS puro (sem compilação), basta servir a pasta:

```bash
python -m http.server 8777
```

Depois abrir `http://localhost:8777/`. No telemóvel, na mesma rede Wi-Fi:
`http://<IP-do-computador>:8777`.

**Logins de teste** (fictícios, em `utilizadores-exemplo.js`), password `rumo2026`:
- `geral@rumo-teste.pt` — **gestão** (vê toda a equipa)
- `ana.costa@rumo-teste.pt`, `joao.martins@`, `pedro.sousa@`, `rita.almeida@rumo-teste.pt` — vendedores

## Estrutura

| Ficheiro | Função |
|---|---|
| `index.html` | Estrutura, estilos (CSS) e navegação |
| `js/config.js` | Configuração (fonte de dados, coleções) |
| `js/store.js` | Camada de dados (LocalAdapter / RestAdapter) e login |
| `js/logic.js` | Lógica pura (visibilidade, pesquisa, ficha, validações) — **testada** |
| `js/ui.js` | Ecrãs e navegação |
| `js/forms.js` | Formulários (orçamento, visita, tarefa, reunião, feira, relatório) |
| `*-exemplo.js` | Dados de teste (fictícios, com os nomes de campos do ERP) |
| `sw.js` | Service worker (offline + atualização automática de versão) |
| `tests/` | Testes automáticos (`node --test`) |
| `docs/` | Documentação para o IT (especificação de BD, mapa técnico, auditoria) |

## Testes

```bash
node --test "tests/logic.test.js" "tests/store.test.js" "tests/smoke.test.js"
```

## Ligar aos dados reais (para o IT)

Toda a app fala com os dados através do `Store`. Para ligar ao ERP:

1. Expor uma **API REST** com uma rota por coleção (`clientes`, `projetos`, `vendas`,
   `pendentes`, `atividades`, `producao`, `cortantes`, `artigos`, `stock`,
   `seguroCredito`, `concorrentes`, `feiras`, `relatoriosFeira`, `contactos`), com os
   **mesmos nomes de campos do ERP**. Login: `POST /login` com `{ email, password }`
   → `{ token, nome, perfil }`.
2. Em `js/config.js`, mudar `FONTE_DADOS` para `"rest"` e `API_BASE` para o endereço
   da API. **É o único ponto a mudar na app.**

🔒 **Segurança:** o `PrecoVendaUnitario` **não pode** ser devolvido pela API a perfis
de *vendedor* (ver a especificação). Esconder só no ecrã não chega.

**Documentação para o IT** (na pasta `docs/`):
- [`Especificacao_BD_para_IT.md`](docs/Especificacao_BD_para_IT.md) — **tabelas a criar, colunas a acrescentar e views a expor** (a ler primeiro).
- `CRM_Mapa_Tecnico_e_Plano.md` — mapa do CRM atual e caminho de modernização.
- `Relatorio_IT_e_Auditoria.md` — auditoria + resumo por separador.
