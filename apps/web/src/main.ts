import { managementNav, activation } from "./management.js";
const root = document.querySelector<HTMLDivElement>("#app")!;
let accessToken = "";
let refreshToken = "";
let refreshInFlight: Promise<void> | null = null;
type ProfessionalType = { id: string; name: string; capabilities: string[] };
const areas: Record<string, string[]> = {
  Fitness: ["fitness.view", "fitness.suggest", "fitness.manage"],
  Alimentação: ["nutrition.view", "nutrition.suggest", "nutrition.manage"],
  "Progresso corporal": ["body.view"],
  Mente: ["mental.view", "mental.suggest", "mental.manage"],
  Grupos: ["groups.manage"],
};
const labels: Record<string, string> = {
  view: "Visualizar",
  suggest: "Sugerir",
  manage: "Gerenciar",
};
export async function api(
  path: string,
  method = "GET",
  body?: unknown,
  retry = true,
): Promise<any> {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 401 && accessToken && refreshToken && retry) {
    if (!refreshInFlight)
      refreshInFlight = (async () => {
        const result = await fetch("/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!result.ok) throw new Error("Sessão expirada. Entre novamente.");
        const session = await result.json();
        accessToken = session.accessToken;
        refreshToken = session.refreshToken;
      })().finally(() => {
        refreshInFlight = null;
      });
    try {
      await refreshInFlight;
      return await api(path, method, body, false);
    } catch (error) {
      accessToken = "";
      refreshToken = "";
      login();
      throw error;
    }
  }
  if (response.status === 401 && accessToken) {
    accessToken = "";
    refreshToken = "";
    login();
    throw new Error("Sessão expirada. Entre novamente.");
  }
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok)
    throw new Error(data.message || "Não foi possível concluir a solicitação.");
  return data;
}
function message(text: string) {
  const target = document.querySelector("#message");
  if (target) target.textContent = text;
}
function login() {
  root.innerHTML = `<main class="login-shell"><section class="login-intro"><div class="brand brand-light"><span class="brand-mark">F</span><span>Fit</span><span class="badge">Portal</span></div><div class="login-copy"><p class="eyebrow">Cuidado integrado</p><h1>Gestão profissional que acompanha cada evolução.</h1><p>Organize treinos, nutrição e bem-estar em um só lugar, com privacidade e clareza para sua equipe.</p></div><div class="login-feature"><span>✦</span><p><strong>Visão completa</strong><br>Conteúdos e acompanhamentos organizados por área.</p></div></section><section class="login-panel"><div class="login card"><p class="eyebrow">Espaço profissional</p><h2>Boas-vindas</h2><p class="muted">Entre com o acesso fornecido pelo administrador.</p><form id="login"><label for="email">E-mail</label><input id="email" type="email" autocomplete="username" required maxlength="254" placeholder="voce@exemplo.com"><label for="password">Senha</label><input id="password" type="password" autocomplete="current-password" required maxlength="72" placeholder="Sua senha"><p id="message" role="alert"></p><button class="button-wide">Entrar no portal <span aria-hidden="true">→</span></button></form></div></section></main>`;
  document.querySelector<HTMLFormElement>("#login")!.onsubmit = async (
    event,
  ) => {
    event.preventDefault();
    const button = document.querySelector<HTMLButtonElement>("button")!;
    button.disabled = true;
    message("");
    try {
      const auth = await api("/auth/login", "POST", {
        email: document.querySelector<HTMLInputElement>("#email")!.value,
        password: document.querySelector<HTMLInputElement>("#password")!.value,
      });
      accessToken = auth.accessToken;
      refreshToken = auth.refreshToken;
      await dashboard();
    } catch (error) {
      await logout(false);
      message((error as Error).message);
    } finally {
      button.disabled = false;
    }
  };
}
async function logout(render = true) {
  const token = refreshToken;
  accessToken = "";
  refreshToken = "";
  if (token)
    await api("/auth/logout", "POST", { refreshToken: token }).catch(() => {});
  if (render) login();
}
async function dashboard() {
  const access = await api("/portal/profile");
  if (access.requiresActivation) {
    activation(async () => {
      await logout();
      message("Conta ativada. Entre com sua nova senha.");
    });
    return;
  }
  root.innerHTML = `<div class="shell"><aside><div class="sidebar-top"><div class="brand"><span class="brand-mark">F</span><span>Fit</span><span class="badge">Portal</span></div><div class="account-chip"><span class="account-avatar">${access.role === "admin" ? "A" : "P"}</span><span><strong>${access.role === "admin" ? "Administração" : "Profissional"}</strong><small>Fit</small></span></div></div><nav aria-label="Principal"><button>Visão geral</button></nav><div class="sidebar-footer"><span class="status-dot"></span><span>Sistema online</span></div></aside><main class="workspace"><header><div><p class="eyebrow">Fit <span aria-hidden="true">/</span> Gestão</p><h1>${access.role === "admin" ? "Tipos profissionais" : "Seu espaço profissional"}</h1><p class="muted">${access.role === "admin" ? "Defina as áreas de atuação e as capacidades de cada perfil." : "Gerencie alunos, conteúdos e acompanhamentos em um só lugar."}</p></div><button class="icon-button" id="logout" title="Sair do portal" aria-label="Sair do portal"><span aria-hidden="true">↱</span></button></header><p id="message" role="status" aria-live="polite"></p><div id="content"></div></main></div>`;
  document.querySelector<HTMLButtonElement>("#logout")!.onclick = () => {
    void logout();
  };
  managementNav(access, () => {
    void dashboard();
  });
  if (access.role !== "admin") {
    document.querySelector<HTMLButtonElement>("nav button")?.click();
    return;
  }
  document.querySelector("#content")!.innerHTML =
    `<div class="summary-grid"><article class="metric-card"><span class="metric-icon fitness">◇</span><div><small>Organização</small><strong>Perfis por especialidade</strong></div></article><article class="metric-card"><span class="metric-icon nutrition">○</span><div><small>Segurança</small><strong>Acesso por permissão</strong></div></article><article class="metric-card"><span class="metric-icon health">+</span><div><small>Privacidade</small><strong>Consentimento do aluno</strong></div></article></div><div class="grid"><section class="card"><div class="section-heading"><div><p class="section-kicker">Novo cadastro</p><h2>Novo tipo profissional</h2></div></div><p class="muted">Defina um perfil e escolha exatamente quais áreas ele poderá acessar.</p><form id="type-form"><label for="name">Nome do tipo</label><input id="name" required minlength="2" maxlength="80" placeholder="Ex.: Personal trainer"><div id="capabilities"></div><button>Salvar tipo</button></form></section><section class="card"><div class="section-heading"><div><p class="section-kicker">Equipe</p><h2>Perfis cadastrados</h2></div></div><div id="types" aria-live="polite" class="stack-list">Carregando…</div></section></div>`;
  const fields = document.querySelector("#capabilities")!;
  for (const [area, capabilities] of Object.entries(areas)) {
    const field = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = area;
    field.append(legend);
    for (const capability of capabilities) {
      const label = document.createElement("label");
      label.className = "check";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = capability;
      label.append(
        input,
        document.createTextNode(labels[capability.split(".")[1]]),
      );
      field.append(label);
    }
    fields.append(field);
  }
  const load = async () => {
    const target = document.querySelector("#types")!;
    try {
      const types: ProfessionalType[] = await api("/portal/professional-types");
      target.replaceChildren();
      if (!types.length)
        target.textContent =
          "Nenhum tipo cadastrado. Crie o primeiro perfil ao lado.";
      for (const type of types) {
        const item = document.createElement("article");
        item.className = "item";
        const heading = document.createElement("strong");
        heading.textContent = type.name;
        const text = document.createElement("p");
        text.className = "muted";
        text.textContent =
          type.capabilities
            .map(
              (cap) =>
                `${Object.entries(areas).find(([, values]) => values.includes(cap))?.[0]}: ${labels[cap.split(".")[1]]}`,
            )
            .join(" • ") || "Sem capacidades concedidas";
        item.append(heading, text);
        target.append(item);
      }
    } catch (error) {
      target.textContent = "Falha ao carregar os perfis.";
      message((error as Error).message);
    }
  };
  document.querySelector<HTMLFormElement>("#type-form")!.onsubmit = async (
    event,
  ) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const button = form.querySelector("button")!;
    button.disabled = true;
    try {
      await api("/portal/professional-types", "POST", {
        name: document.querySelector<HTMLInputElement>("#name")!.value.trim(),
        capabilities: [
          ...fields.querySelectorAll<HTMLInputElement>("input:checked"),
        ].map((input) => input.value),
      });
      form.reset();
      message("Tipo profissional cadastrado.");
      await load();
    } catch (error) {
      message((error as Error).message);
    } finally {
      button.disabled = false;
    }
  };
  await load();
}
login();
