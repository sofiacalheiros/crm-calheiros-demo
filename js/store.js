/* ==========================================================================
   Camada de dados (Store) e acesso (Auth)
   --------------------------------------------------------------------------
   - LocalAdapter: dados de exemplo guardados no browser (localStorage). Testes.
   - RestAdapter:  liga à API REST da empresa (produção; ver config.js).
   A app só fala com o Store; trocar de um para o outro é mudar FONTE_DADOS.
   Mesma forma nos dois: subscribe(col, cb), add, update, set, remove.
   ========================================================================== */

/* ---------- Adaptador local (dados de exemplo) ----------
   Na primeira utilização carrega window.DADOS_EXEMPLO (dados-exemplo.js). */
function LocalAdapter(chave) {
  const subs = {};
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function seed() {
    const ref = new Date((window.DATA_REFERENCIA || "2026-10-01") + "T12:00:00");
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
    const delta = window.AJUSTAR_DATAS === false ? 0 : Math.round((hoje - ref) / 864e5);
    const shift = v => {
      if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return v;
      const d = new Date(v.length === 10 ? v + "T12:00:00" : v); d.setDate(d.getDate() + delta);
      return v.length === 10 ? d.toLocaleDateString("sv-SE") : d.toISOString();
    };
    const camposData = ["data", "Data", "DataVenc", "DataUltimaActividade", "DataResposta", "criadoEm", "dataPromessa", "concluidaEm"];
    const out = {};
    for (const col of COLECOES) {
      out[col] = ((window.DADOS_EXEMPLO && window.DADOS_EXEMPLO[col]) || []).map(r =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, camposData.includes(k) ? shift(v) : v])));
    }
    return out;
  }
  let dados;
  try { dados = JSON.parse(localStorage.getItem(chave)); } catch (_) {}
  if (!dados) dados = seed();
  const avisar = col => (subs[col] || []).forEach(cb => cb((dados[col] || []).map(r => ({ ...r }))));
  function mudar(col, fn) {
    const antes = dados[col] || [];
    dados[col] = fn(antes);
    try { localStorage.setItem(chave, JSON.stringify(dados)); }
    catch (_) { dados[col] = antes; const e = new Error("sem espaço"); e.code = "quota_exceeded"; throw e; }
    avisar(col);
  }
  try { localStorage.setItem(chave, JSON.stringify(dados)); } catch (_) {}
  return {
    subscribe(col, cb) {
      (subs[col] || (subs[col] = [])).push(cb);
      setTimeout(() => cb((dados[col] || []).map(r => ({ ...r }))));
      return () => { subs[col] = (subs[col] || []).filter(f => f !== cb); };
    },
    async add(col, data) { const id = novoId(); mudar(col, l => l.concat([{ id, ...data }])); return { id }; },
    async update(col, id, data) {
      if (!(dados[col] || []).some(x => x.id === id)) throw new Error("não encontrado");
      mudar(col, l => l.map(x => x.id === id ? { ...x, ...data } : x));
    },
    async set(col, id, data) { mudar(col, l => l.filter(x => x.id !== id).concat([{ id, ...data }])); },
    async remove(col, id) { mudar(col, l => l.filter(x => x.id !== id)); },
    repor() { dados = seed(); COLECOES.forEach(c => { try { localStorage.setItem(chave, JSON.stringify(dados)); } catch (_) {} avisar(c); }); }
  };
}

/* ---------- Adaptador REST (para a equipa de IT) ----------
   GET {API_BASE}/{colecao} ; POST (criar) ; PATCH /{id} (alterar) ; PUT /{id} ; DELETE /{id}
   Autenticação: Bearer token. Atualiza por polling a cada 15 s. */
function RestAdapter(base, getToken) {
  const loaders = {};
  const headers = () => ({ "Content-Type": "application/json", ...(getToken ? { Authorization: "Bearer " + getToken() } : {}) });
  const refresh = col => loaders[col] && loaders[col]();
  return {
    subscribe(col, cb, onErr) {
      loaders[col] = async () => {
        try { const r = await fetch(`${base}/${col}`, { headers: headers() }); if (!r.ok) throw new Error(r.status); cb(await r.json()); }
        catch (e) { onErr && onErr(e); }
      };
      loaders[col]();
      const t = setInterval(loaders[col], 15000);
      return () => { clearInterval(t); delete loaders[col]; };
    },
    async add(col, data) { const r = await fetch(`${base}/${col}`, { method: "POST", headers: headers(), body: JSON.stringify(data) }); refresh(col); return r.json(); },
    async update(col, id, data) { await fetch(`${base}/${col}/${id}`, { method: "PATCH", headers: headers(), body: JSON.stringify(data) }); refresh(col); },
    async set(col, id, data) { await fetch(`${base}/${col}/${id}`, { method: "PUT", headers: headers(), body: JSON.stringify(data) }); refresh(col); },
    async remove(col, id) { await fetch(`${base}/${col}/${id}`, { method: "DELETE", headers: headers() }); refresh(col); }
  };
}

/* ---------- Acesso (login) ----------
   AuthLocal: utilizadores de teste (utilizadores-exemplo.js), sem segurança real.
   AuthRest:  POST {API_BASE}/login -> { token, nome, perfil } ou 401. */
function AuthLocal() {
  return {
    async login(email, password) {
      const u = (window.UTILIZADORES_EXEMPLO || []).find(x => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
      if (!u) throw new Error("credenciais");
      return { email: u.email, nome: u.nome, perfil: u.perfil, token: null };
    }
  };
}
function AuthRest(base) {
  return {
    async login(email, password) {
      const r = await fetch(`${base}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (r.status === 401 || r.status === 403) throw new Error("credenciais");
      if (!r.ok) throw new Error("rede");
      const d = await r.json();
      return { email, nome: d.nome, perfil: d.perfil, token: d.token };
    }
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { LocalAdapter, RestAdapter, AuthLocal, AuthRest };
}
