import { api } from "./main.js";
import { button, content, node, notice, submit, value } from "./management.js";
import { avatar, badge, empty, normalize } from "./students.js";
const roleLabels: Record<string, string> = { owner: "Proprietário", admin: "Administrador", moderator: "Moderador", member: "Membro" };

export async function groups() {
  content(`<section><div class="page-heading"><div><p class="section-kicker">Comunidade</p><h2>Gestão de grupos</h2><p class="muted">Organize suas comunidades e cuide de quem participa.</p></div><button id="new-group" type="button">+ Criar grupo</button></div><section class="card"><div class="filter-bar"><label class="search-field"><span aria-hidden="true">⌕</span><input id="group-search" type="search" placeholder="Buscar grupo…" aria-label="Buscar grupos"></label><label class="filter-field"><span>Status</span><select id="group-status"><option value="all">Todos os grupos</option><option value="active">Ativos</option><option value="inactive">Desativados</option></select></label></div><p id="group-count" class="muted" role="status"></p><div id="group-list" class="content-grid" aria-live="polite">Carregando grupos…</div><div id="group-pagination" class="pagination"></div></section></section>`);
  document.querySelector<HTMLButtonElement>("#new-group")!.onclick = createGroup;
  const list = document.querySelector("#group-list")!;
  const rows: any[] = [];
  try {
    for (let offset = 0; ; offset += 200) {
      const batch = await api(`/portal/groups?offset=${offset}`); rows.push(...batch);
      if (batch.length < 200) break;
    }
  } catch (error) { list.replaceChildren(); empty(list, "Não foi possível carregar os grupos", "Tente novamente em instantes."); button("Tentar novamente", list, groups); notice((error as Error).message, "error"); return; }
  if (!list.isConnected) return;
  const search = document.querySelector<HTMLInputElement>("#group-search")!;
  const status = document.querySelector<HTMLSelectElement>("#group-status")!;
  let page = 1;
  const render = () => {
    const filtered = rows.filter(row => normalize(`${row.name} ${row.description || ""}`).includes(normalize(search.value.trim())) && (status.value === "all" || Boolean(row.active) === (status.value === "active")));
    const pages = Math.max(1, Math.ceil(filtered.length / 9)); page = Math.min(page, pages);
    document.querySelector("#group-count")!.textContent = `${filtered.length} ${filtered.length === 1 ? "grupo" : "grupos"}`;
    list.replaceChildren();
    if (!filtered.length) { const box = empty(list, "Nenhum grupo encontrado", rows.length ? "Ajuste sua busca ou o filtro de status." : "Crie seu primeiro grupo e convide os participantes."); button("Criar grupo", box, createGroup); }
    for (const row of filtered.slice((page - 1) * 9, page * 9)) {
      const card = node("article", "", list); card.className = "content-card group-card";
      const top = node("div", "", card); top.className = "content-card-head";
      avatar(top, row.name); badge(top, row.active ? "active" : "Desativado");
      node("h3", row.name, card); node("p", row.description || "Sem descrição.", card).className = "muted group-description";
      node("p", `${row.members ?? 0} ${Number(row.members) === 1 ? "participante" : "participantes"}`, card).className = "group-member-count";
      button("Gerenciar grupo →", card, () => groupDetail(row)).classList.add("primary-action");
    }
    const pagination = document.querySelector("#group-pagination")!; pagination.replaceChildren();
    button("← Anterior", pagination, () => { page--; render(); }).disabled = page === 1;
    node("span", `Página ${page} de ${pages}`, pagination).className = "page-indicator";
    button("Próxima →", pagination, () => { page++; render(); }).disabled = page === pages;
  };
  search.oninput = status.onchange = () => { page = 1; render(); }; render();
}
function createGroup() {
  content(`<section class="card narrow-card"><button id="back-groups" class="quiet" type="button">← Grupos</button><p class="section-kicker">Nova comunidade</p><h2>Criar grupo</h2><p class="muted">Use um nome reconhecível e conte aos participantes o objetivo deste espaço.</p><form id="group-form"><label>Nome do grupo<input name="name" minlength="2" maxlength="80" placeholder="Ex.: Turma da manhã" required></label><label>Descrição<textarea name="description" maxlength="500" placeholder="Para quem é este grupo? O que vocês vão compartilhar?"></textarea></label><button type="submit">Criar grupo</button></form></section>`);
  document.querySelector<HTMLButtonElement>("#back-groups")!.onclick = () => { void groups(); };
  submit("#group-form", async form => {
    const name = value(form, "name").trim(), description = value(form, "description").trim();
    const result = await api("/portal/groups", "POST", { name, description });
    await groupDetail({ id: result.id, name, description, active: true, members: 1 }); notice("Grupo criado. Convide seus primeiros participantes.");
  });
}
async function groupDetail(group: any) {
  content(`<section><button id="back-groups" class="quiet" type="button">← Todos os grupos</button><div class="card student-hero"><div><p class="section-kicker">Gestão da comunidade</p><h2 id="group-title"></h2><p id="group-description" class="muted"></p></div><div id="group-badge"></div></div><div class="student-tabs" id="group-tabs" aria-label="Seções do grupo"></div><section id="group-panel" class="card"></section></section>`);
  document.querySelector<HTMLButtonElement>("#back-groups")!.onclick = () => { void groups(); };
  document.querySelector("#group-title")!.textContent = group.name;
  document.querySelector("header h1")!.textContent = group.name;
  document.querySelector("header .muted")!.textContent = "Participantes, convites e configurações da sua comunidade.";
  document.querySelector("#group-description")!.textContent = group.description || "Sem descrição.";
  badge(document.querySelector("#group-badge")!, group.active ? "active" : "Desativado");
  const tabs = document.querySelector("#group-tabs")!, panel = document.querySelector("#group-panel")!;
  let version = 0;
  const members = async () => {
    const current = ++version;
    panel.innerHTML = `<div class="page-heading"><div><h3>Participantes</h3><p class="muted">Gerencie os papéis e o acesso ao grupo.</p></div></div><label>Buscar participante<input id="member-search" type="search" placeholder="Nome ou @usuário"></label><div id="member-list" aria-live="polite">Carregando participantes…</div>`;
    const list = panel.querySelector("#member-list")!;
    let rows: any[];
    try { rows = await api(`/portal/groups/${group.id}/members`); }
    catch (error) { if (current !== version) return; list.replaceChildren(); empty(list, "Não foi possível carregar os participantes", "Tente novamente para gerenciar este grupo."); button("Tentar novamente", list, members); notice((error as Error).message, "error"); return; }
    if (current !== version) return;
    const search = panel.querySelector<HTMLInputElement>("#member-search")!;
    const render = () => {
      list.replaceChildren();
      const filtered = rows.filter(row => normalize(`${row.displayName} ${row.username || ""}`).includes(normalize(search.value.trim())));
      if (!filtered.length) empty(list, "Nenhum participante encontrado", "Altere a busca ou convide alguém na seção de convites.");
      for (const row of filtered) {
        const item = node("article", "", list); item.className = "directory-row";
        avatar(item, row.displayName); const info = node("div", "", item); info.className = "row-main";
        node("h3", row.displayName, info); node("p", row.username ? `@${row.username}` : "Sem nome de usuário", info).className = "muted";
        node("span", roleLabels[row.role] || row.role, item).className = "chip neutral";
        if (row.role === "owner") continue;
        const details = node("details", "", item); details.className = "member-options";
        node("summary", "Gerenciar", details);
        const label = node("label", "Papel no grupo", details);
        const select = document.createElement("select"); select.setAttribute("aria-label", `Papel de ${row.displayName}`); label.append(select);
        for (const role of ["member", "moderator", "admin"]) select.append(new Option(roleLabels[role], role)); select.value = row.role;
        button("Salvar papel", details, async () => {
          await api(`/portal/groups/${group.id}/members`, "PATCH", { userId: row.id, action: "role", role: select.value });
          await members(); notice("Papel atualizado.");
        });
        button("Remover do grupo", details, async () => {
          if (!confirm(`Remover ${row.displayName} deste grupo?`)) return;
          await api(`/portal/groups/${group.id}/members`, "PATCH", { userId: row.id, action: "remove" });
          await members(); notice("Participante removido.");
        }).classList.add("danger-action");
      }
    }; search.oninput = render; render();
  };
  const invite = async () => {
    version++;
    if (!group.active) { panel.replaceChildren(); empty(panel, "Grupo desativado", "Reative o grupo em Configurações para convidar participantes."); return; }
    panel.innerHTML = `<div class="narrow-card"><h3>Convidar participante</h3><p class="muted">O participante recebe um convite no aplicativo e escolhe se deseja entrar.</p><form id="group-invite"><label>Nome de usuário<input name="username" minlength="3" maxlength="31" placeholder="@nomedousuario" required></label><p class="muted">Use o nome de usuário do aplicativo, sem espaços.</p><button type="submit">Enviar convite</button></form></div>`;
    submit("#group-invite", async form => { await api(`/portal/groups/${group.id}/invites`, "POST", { username: value(form, "username").trim().replace(/^@/, "") }); form.reset(); notice("Convite enviado. Aguarde o aceite no aplicativo."); });
  };
  const settings = async () => {
    version++;
    panel.innerHTML = `<div class="narrow-card"><h3>Informações do grupo</h3><form id="group-settings"><label>Nome<input name="name" minlength="2" maxlength="80" required></label><label>Descrição<textarea name="description" maxlength="500"></textarea></label><button type="submit">Salvar alterações</button></form><div class="danger-zone"><h3>Status do grupo</h3><p class="muted">Desativar interrompe novas interações. O histórico é preservado e o grupo pode ser reativado depois.</p><div id="group-status-action"></div></div></div>`;
    const form = panel.querySelector<HTMLFormElement>("#group-settings")!;
    (form.elements.namedItem("name") as HTMLInputElement).value = group.name;
    (form.elements.namedItem("description") as HTMLTextAreaElement).value = group.description || "";
    submit("#group-settings", async form => {
      const update = { name: value(form, "name").trim(), description: value(form, "description").trim(), active: Boolean(group.active) };
      await api(`/portal/groups/${group.id}`, "PATCH", update); Object.assign(group, update);
      document.querySelector("#group-title")!.textContent = group.name; document.querySelector("header h1")!.textContent = group.name; document.querySelector("#group-description")!.textContent = group.description || "Sem descrição."; notice("Informações do grupo atualizadas.");
    });
    button(group.active ? "Desativar grupo" : "Reativar grupo", panel.querySelector("#group-status-action")!, async () => {
      if (!confirm(group.active ? "Desativar este grupo e interromper novas interações?" : "Reativar este grupo?")) return;
      await api(`/portal/groups/${group.id}`, "PATCH", { name: group.name, description: group.description || "", active: !group.active });
      group.active = !group.active;
      document.querySelector("#group-badge")!.replaceChildren(); badge(document.querySelector("#group-badge")!, group.active ? "active" : "Desativado");
      await settings(); notice(group.active ? "Grupo reativado." : "Grupo desativado.");
    }).classList.add("danger-action");
  };
  for (const [label, action] of [["Participantes", members], ["Convidar", invite], ["Configurações", settings]] as const) {
    const tab = button(label, tabs, action);
    tab.addEventListener("click", () => tabs.querySelectorAll("button").forEach(item => { item.classList.toggle("active", item === tab); item.setAttribute("aria-pressed", String(item === tab)); }));
  }
  const first = tabs.querySelector("button")!; first.classList.add("active"); first.setAttribute("aria-pressed", "true"); await members();
}
