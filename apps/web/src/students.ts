import { api } from "./main.js";
import { button, checks, content, node, notice, selected, submit, value } from "./management.js";
import { student } from "./library.js";

export const statusLabels: Record<string, string> = { active: "Ativo", pending: "Aguardando aceite", expired: "Expirado", ended: "Encerrado", declined: "Recusado", revoked: "Revogado", replaced: "Substituído", superseded: "Substituído", accepted: "Aceito", rejected: "Recusado", cancelled: "Cancelado", suggested: "Aguardando aceite" };
export const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export function empty(parent: Element, title: string, description: string) {
  const box = node("div", "", parent); box.className = "empty-state";
  node("h3", title, box); node("p", description, box);
  return box;
}
export function badge(parent: Element, status: string) {
  node("span", statusLabels[status] || status, parent).className = `chip ${status === "active" ? "active" : "neutral"}`;
}
export function avatar(parent: Element, name: string) {
  node("span", name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?", parent).className = "person-avatar";
}
// Optional offset keeps the legacy array response while allowing the portal to load every page.
export async function allRelationships() {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 200) {
    const batch = await api(`/portal/relationships?offset=${offset}`);
    rows.push(...batch);
    if (batch.length < 200) return rows;
  }
}
export async function students(capabilities: string[]) {
  content(`<section class="directory-page"><div class="page-heading"><div><p class="section-kicker">Acompanhamento</p><h2>Meus alunos</h2><p class="muted">Cada aluno, seu plano e seu próximo passo. Tudo começa aqui.</p></div><button id="new-student" type="button">+ Convidar aluno</button></div><div id="student-metrics" class="summary-grid"></div><section class="card"><div class="filter-bar"><label class="search-field"><span aria-hidden="true">⌕</span><input id="student-search" type="search" placeholder="Buscar aluno pelo nome…" aria-label="Buscar alunos"></label><label class="filter-field"><span>Vínculo</span><select id="student-filter"><option value="active">Alunos ativos</option><option value="pending">Convites pendentes</option><option value="all">Todos os vínculos</option><option value="closed">Encerrados e expirados</option></select></label></div><div class="result-heading"><p id="student-count" class="muted" role="status"></p></div><div id="student-list" aria-live="polite">Carregando alunos…</div><div id="student-pagination" class="pagination"></div></section></section>`);
  document.querySelector("header .muted")!.textContent = "Organize sua carteira e abra o painel de cada acompanhamento.";
  document.querySelector<HTMLButtonElement>("#new-student")!.onclick = () => inviteStudent(capabilities);
  const list = document.querySelector("#student-list")!;
  let rows: any[];
  try { rows = await allRelationships(); }
  catch (error) { list.replaceChildren(); empty(list, "Não foi possível carregar seus alunos", "Tente novamente para continuar o acompanhamento."); button("Tentar novamente", list, () => students(capabilities)); notice((error as Error).message, "error"); return; }
  if (!list.isConnected) return;
  const metrics = document.querySelector("#student-metrics")!;
  for (const [label, count] of [["Alunos ativos", rows.filter(r => r.status === "active").length], ["Convites pendentes", rows.filter(r => r.status === "pending").length], ["Total de vínculos", rows.length]]) {
    const metric = node("article", "", metrics); metric.className = "metric-card";
    const wrap = node("div", "", metric); node("small", String(label), wrap); node("strong", String(count), wrap);
  }
  const search = document.querySelector<HTMLInputElement>("#student-search")!;
  const filter = document.querySelector<HTMLSelectElement>("#student-filter")!;
  let page = 1;
  const render = () => {
    const filtered = rows.filter(row => normalize(row.studentName || "Convite enviado").includes(normalize(search.value.trim())) && (filter.value === "all" || (filter.value === "closed" ? !["active", "pending"].includes(row.status) : row.status === filter.value)));
    filtered.sort((a, b) => (a.studentName || "").localeCompare(b.studentName || "", "pt-BR"));
    const pages = Math.max(1, Math.ceil(filtered.length / 12)); page = Math.min(page, pages);
    document.querySelector("#student-count")!.textContent = `${filtered.length} ${filter.value === "active" ? (filtered.length === 1 ? "aluno" : "alunos") : (filtered.length === 1 ? "vínculo" : "vínculos")} • ordem alfabética`;
    list.replaceChildren();
    if (!filtered.length) { const box = empty(list, search.value ? "Nenhum aluno encontrado" : filter.value === "pending" ? "Nenhum convite pendente" : "Nenhum aluno nesta lista", search.value ? "Experimente outro nome ou altere o filtro." : "Convide um aluno e aguarde o aceite no aplicativo para começar."); button("Convidar aluno", box, () => inviteStudent(capabilities)); }
    for (const row of filtered.slice((page - 1) * 12, page * 12)) {
      const item = node("article", "", list); item.className = "directory-row";
      avatar(item, row.studentName || "Convite");
      const info = node("div", "", item); info.className = "row-main";
      node("h3", row.studentName || "Convite enviado", info);
      const areas = [...new Set<string>(row.capabilities.map((c: string) => ({ fitness: "Treinos", nutrition: "Alimentação", body: "Medidas", mental: "Bem-estar", groups: "Grupos" })[c.split(".")[0] as "fitness"]))];
      node("p", areas.join(" · ") || "Sem acesso concedido", info).className = "muted";
      badge(item, row.status);
      const actions = node("div", "", item); actions.className = "row-actions";
      if (row.status === "pending") node("p", `Enviado em ${new Date(row.createdAt).toLocaleDateString("pt-BR")} · válido até ${new Date(row.expiresAt).toLocaleDateString("pt-BR")}`, info).className = "muted";
      if (row.status === "active") button("Abrir painel →", actions, () => student(row, () => students(capabilities))).classList.add("primary-action");
      if (["active", "pending"].includes(row.status)) button(row.status === "pending" ? "Cancelar convite" : "Encerrar vínculo", actions, async () => {
        if (!confirm(row.status === "pending" ? "Cancelar este convite?" : "Encerrar o vínculo? Seu acesso será retirado; o histórico do aluno será preservado.")) return;
        await api(`/portal/relationships/${row.id}/end`, "POST"); await students(capabilities); notice("Vínculo encerrado.");
      }).classList.add("danger-action");
    }
    const pagination = document.querySelector("#student-pagination")!; pagination.replaceChildren();
    button("← Anterior", pagination, () => { page--; render(); }).disabled = page === 1;
    node("span", `Página ${page} de ${pages}`, pagination).className = "page-indicator";
    button("Próxima →", pagination, () => { page++; render(); }).disabled = page === pages;
  };
  search.oninput = filter.onchange = () => { page = 1; render(); }; render();
}
function inviteStudent(capabilities: string[]) {
  content(`<section class="card narrow-card"><button id="back-students" class="quiet" type="button">← Meus alunos</button><p class="section-kicker">Novo acompanhamento</p><h2>Convidar aluno</h2><p class="muted">Escolha apenas as áreas necessárias. O aluno confirma o acesso no aplicativo; o convite vale por 7 dias.</p><form id="invite"><label>E-mail do aluno<input name="email" type="email" maxlength="254" placeholder="aluno@exemplo.com" required></label><fieldset><legend>Permissões solicitadas</legend><div id="invite-caps"></div></fieldset><button type="submit">Enviar convite</button></form></section>`);
  document.querySelector<HTMLButtonElement>("#back-students")!.onclick = () => { void students(capabilities); };
  checks(document.querySelector("#invite-caps")!, capabilities);
  submit("#invite", async form => {
    const caps = selected(document.querySelector("#invite-caps")!);
    if (!caps.length) throw new Error("Selecione ao menos uma permissão para o acompanhamento.");
    const result = await api("/portal/invitations", "POST", { email: value(form, "email"), capabilities: caps });
    await students(capabilities); notice(result.message);
  });
}
