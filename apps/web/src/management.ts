import { api } from "./main.js";
import { library, groups, student } from "./library.js";
type Type = { id: string; name: string; capabilities: string[] };
export const names: Record<string, string> = {
  "fitness.view": "Treinos: visualizar",
  "fitness.suggest": "Treinos: sugerir",
  "fitness.manage": "Treinos: gerenciar",
  "nutrition.view": "Alimentação: visualizar",
  "nutrition.suggest": "Alimentação: sugerir",
  "nutrition.manage": "Alimentação: gerenciar",
  "body.view": "Medidas corporais: visualizar",
  "mental.view": "Mente: visualizar",
  "mental.suggest": "Mente: sugerir",
  "mental.manage": "Mente: gerenciar",
  "groups.manage": "Grupos: gerenciar",
};
export function notice(text: string) {
  const node = document.querySelector("#message");
  if (node) node.textContent = text;
}
export function content(html: string) {
  notice("");
  document.querySelector("#content")!.innerHTML = html;
  const title = document.querySelector("#content h2")?.textContent;
  if (title) document.querySelector("header h1")!.textContent = title;
  const subtitle = document.querySelector("header .muted");
  if (subtitle)
    subtitle.textContent =
      "Gerencie conteúdos e acompanhamentos com as permissões do seu perfil.";
}
export function node(tag: string, text: string, parent: Element) {
  const element = document.createElement(tag);
  element.textContent = text;
  parent.append(element);
  return element;
}
export function button(text: string, parent: Element, action: () => unknown) {
  const element = node("button", text, parent) as HTMLButtonElement;
  element.type = "button";
  element.className = "quiet";
  element.onclick = () => {
    void task(element, action);
  };
  return element;
}
export async function task(element: HTMLButtonElement, action: () => unknown) {
  element.disabled = true;
  try {
    await action();
  } catch (error) {
    notice((error as Error).message);
  } finally {
    element.disabled = false;
  }
}
export function checks(
  parent: Element,
  values: string[],
  selected: string[] = [],
) {
  parent.replaceChildren();
  for (const value of values) {
    const label = document.createElement("label");
    label.className = "check";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.checked = selected.includes(value);
    label.append(input, document.createTextNode(names[value] || value));
    parent.append(label);
  }
}
export function selected(parent: Element) {
  return [...parent.querySelectorAll<HTMLInputElement>("input:checked")].map(
    (input) => input.value,
  );
}
export function value(form: HTMLFormElement, name: string) {
  return (form.elements.namedItem(name) as HTMLInputElement).value;
}
export function submit(
  id: string,
  action: (form: HTMLFormElement) => Promise<void>,
) {
  const form = document.querySelector<HTMLFormElement>(id)!;
  form.onsubmit = (event) => {
    event.preventDefault();
    void task(form.querySelector("button[type=submit]")!, () => action(form));
  };
}
export function activation(done: () => Promise<void>) {
  document.querySelector("#app")!.innerHTML =
    '<main class="login card"><h1>Ative seu acesso</h1><p>Escolha sua senha definitiva. O acesso profissional respeita o consentimento de cada aluno e a sua área de atuação.</p><form id="activation"><label for="new-password">Nova senha (mínimo 12 caracteres)</label><input name="password" id="new-password" type="password" minlength="12" maxlength="72" autocomplete="new-password" required><label class="check"><input name="terms" type="checkbox" required>Concordo em usar os dados somente para o acompanhamento autorizado e respeitar a privacidade dos alunos.</label><p id="message" role="alert"></p><button type="submit">Ativar conta</button></form></main>';
  submit("#activation", async (form) => {
    await api("/portal/activate", "POST", {
      password: value(form, "password"),
      acceptTerms: true,
    });
    await done();
  });
}
export function managementNav(
  access: { role: string; capabilities: string[] },
  home: () => void,
) {
  const nav = document.querySelector("nav")!;
  nav.replaceChildren();
  const group = (label: string) => {
    const section = document.createElement("div");
    section.className = "nav-group";
    const title = document.createElement("p");
    title.className = "nav-label";
    title.textContent = label;
    section.append(title);
    nav.append(section);
    return section;
  };
  const item = (
    label: string,
    icon: string,
    parent: Element,
    action: () => unknown,
  ) => {
    const element = document.createElement("button");
    element.type = "button";
    element.innerHTML = `<span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
    element.onclick = () => {
      nav.querySelectorAll("button").forEach((entry) =>
        entry.classList.remove("active"),
      );
      element.classList.add("active");
      void task(element, action);
    };
    parent.append(element);
    return element;
  };
  const management = group("Gestão");
  if (access.role === "admin") {
    item("Tipos profissionais", "▦", management, home).classList.add(
      "active",
    );
    item("Profissionais", "◉", management, professionals);
    item("Editar tipos", "✎", management, editTypes);
    item("Auditoria", "≡", management, audit);
  } else
    item(
      "Alunos e convites",
      "◉",
      management,
      () => relationships(access.capabilities),
    ).classList.add("active");

  const categories = [
    {
      label: "Fitness",
      icon: "◇",
      area: "fitness",
      entries: [
        ["exercise", "Exercícios", "▷"],
        ["workout", "Fichas de treino", "☷"],
        ["goal", "Metas", "◎"],
      ],
    },
    {
      label: "Nutrição",
      icon: "○",
      area: "nutrition",
      entries: [
        ["food", "Alimentos", "◌"],
        ["diet", "Dietas", "☰"],
      ],
    },
    {
      label: "Saúde & bem-estar",
      icon: "+",
      area: "mental",
      entries: [["guidance", "Saúde mental", "∿"]],
    },
  ];
  for (const category of categories) {
    if (
      access.role !== "admin" &&
      !access.capabilities.some((cap) => cap.startsWith(`${category.area}.`))
    )
      continue;
    const section = group(`${category.icon}  ${category.label}`);
    for (const [kind, label, icon] of category.entries)
      item(label, icon, section, () => library(kind, access));
  }

  const organization = group("Organização");
  if (access.role === "admin")
    item("Categorias", "▦", organization, () => library("category", access));
  if (access.role === "admin" || access.capabilities.includes("groups.manage"))
    item("Grupos", "◈", organization, groups);
  item("Segurança da conta", "□", organization, changePassword);
}
async function changePassword() {
  content(
    '<section class="card"><h2>Alterar senha</h2><p class="muted">Use uma senha forte com pelo menos 12 caracteres. Ao salvar, as outras sessões serão encerradas.</p><form id="change-password"><label>Senha atual<input name="currentPassword" type="password" autocomplete="current-password" maxlength="72" required></label><label>Nova senha<input name="newPassword" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label><label>Confirmar nova senha<input name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label><button type="submit">Alterar senha</button></form></section>',
  );
  submit("#change-password", async (form) => {
    const password = value(form, "newPassword");
    if (password !== value(form, "confirmation"))
      throw new Error("A confirmação da nova senha não confere.");
    await api("/portal/password", "PATCH", {
      currentPassword: value(form, "currentPassword"),
      newPassword: password,
    });
    form.reset();
    notice("Senha alterada. Entre novamente nos outros dispositivos.");
  });
}
async function editTypes() {
  content(
    '<section class="card"><h2>Editar tipos profissionais</h2><p class="muted">Remover uma capacidade interrompe esse acesso imediatamente. Adicionar uma capacidade não amplia o consentimento dos alunos.</p><div id="types-edit">Carregando…</div></section>',
  );
  const types: Type[] = await api("/portal/professional-types");
  const target = document.querySelector("#types-edit")!;
  target.replaceChildren();
  for (const type of types) {
    const section = document.createElement("section");
    section.className = "item";
    target.append(section);
    const input = document.createElement("input");
    input.value = type.name;
    input.maxLength = 80;
    input.setAttribute("aria-label", "Nome do tipo");
    section.append(input);
    const caps = document.createElement("fieldset");
    section.append(caps);
    checks(caps, Object.keys(names), type.capabilities);
    button("Salvar alterações", section, async () => {
      await api(`/portal/professional-types/${type.id}`, "PATCH", {
        name: input.value,
        capabilities: selected(caps),
      });
      notice("Tipo atualizado.");
    });
  }
  if (!types.length) target.textContent = "Nenhum tipo cadastrado.";
}
async function professionals() {
  content(
    '<div class="grid"><section class="card"><h2>Cadastrar profissional</h2><form id="professional"><label>Nome<input name="firstName" required minlength="2" maxlength="60"></label><label>Sobrenome<input name="lastName" required minlength="2" maxlength="60"></label><label>E-mail<input name="email" type="email" required maxlength="254"></label><label>Telefone<input name="phone" required minlength="10" maxlength="20"></label><label>Tipo<select name="typeId" required></select></label><fieldset id="profile-caps"></fieldset><button type="submit">Criar acesso temporário</button></form><div id="credential" role="status"></div></section><section class="card"><h2>Profissionais</h2><div id="profiles">Carregando…</div></section></div>',
  );
  const types: Type[] = await api("/portal/professional-types");
  const form = document.querySelector<HTMLFormElement>("#professional")!;
  const select = form.elements.namedItem("typeId") as HTMLSelectElement;
  for (const type of types) {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.name;
    select.append(option);
  }
  const caps = document.querySelector("#profile-caps")!;
  select.onchange = () =>
    checks(caps, types.find((t) => t.id === select.value)?.capabilities || []);
  select.onchange(new Event("change"));
  submit("#professional", async (form) => {
    const result = await api("/portal/professionals", "POST", {
      firstName: value(form, "firstName"),
      lastName: value(form, "lastName"),
      email: value(form, "email"),
      phone: value(form, "phone"),
      typeId: select.value,
      capabilities: selected(caps),
    });
    const target = document.querySelector("#credential")!;
    target.replaceChildren();
    node("h3", "Credencial temporária — entregue ao profissional", target);
    node("p", `E-mail: ${result.email}`, target);
    node("code", result.temporaryPassword, target);
    node(
      "p",
      "Válida por 48 horas. A senha definitiva será escolhida no primeiro acesso. Copie agora; esta senha não será exibida novamente.",
      target,
    );
    form.reset();
    await load();
  });
  const load = async () => {
    const rows = await api("/portal/professionals");
    const target = document.querySelector("#profiles")!;
    target.replaceChildren();
    if (!rows.length) target.textContent = "Nenhum profissional cadastrado.";
    for (const row of rows) {
      const section = document.createElement("article");
      section.className = "item";
      target.append(section);
      node("h3", `${row.firstName} ${row.lastName}`, section);
      node(
        "p",
        `${row.email} • ${row.suspended ? "Suspenso" : row.activatedAt ? "Ativo" : "Aguardando ativação"}`,
        section,
      );
      const basics = document.createElement("div");
      basics.className = "grid";
      section.append(basics);
      const firstName = document.createElement("input");
      firstName.value = row.firstName;
      firstName.placeholder = "Nome";
      firstName.maxLength = 60;
      const lastName = document.createElement("input");
      lastName.value = row.lastName;
      lastName.placeholder = "Sobrenome";
      lastName.maxLength = 60;
      const email = document.createElement("input");
      email.value = row.email;
      email.type = "email";
      email.placeholder = "E-mail";
      const phone = document.createElement("input");
      phone.value = row.phone;
      phone.placeholder = "Telefone";
      basics.append(firstName, lastName, email, phone);
      const typeSelect = document.createElement("select");
      typeSelect.setAttribute("aria-label", "Tipo profissional");
      for (const type of types) {
        const opt = document.createElement("option");
        opt.value = type.id;
        opt.textContent = type.name;
        typeSelect.append(opt);
      }
      typeSelect.value = row.typeId;
      section.append(typeSelect);
      const perms = document.createElement("fieldset");
      section.append(perms);
      checks(
        perms,
        types.find((t) => t.id === row.typeId)?.capabilities || [],
        row.capabilities,
      );
      typeSelect.onchange = () =>
        checks(
          perms,
          types.find((t) => t.id === typeSelect.value)?.capabilities || [],
        );
      button("Salvar dados e permissões", section, async () => {
        await api(`/portal/professionals/${row.id}`, "PATCH", {
          firstName: firstName.value,
          lastName: lastName.value,
          email: email.value,
          phone: phone.value,
          typeId: typeSelect.value,
          capabilities: selected(perms),
          suspended: row.suspended,
        });
        notice("Permissões atualizadas.");
      });
      button(row.suspended ? "Reativar" : "Suspender", section, async () => {
        if (!confirm("Confirmar alteração de acesso deste profissional?"))
          return;
        await api(`/portal/professionals/${row.id}`, "PATCH", {
          firstName: firstName.value,
          lastName: lastName.value,
          email: email.value,
          phone: phone.value,
          typeId: typeSelect.value,
          capabilities: selected(perms),
          suspended: !row.suspended,
        });
        await load();
      });
      if (!row.activatedAt)
        button("Gerar nova credencial", section, async () => {
          const result = await api(
            `/portal/professionals/${row.id}/reset-activation`,
            "POST",
          );
          const target = document.querySelector("#credential")!;
          target.replaceChildren();
          node("p", `Nova credencial para ${row.email} (48 horas)`, target);
          node("code", result.temporaryPassword, target);
        });
    }
  };
  await load();
}
async function relationships(capabilities: string[]) {
  content(
    '<div class="grid"><section class="card"><h2>Convidar aluno</h2><p class="muted">O aluno precisa aceitar as áreas de acesso pelo aplicativo. O convite vale por 7 dias.</p><form id="invite"><label>E-mail do aluno<input name="email" type="email" maxlength="254" required></label><fieldset id="invite-caps"></fieldset><button type="submit">Enviar convite</button></form></section><section class="card"><h2>Alunos e convites</h2><div id="relationships">Carregando…</div></section></div>',
  );
  checks(document.querySelector("#invite-caps")!, capabilities);
  submit("#invite", async (form) => {
    const result = await api("/portal/invitations", "POST", {
      email: value(form, "email"),
      capabilities: selected(document.querySelector("#invite-caps")!),
    });
    form.reset();
    notice(result.message);
    await load();
  });
  const load = async () => {
    const rows = await api("/portal/relationships");
    const target = document.querySelector("#relationships")!;
    target.replaceChildren();
    if (!rows.length) target.textContent = "Nenhum aluno ou convite.";
    for (const row of rows) {
      const section = document.createElement("article");
      section.className = "item";
      target.append(section);
      node("h3", row.studentName || "Convite enviado", section);
      node(
        "p",
        `${row.status} • ${row.capabilities.map((cap: string) => names[cap]).join(", ")}`,
        section,
      );
      if (row.status === "active")
        button("Abrir acompanhamento", section, () => student(row));
      if (["active", "pending"].includes(row.status))
        button("Encerrar vínculo / cancelar convite", section, async () => {
          if (!confirm("Encerrar acesso a este aluno?")) return;
          await api(`/portal/relationships/${row.id}/end`, "POST");
          await load();
        });
    }
  };
  await load();
}
async function audit() {
  content(
    '<section class="card"><div class="section-heading"><div><p class="section-kicker">Segurança</p><h2>Auditoria</h2><p class="muted">Últimos 200 eventos administrativos.</p></div></div><div class="filter-bar compact"><label class="search-field"><span aria-hidden="true">⌕</span><input id="audit-search" type="search" placeholder="Buscar ação ou recurso…" aria-label="Buscar eventos"></label></div><p id="audit-count" class="muted"></p><div id="events">Carregando…</div><div id="audit-pagination" class="pagination"></div></section>',
  );
  const events = await api("/portal/audit");
  const search = document.querySelector<HTMLInputElement>("#audit-search")!;
  let page = 1;
  const pageSize = 15;
  const render = () => {
    const query = search.value.trim().toLocaleLowerCase("pt-BR");
    const filtered = events.filter((event: any) =>
      `${event.action} ${event.resourceId}`.toLocaleLowerCase("pt-BR").includes(query),
    );
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pages);
    const target = document.querySelector("#events")!;
    target.replaceChildren();
    for (const event of filtered.slice((page - 1) * pageSize, page * pageSize)) {
      const item = document.createElement("article");
      item.className = "audit-row";
      target.append(item);
      const date = node(
        "time",
        new Date(event.createdAt).toLocaleString("pt-BR"),
        item,
      );
      date.setAttribute("datetime", event.createdAt);
      const action = node("strong", event.action, item);
      action.className = "audit-action";
      node("code", event.resourceId, item);
    }
    if (!filtered.length) target.textContent = "Nenhum evento encontrado.";
    document.querySelector("#audit-count")!.textContent =
      `${filtered.length} ${filtered.length === 1 ? "evento" : "eventos"}`;
    const pagination = document.querySelector("#audit-pagination")!;
    pagination.replaceChildren();
    const previous = button("← Anterior", pagination, () => {
      page--;
      render();
    });
    previous.disabled = page === 1;
    node("span", `Página ${page} de ${pages}`, pagination).className =
      "page-indicator";
    const next = button("Próxima →", pagination, () => {
      page++;
      render();
    });
    next.disabled = page === pages;
  };
  search.oninput = () => {
    page = 1;
    render();
  };
  render();
}
