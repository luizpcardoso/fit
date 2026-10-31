import { api } from "./main.js";
import {
  button,
  checks,
  content,
  node,
  notice,
  selected,
  submit,
  value,
  names,
} from "./management.js";
const titles: Record<string, string> = {
  food: "Alimentos",
  exercise: "Exercícios",
  workout: "Fichas de treino",
  diet: "Dietas",
  goal: "Metas",
  guidance: "Saúde mental",
  category: "Categorias",
};
const descriptions: Record<string, string> = {
  food: "Organize os alimentos usados na criação de planos alimentares.",
  exercise: "Consulte e mantenha o catálogo de movimentos disponíveis.",
  workout: "Crie modelos de treino e reutilize-os no acompanhamento dos alunos.",
  diet: "Gerencie modelos de dieta, refeições e alternativas alimentares.",
  goal: "Defina modelos de metas semanais para diferentes perfis.",
  guidance: "Centralize orientações e ações de cuidado emocional.",
  category: "Estruture o conteúdo do portal por área de atuação.",
};
const categoryLabels: Record<string, string> = {
  strength: "Força",
  cardio: "Cardio",
  mobility: "Mobilidade",
  flexibility: "Flexibilidade",
  functional: "Funcional",
  fitness: "Fitness",
  nutrition: "Nutrição",
  mental: "Saúde mental",
  general: "Geral",
};
function input(
  parent: Element,
  label: string,
  name: string,
  val: unknown = "",
  type = "text",
  required = true,
) {
  const wrap = document.createElement("label");
  wrap.append(document.createTextNode(label));
  const element = document.createElement("input");
  element.name = name;
  element.type = type;
  element.value = String(val ?? "");
  element.required = required;
  element.maxLength = type === "text" ? 120 : 2000;
  if (type === "number") {
    element.min = "0";
    element.max = "100000";
    element.step = "any";
  }
  wrap.append(element);
  parent.append(wrap);
  return element;
}
function text(parent: Element, label: string, name: string, val = "") {
  const wrap = document.createElement("label");
  wrap.append(document.createTextNode(label));
  const element = document.createElement("textarea");
  element.name = name;
  element.value = val;
  element.maxLength = 2000;
  element.rows = 3;
  wrap.append(element);
  parent.append(wrap);
  return element;
}
function select(
  parent: Element,
  label: string,
  name: string,
  options: [string, string][],
  val = "",
) {
  const wrap = document.createElement("label");
  wrap.append(document.createTextNode(label));
  const element = document.createElement("select");
  element.name = name;
  for (const [key, label] of options) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = label;
    element.append(opt);
  }
  if (val) element.value = val;
  wrap.append(element);
  parent.append(wrap);
  return element;
}
const read = (element: Element, name: string) =>
  (element.querySelector(`[name="${name}"]`) as HTMLInputElement).value;
const num = (element: Element, name: string) => Number(read(element, name));
function foodFields(parent: Element, data: any = {}) {
  input(parent, "Nome do alimento", "foodName", data.name || "");
  input(
    parent,
    "Porção de referência",
    "servingAmount",
    data.servingAmount ?? 100,
    "number",
  );
  select(
    parent,
    "Unidade",
    "servingUnit",
    [
      ["g", "g"],
      ["ml", "ml"],
      ["unit", "unidade"],
    ],
    data.servingUnit || "g",
  );
  for (const [key, label] of [
    ["calories", "Calorias (kcal)"],
    ["protein", "Proteínas (g)"],
    ["carbs", "Carboidratos (g)"],
    ["fat", "Gorduras (g)"],
  ])
    input(parent, label, key, data[key] ?? 0, "number");
}
function readFood(parent: Element) {
  return {
    name: read(parent, "foodName"),
    servingAmount: num(parent, "servingAmount"),
    servingUnit: read(parent, "servingUnit"),
    calories: num(parent, "calories"),
    protein: num(parent, "protein"),
    carbs: num(parent, "carbs"),
    fat: num(parent, "fat"),
    notes: "",
  };
}
function summary(parent: Element, item: any) {
  if (item.kind === "food")
    node(
      "p",
      `${item.data.servingAmount} ${item.data.servingUnit} • ${item.data.calories} kcal • P ${item.data.protein} / C ${item.data.carbs} / G ${item.data.fat} g`,
      parent,
    );
  else if (item.kind === "workout")
    for (const division of item.data.divisions) {
      node("h4", division.name, parent);
      for (const ex of division.exercises)
        node(
          "p",
          `${ex.name} • ${ex.sets} × ${ex.reps} • ${ex.load ?? "—"} kg • descanso ${ex.restSeconds ?? "—"} s${ex.notes ? ` • ${ex.notes}` : ""}`,
          parent,
        );
    }
  else if (item.kind === "diet") {
    node("p", item.data.objective, parent);
    for (const meal of item.data.meals) {
      node("h4", `${meal.name} ${meal.time || ""}`, parent);
      node("h4", `${meal.name} A`, parent);
      for (const entry of meal.items)
        node(
          "p",
          `${entry.food.name} • ${entry.quantity} ${entry.food.servingUnit} • ${Math.round((entry.food.calories * entry.quantity) / entry.food.servingAmount)} kcal${entry.substitutions ? ` • Substituições: ${entry.substitutions}` : ""}`,
          parent,
        );
      for (const [index, option] of (meal.options || []).slice(0, 2).entries()) {
        node("h4", `${meal.name} ${String.fromCharCode(66 + index)}`, parent);
        for (const entry of option.items)
          node(
            "p",
            `${entry.food.name} • ${entry.quantity} ${entry.food.servingUnit} • ${Math.round((entry.food.calories * entry.quantity) / entry.food.servingAmount)} kcal`,
            parent,
          );
      }
    }
    if (item.data.meals.some((meal: any) => (meal.options?.length ?? 0) > 2)) node("p", "Este plano possui opções antigas excedentes. Abra o editor para revisar antes de salvar novamente.", parent);
    node("p", item.data.notes, parent);
  } else if (item.kind === "goal")
    node(
      "p",
      `${item.data.weeklyTarget} treinos/semana • ${item.data.weekdays.length ? "dias " + item.data.weekdays.join(", ") : "flexível"} • ${item.data.notes}`,
      parent,
    );
  else {
    if (item.data.objective) node("p", item.data.objective, parent);
    if (item.data.actions)
      for (const action of item.data.actions) node("p", action, parent);
    if (item.data.notes) node("p", item.data.notes, parent);
  }
}
export async function library(
  kind: string,
  access: { role: string; capabilities: string[] },
) {
  content(
    '<section class="library-page"><div class="card library-hero"><div><p class="section-kicker">Biblioteca</p><h2 id="library-title"></h2><p class="muted" id="library-description"></p></div><button id="create-content" type="button"><span aria-hidden="true">+</span> Novo cadastro</button></div><div class="summary-grid library-metrics"><article class="metric-card"><span class="metric-icon fitness">▦</span><div><small>Total</small><strong id="metric-total">—</strong></div></article><article class="metric-card"><span class="metric-icon nutrition">◉</span><div><small>Ativos</small><strong id="metric-active">—</strong></div></article><article class="metric-card"><span class="metric-icon health">∿</span><div><small>Catálogo global</small><strong id="metric-global">—</strong></div></article></div><section class="card"><div class="filter-bar"><label class="search-field"><span aria-hidden="true">⌕</span><input id="library-search" type="search" placeholder="Buscar por nome ou detalhe…" aria-label="Buscar na biblioteca"></label><label class="filter-field"><span>Visibilidade</span><select id="library-scope"><option value="all">Todas</option><option value="global">Catálogo global</option><option value="private">Minha biblioteca</option></select></label><label class="filter-field"><span>Status</span><select id="library-status"><option value="active">Ativos</option><option value="all">Todos</option><option value="archived">Arquivados</option></select></label><label class="filter-field" id="category-filter-wrap" hidden><span>Categoria</span><select id="library-category"></select></label></div><div class="result-heading"><p id="library-result-count" class="muted">Carregando…</p><p class="library-hint">Conteúdos globais são compartilhados; versões anteriores são preservadas.</p></div><div id="library-items" class="content-grid" aria-live="polite"></div><div id="library-pagination" class="pagination" aria-label="Paginação"></div></section></section>',
  );
  document.querySelector("#library-title")!.textContent = titles[kind];
  document.querySelector("#library-description")!.textContent =
    descriptions[kind] || "Gerencie o conteúdo da sua biblioteca.";
  document.querySelector("header h1")!.textContent = titles[kind];
  document.querySelector<HTMLButtonElement>("#create-content")!.onclick =
    () => {
      void editor(kind, access).catch((e) => notice(e.message));
    };
  const rows: any[] = await api(
    `/portal/content?kind=${encodeURIComponent(kind)}`,
  );
  document.querySelector("#metric-total")!.textContent = String(rows.length);
  document.querySelector("#metric-active")!.textContent = String(
    rows.filter((row) => !row.archived).length,
  );
  document.querySelector("#metric-global")!.textContent = String(
    rows.filter((row) => row.scope === "global").length,
  );
  const search = document.querySelector<HTMLInputElement>("#library-search")!;
  const scope = document.querySelector<HTMLSelectElement>("#library-scope")!;
  const status = document.querySelector<HTMLSelectElement>("#library-status")!;
  const category = document.querySelector<HTMLSelectElement>(
    "#library-category",
  )!;
  const categoryWrap = document.querySelector<HTMLElement>(
    "#category-filter-wrap",
  )!;
  const availableCategories = [
    ...new Set(
      rows
        .map((row) => row.data?.category || row.data?.area)
        .filter(Boolean),
    ),
  ] as string[];
  if (availableCategories.length) {
    categoryWrap.hidden = false;
    category.append(new Option("Todas", "all"));
    for (const value of availableCategories.sort())
      category.append(new Option(categoryLabels[value] || value, value));
  }
  let page = 1;
  const pageSize = 9;
  const normalized = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const render = () => {
    const query = normalized(search.value.trim());
    const filtered = rows.filter((row) => {
      const matchesSearch =
        !query || normalized(`${row.name} ${JSON.stringify(row.data)}`).includes(query);
      const matchesScope = scope.value === "all" || row.scope === scope.value;
      const matchesStatus =
        status.value === "all" ||
        (status.value === "archived" ? row.archived : !row.archived);
      const rowCategory = row.data?.category || row.data?.area;
      const matchesCategory =
        !availableCategories.length ||
        category.value === "all" ||
        rowCategory === category.value;
      return matchesSearch && matchesScope && matchesStatus && matchesCategory;
    });
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pageCount);
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    document.querySelector("#library-result-count")!.textContent =
      `${filtered.length} ${filtered.length === 1 ? "resultado" : "resultados"}`;
    const target = document.querySelector("#library-items")!;
    target.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = '<span aria-hidden="true">⌕</span><h3>Nenhum resultado encontrado</h3><p>Ajuste a busca ou os filtros para visualizar outros cadastros.</p>';
      target.append(empty);
    }
    for (const row of visible) {
      const item = document.createElement("article");
      item.className = "content-card";
      target.append(item);
      if (row.kind === "exercise" && row.data?.imageUrl) {
        const image = document.createElement("img");
        image.className = "content-card-image";
        image.src = row.data.imageUrl;
        image.alt = `Imagem do exercício ${row.name}`;
        image.loading = "lazy";
        item.append(image);
      }
      const head = document.createElement("div");
      head.className = "content-card-head";
      item.append(head);
      const textWrap = document.createElement("div");
      head.append(textWrap);
      node("h3", row.name, textWrap);
      const chips = document.createElement("div");
      chips.className = "chips";
      textWrap.append(chips);
      const scopeChip = node(
        "span",
        row.scope === "global" ? "Global" : "Privado",
        chips,
      );
      scopeChip.className = `chip ${row.scope}`;
      const statusChip = node(
        "span",
        row.archived ? "Arquivado" : "Ativo",
        chips,
      );
      statusChip.className = `chip ${row.archived ? "archived" : "active"}`;
      const categoryValue = row.data?.category || row.data?.area;
      if (categoryValue) {
        const categoryChip = node(
          "span",
          categoryLabels[categoryValue] || categoryValue,
          chips,
        );
        categoryChip.className = "chip neutral";
      }
      const revision = node("span", `v${row.revision}`, head);
      revision.className = "revision";
      const detail = document.createElement("details");
      node("summary", "Ver detalhes", detail);
      const detailBody = document.createElement("div");
      detailBody.className = "detail-body";
      summary(detailBody, row);
      detail.append(detailBody);
      item.append(detail);
      const actions = document.createElement("div");
      actions.className = "card-actions";
      item.append(actions);
      if (row.scope === "private" || access.role === "admin") {
        button("Editar", actions, () => editor(kind, access, row)).classList.add(
          "primary-action",
        );
        button(row.archived ? "Restaurar" : "Arquivar", actions, async () => {
          await api(`/portal/content/${row.id}/archive`, "PATCH", {
            archived: !row.archived,
          });
          await library(kind, access);
        });
        const remove = button("Excluir", actions, async () => {
          if (
            !confirm(
              `Excluir definitivamente "${row.name}"? Esta ação não pode ser desfeita.`,
            )
          )
            return;
          await api(`/portal/content/${row.id}`, "DELETE");
          await library(kind, access);
        });
        remove.classList.add("danger-action");
      } else
        button("Criar cópia", actions, () =>
          editor(kind, access, { ...row, id: undefined, scope: "private" }),
        ).classList.add("primary-action");
      button("Histórico", actions, async () => {
        const versions = await api(`/portal/content/${row.id}/versions`);
        let history = item.querySelector<HTMLElement>(".version-history");
        history?.remove();
        history = document.createElement("div");
        history.className = "version-history";
        node("h4", "Histórico de versões", history);
        if (!versions.length)
          node("p", "Nenhuma versão anterior registrada.", history);
        for (const version of versions) {
          const versionDetail = document.createElement("details");
          node("summary", `Versão ${version.revision}`, versionDetail);
          summary(versionDetail, version.snapshot);
          history.append(versionDetail);
        }
        item.append(history);
      });
    }
    const pagination = document.querySelector("#library-pagination")!;
    pagination.replaceChildren();
    const previous = button("← Anterior", pagination, () => {
      page--;
      render();
      document.querySelector(".filter-bar")?.scrollIntoView({ block: "start" });
    });
    previous.disabled = page === 1;
    const indicator = node("span", `Página ${page} de ${pageCount}`, pagination);
    indicator.className = "page-indicator";
    const next = button("Próxima →", pagination, () => {
      page++;
      render();
      document.querySelector(".filter-bar")?.scrollIntoView({ block: "start" });
    });
    next.disabled = page === pageCount;
  };
  for (const control of [search, scope, status, category]) {
    const event = control === search ? "input" : "change";
    control.addEventListener(event, () => {
      page = 1;
      render();
    });
  }
  render();
}
async function editor(
  kind: string,
  access: { role: string; capabilities: string[] },
  existing?: any,
  onSave?: (result: any) => Promise<void>,
) {
  const referenceItems =
    kind === "workout"
      ? await api("/portal/content?kind=exercise")
      : kind === "diet"
        ? await api("/portal/content?kind=food")
        : [];
  const data = existing?.data || {};
  content(
    '<section class="card"><h2 id="editor-title"></h2><form id="content-editor"><div id="base-fields"></div><div id="data-fields"></div><div class="toolbar"><button type="submit">Salvar</button><button type="button" id="cancel-editor" class="quiet">Voltar</button></div></form></section>',
  );
  document.querySelector("#editor-title")!.textContent =
    `${existing?.id ? "Editar" : "Criar"} • ${titles[kind]}`;
  const base = document.querySelector("#base-fields")!,
    fields = document.querySelector("#data-fields")!;
  input(base, "Nome", "name", existing?.name || "").maxLength =
    kind === "workout" ? 80 : 120;
  if (access.role === "admin")
    select(
      base,
      "Visibilidade",
      "scope",
      [
        ["private", "Biblioteca privada"],
        ["global", "Catálogo global"],
      ],
      existing?.scope || "global",
    );
  let imageChange: string | null | undefined;
  let extract: () => any = () => ({});
  if (kind === "food") {
    foodFields(fields, data);
    extract = () => ({ ...readFood(fields), notes: "" });
  }
  if (["category", "exercise"].includes(kind)) {
    if (kind === "category")
      select(
        fields,
        "Área",
        "area",
        [
          ["fitness", "Fitness"],
          ["nutrition", "Alimentação"],
          ["mental", "Mente"],
          ["general", "Geral"],
        ],
        data.area,
      );
    if (kind === "exercise") {
      select(
        fields,
        "Tipo de exercício",
        "exerciseCategory",
        [
          ["strength", "Força"],
          ["cardio", "Cardio"],
          ["mobility", "Mobilidade"],
          ["flexibility", "Flexibilidade"],
          ["functional", "Funcional"],
        ],
        data.category,
      );
      input(
        fields,
        "Músculo principal",
        "primaryMuscle",
        data.primaryMuscle || "",
        "text",
        false,
      );
      const imageEditor = document.createElement("section");
      imageEditor.className = "exercise-image-editor";
      fields.append(imageEditor);
      const copy = document.createElement("div");
      copy.className = "image-editor-copy";
      imageEditor.append(copy);
      node("h3", "Imagem do exercício", copy);
      node(
        "p",
        "Uma imagem instrucional em JPEG, PNG ou WebP, com até 8 MB. O portal otimiza o arquivo automaticamente.",
        copy,
      );
      const preview = document.createElement("div");
      preview.className = "exercise-image-preview";
      imageEditor.append(preview);
      const previewImage = document.createElement("img");
      previewImage.alt = `Prévia de ${existing?.name || "exercício"}`;
      const placeholder = document.createElement("div");
      placeholder.className = "image-placeholder";
      placeholder.innerHTML = '<span aria-hidden="true">◇</span><strong>Sem imagem</strong>';
      preview.append(previewImage, placeholder);
      const updatePreview = (src: string | null) => {
        previewImage.hidden = !src;
        placeholder.hidden = Boolean(src);
        if (src) previewImage.src = src;
        else previewImage.removeAttribute("src");
      };
      updatePreview(data.imageUrl || null);
      const file = document.createElement("input");
      file.type = "file";
      file.accept = "image/jpeg,image/png,image/webp";
      file.hidden = true;
      imageEditor.append(file);
      const actions = document.createElement("div");
      actions.className = "image-editor-actions";
      imageEditor.append(actions);
      button(data.imageUrl ? "Trocar imagem" : "Escolher imagem", actions, () =>
        file.click(),
      ).classList.add("primary-action");
      const remove = button("Remover", actions, () => {
        imageChange = null;
        file.value = "";
        updatePreview(null);
        remove.hidden = true;
      });
      remove.hidden = !data.imageUrl;
      file.onchange = () => {
        const selected = file.files?.[0];
        if (!selected) return;
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(selected.type) ||
          selected.size > 8 * 1024 * 1024
        ) {
          file.value = "";
          notice("Escolha uma imagem JPEG, PNG ou WebP de até 8 MB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          imageChange = String(reader.result);
          updatePreview(imageChange);
          remove.hidden = false;
          notice("");
        };
        reader.onerror = () => notice("Não foi possível ler a imagem escolhida.");
        reader.readAsDataURL(selected);
      };
    }
    text(fields, "Observações", "notes", data.notes || "");
    extract = () =>
      kind === "category"
        ? { area: read(fields, "area"), notes: read(fields, "notes") }
        : {
            category: read(fields, "exerciseCategory"),
            equipment: data.equipment || "",
            primaryMuscle: read(fields, "primaryMuscle"),
            notes: read(fields, "notes"),
          };
  }
  if (kind === "goal") {
    const target = input(
      fields,
      "Treinos por semana",
      "weeklyTarget",
      data.weeklyTarget || 3,
      "number",
    );
    target.min = "1";
    target.max = "7";
    target.step = "1";
    const days = document.createElement("fieldset");
    node("legend", "Dias planejados (nenhum = meta flexível)", days);
    fields.append(days);
    for (const [day, label] of [
      "Seg",
      "Ter",
      "Qua",
      "Qui",
      "Sex",
      "Sáb",
      "Dom",
    ].entries()) {
      const wrap = document.createElement("label");
      wrap.className = "check";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.value = String(day + 1);
      check.checked = (data.weekdays || []).includes(day + 1);
      wrap.append(check, document.createTextNode(label));
      days.append(wrap);
    }
    text(fields, "Observações", "notes", data.notes || "");
    extract = () => ({
      weeklyTarget: num(fields, "weeklyTarget"),
      weekdays: selected(days).map(Number),
      notes: read(fields, "notes"),
    });
  }
  if (kind === "guidance") {
    text(fields, "Objetivo", "objective", data.objective || "");
    const actions = text(
      fields,
      "Ações combinadas (uma por linha)",
      "actions",
      (data.actions || []).join("\n"),
    );
    text(fields, "Orientações", "notes", data.notes || "");
    extract = () => ({
      objective: read(fields, "objective"),
      actions: actions.value
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
      notes: read(fields, "notes"),
    });
  }
  if (kind === "workout") {
    const validity = input(
      fields,
      "Validade em dias (vazio = sem prazo)",
      "validityDays",
      data.validityDays ?? 30,
      "number",
      false,
    );
    validity.min = "1";
    validity.max = "365";
    validity.step = "1";
    const divisions = document.createElement("div");
    fields.append(divisions);
    const exercises: any[] = referenceItems;
    const addDivision = (division: any = {}) => {
      if (divisions.children.length >= 5) {
        notice("Máximo de 5 divisões.");
        return;
      }
      const section = document.createElement("fieldset");
      section.className = "division-editor";
      divisions.append(section);
      input(section, "Nome da divisão", "divisionName", division.name || "");
      const rows = document.createElement("div");
      rows.className = "exercise-list";
      section.append(rows);
      const addExercise = (ex: any = {}) => {
        if (rows.children.length >= 50) return;
        const row = document.createElement("fieldset");
        rows.append(row);
        const catalog = select(row, "Usar exercício da biblioteca", "catalog", [
          ["", "Personalizado"],
          ...exercises
            .filter((ex) => !ex.archived)
            .map((ex) => [ex.id, ex.name] as [string, string]),
        ]);
        const name = input(row, "Exercício", "exerciseName", ex.name || "");
        catalog.value =
          ex.catalogExerciseId ||
          exercises.find((item) => item.name === ex.name)?.id ||
          "";
        catalog.onchange = () => {
          name.value =
            exercises.find((ex) => ex.id === catalog.value)?.name || "";
        };
        const sets = input(row, "Séries", "sets", ex.sets ?? 3, "number");
        sets.min = "1";
        sets.max = "20";
        sets.step = "1";
        input(row, "Repetições", "reps", ex.reps || "12");
        const load = input(
          row,
          "Carga (kg)",
          "load",
          ex.load ?? "",
          "number",
          false,
        );
        load.max = "2000";
        const rest = input(
          row,
          "Descanso (segundos)",
          "restSeconds",
          ex.restSeconds ?? 60,
          "number",
          false,
        );
        rest.max = "3600";
        rest.step = "1";
        const notes = text(row, "Observações", "notes", ex.notes || "");
        notes.maxLength = 500;
        button("Remover exercício", row, () => row.remove());
      };
      button("Adicionar exercício", section, () => addExercise());
      button("Remover divisão", section, () => section.remove());
      for (const ex of division.exercises || [{}]) addExercise(ex);
    };
    button("Adicionar divisão", fields, () => addDivision());
    for (const division of data.divisions || [{}]) addDivision(division);
    extract = () => ({
      validityDays: validity.value ? Number(validity.value) : null,
      divisions: [...divisions.children].map((section) => ({
        name: read(section, "divisionName"),
        exercises: [...section.querySelector(".exercise-list")!.children].map(
          (row) => ({
            name: read(row, "exerciseName"),
            catalogExerciseId: read(row, "catalog") || null,
            sets: num(row, "sets"),
            reps: read(row, "reps"),
            load: read(row, "load") ? num(row, "load") : null,
            restSeconds: read(row, "restSeconds")
              ? num(row, "restSeconds")
              : null,
            notes: read(row, "notes"),
          }),
        ),
      })),
    });
  }
  if (kind === "diet") {
    text(fields, "Objetivo", "objective", data.objective || "");
    const validity = input(
      fields,
      "Validade em dias (vazio = sem prazo)",
      "validityDays",
      data.validityDays ?? 30,
      "number",
      false,
    );
    validity.min = "1";
    validity.max = "365";
    const meals = document.createElement("div");
    fields.append(meals);
    const foods: any[] = referenceItems;
    const addMeal = (meal: any = {}) => {
      if (meals.children.length >= 12) return;
      const section = document.createElement("fieldset");
      meals.append(section);
      const mealName = input(section, "Refeição", "mealName", meal.name || "");
      input(
        section,
        "Horário opcional",
        "time",
        meal.time || "",
        "time",
        false,
      );
      const mainOptionLabel = node("h4", "", section);
      node("p", "Até 3 opções por refeição: A, B e C. Apenas A é obrigatória.", section);
      const rows = document.createElement("div");
      rows.className = "meal-items";
      section.append(rows);
      const options = document.createElement("div");
      options.className = "meal-options";
      section.append(options);
      const addItem = (entry: any = {}, target = rows) => {
        if (target.children.length >= 30) return;
        const row = document.createElement("fieldset");
        target.append(row);
        const picker = select(row, "Alimento da biblioteca", "foodId", [
          ["", "Preencher alimento"],
          ...foods
            .filter((f) => !f.archived)
            .map((f) => [f.id, f.name] as [string, string]),
        ]);
        const detail = document.createElement("div");
        row.append(detail);
        foodFields(detail, entry.food || {});
        picker.onchange = () => {
          const food = foods.find((f) => f.id === picker.value);
          if (food) {
            detail.replaceChildren();
            foodFields(detail, food.data);
          }
        };
        const quantity = input(
          row,
          "Quantidade planejada (na unidade do alimento)",
          "quantity",
          entry.quantity ?? 100,
          "number",
        );
        quantity.min = "0.001";
        text(
          row,
          "Substituições e porções equivalentes",
          "substitutions",
          entry.substitutions || "",
        ).maxLength = 1000;
        button("Remover alimento", row, () => row.remove());
      };
      button("Adicionar alimento", section, () => addItem());
      button("Remover refeição", section, () => section.remove());
      for (const entry of meal.items || [{}]) addItem(entry);
      const updateOptionLabels = () => {
        const name = mealName.value.trim() || "Refeição";
        mainOptionLabel.textContent = `${name} A`;
        [...options.children].forEach((alternative, index) => {
          alternative.querySelector("legend")!.textContent = `${name} ${String.fromCharCode(66 + index)}`;
        });
        addOptionButton.disabled = options.children.length >= 2;
        addOptionButton.textContent = options.children.length >= 2 ? "Limite de 3 opções atingido" : "Adicionar opção";
      };
      mealName.addEventListener("input", updateOptionLabels);
      const addOption = (option: any = {}, existing = false) => {
        if (!existing && options.children.length >= 2) {
          notice("Máximo de 3 opções por refeição, incluindo A.");
          return;
        }
        const alternative = document.createElement("fieldset");
        options.append(alternative);
        node("legend", "", alternative);
        const optionRows = document.createElement("div");
        optionRows.className = "option-items";
        alternative.append(optionRows);
        button("Adicionar alimento à opção", alternative, () =>
          addItem({}, optionRows),
        );
        button("Remover opção", alternative, () => { alternative.remove(); updateOptionLabels(); });
        for (const entry of option.items || [{}]) addItem(entry, optionRows);
        updateOptionLabels();
      };
      const addOptionButton = button("Adicionar opção", section, () => addOption());
      // This synchronous action owns its disabled state; the generic async task wrapper resets it.
      addOptionButton.onclick = () => addOption();
      for (const option of meal.options || []) addOption(option, true);
      if ((meal.options?.length ?? 0) > 2) node("p", "Este plano antigo excede 3 opções. Revise e remova as opções excedentes antes de salvar; nenhum alimento foi descartado automaticamente.", section);
      updateOptionLabels();
    };
    button("Adicionar refeição", fields, () => addMeal());
    for (const meal of data.meals || [{}]) addMeal(meal);
    text(fields, "Orientações gerais", "notes", data.notes || "");
    extract = () => ({
      objective: read(fields, "objective"),
      validityDays: validity.value ? Number(validity.value) : null,
      notes: read(fields, "notes"),
      meals: [...meals.children].map((section) => ({
        name: read(section, "mealName"),
        time: read(section, "time") || null,
        items: [...section.querySelector(".meal-items")!.children].map(
          (row) => ({
            food: readFood(row.querySelector("div")!),
            quantity: num(row, "quantity"),
            substitutions: read(row, "substitutions"),
          }),
        ),
        options: [...section.querySelector(".meal-options")!.children].map(
          (option, index) => ({
            name: `${read(section, "mealName")} ${String.fromCharCode(66 + index)}`,
            items: [...option.querySelector(".option-items")!.children].map(
              (row) => ({
                food: readFood(row.querySelector("div")!),
                quantity: num(row, "quantity"),
                substitutions: read(row, "substitutions"),
              }),
            ),
          }),
        ),
      })),
    });
  }
  document.querySelector<HTMLButtonElement>("#cancel-editor")!.onclick = () => {
    void library(kind, access);
  };
  let persisted = existing;
  submit("#content-editor", async (form) => {
    const payload = {
      kind,
      name: value(form, "name"),
      scope: access.role === "admin" ? value(form, "scope") : "private",
      data: extract(),
    };
    const result = await api(
      persisted?.id ? `/portal/content/${persisted.id}` : "/portal/content",
      persisted?.id ? "PUT" : "POST",
      persisted?.id
        ? { revision: persisted.revision, content: payload }
        : payload,
    );
    persisted = { ...persisted, id: result.id || persisted?.id, revision: result.revision };
    if (kind === "exercise" && imageChange !== undefined)
      await api(`/portal/content/${persisted.id}/image`, "PUT", {
        imageDataUrl: imageChange,
      });
    if (onSave) {
      await onSave(result);
      return;
    }
    await library(kind, access);
    notice("Conteúdo salvo. Planos anteriores foram preservados.");
  });
}
export async function student(relationship: any) {
  content(
    '<section class="card"><h2 id="student-name"></h2><p class="muted">O acesso considera as permissões atuais do perfil e o consentimento deste aluno.</p><div id="student-actions" class="toolbar"></div><div id="student-panel"></div></section>',
  );
  document.querySelector("#student-name")!.textContent =
    relationship.studentName;
  const actions = document.querySelector("#student-actions")!,
    panel = document.querySelector("#student-panel")!;
  button("Atribuir plano", actions, async () => {
    panel.replaceChildren();
    const form = document.createElement("form");
    form.id = "assign";
    panel.append(form);
    const allowedKinds = [
      ["workout", "Ficha", "fitness"],
      ["goal", "Meta", "fitness"],
      ["diet", "Dieta", "nutrition"],
      ["guidance", "Orientações", "mental"],
    ].filter(([, , area]) =>
      relationship.capabilities.some(
        (cap: string) => cap === `${area}.manage` || cap === `${area}.suggest`,
      ),
    );
    const kind = select(
      form,
      "Tipo de plano",
      "kind",
      allowedKinds.map(([key, label]) => [key, label]),
    );
    const model = select(form, "Modelo", "model", []);
    const mode = select(form, "Operação", "mode", []);
    const replace = select(form, "Substituir plano anterior", "replace", [
      ["", "Novo plano"],
    ]);
    const refresh = async () => {
      const area =
        kind.value === "diet"
          ? "nutrition"
          : kind.value === "guidance"
            ? "mental"
            : "fitness";
      mode.replaceChildren();
      for (const action of ["suggest", "manage"])
        if (relationship.capabilities.includes(`${area}.${action}`)) {
          const opt = document.createElement("option");
          opt.value = action;
          opt.textContent =
            action === "suggest"
              ? "Enviar para aceite"
              : "Aplicar diretamente (autorizado)";
          mode.append(opt);
        }
      model.replaceChildren();
      for (const row of (
        await api(`/portal/content?kind=${kind.value}`)
      ).filter((r: any) => !r.archived)) {
        const opt = document.createElement("option");
        opt.value = row.id;
        opt.textContent = `${row.name} • v${row.revision}`;
        model.append(opt);
      }
      replace.replaceChildren();
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Novo plano";
      replace.append(opt);
      for (const row of await api(
        `/portal/relationships/${relationship.id}/assignments`,
      ))
        if (row.kind === kind.value && row.status === "active") {
          const option = document.createElement("option");
          option.value = row.id;
          option.textContent = row.snapshot.name;
          replace.append(option);
        }
    };
    kind.onchange = () => {
      void refresh().catch((e) => notice(e.message));
    };
    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = "Enviar plano";
    form.append(save);
    await refresh();
    const requestId = crypto.randomUUID();
    submit("#assign", async () => {
      await api("/portal/assignments", "POST", {
        contentId: model.value,
        relationshipId: relationship.id,
        mode: mode.value,
        ...(replace.value ? { replaceId: replace.value } : {}),
        requestId,
      });
      notice("Plano enviado.");
      panel.replaceChildren();
    });
  });
  button("Planos e histórico", actions, async () => {
    panel.replaceChildren();
    const rows = await api(
      `/portal/relationships/${relationship.id}/assignments`,
    );
    if (!rows.length)
      node("p", "Nenhum plano disponível para este vínculo.", panel);
    for (const row of rows) {
      const section = document.createElement("article");
      section.className = "item";
      panel.append(section);
      node("h3", row.snapshot.name, section);
      node(
        "p",
        `${row.status} • versão de origem ${row.sourceRevision} • ${new Date(row.createdAt).toLocaleDateString("pt-BR")}`,
        section,
      );
      summary(section, row.snapshot);
      const area =
        row.kind === "diet"
          ? "nutrition"
          : row.kind === "guidance"
            ? "mental"
            : "fitness";
      if (
        row.status === "active" &&
        ["manage", "suggest"].some((action) =>
          relationship.capabilities.includes(area + "." + action),
        )
      )
        button("Ajustar plano", section, () =>
          editor(
            row.kind,
            { role: "professional", capabilities: relationship.capabilities },
            { ...row.snapshot, scope: "private" },
            async (result) => {
              await api("/portal/assignments", "POST", {
                contentId: result.id,
                relationshipId: relationship.id,
                mode: relationship.capabilities.includes(area + ".manage")
                  ? "manage"
                  : "suggest",
                replaceId: row.id,
                requestId: crypto.randomUUID(),
              });
              await student(relationship);
              notice(
                "Ajuste enviado. O plano anterior foi preservado no histórico.",
              );
            },
          ),
        );
    }
  });
  for (const area of ["fitness", "nutrition", "body", "mental"])
    if (relationship.capabilities.includes(`${area}.view`))
      button(
        (
          {
            fitness: "Treinos e metas",
            nutrition: "Diário alimentar",
            body: "Medidas corporais",
            mental: "Check-ins de mente",
          } as Record<string, string>
        )[area],
        actions,
        async () => {
          panel.replaceChildren();
          const form = document.createElement("form");
          form.id = "progress";
          panel.append(form);
          const today = new Date().toLocaleDateString("en-CA");
          input(form, "De", "from", today, "date");
          input(form, "Até", "to", today, "date");
          const save = document.createElement("button");
          save.type = "submit";
          save.textContent = "Consultar progresso";
          form.append(save);
          const output = document.createElement("div");
          panel.append(output);
          submit("#progress", async () => {
            const result = await api(
              `/portal/relationships/${relationship.id}/progress?${new URLSearchParams({ area, from: read(form, "from"), to: read(form, "to") })}`,
            );
            output.replaceChildren();
            if (area === "fitness") {
              node(
                "h3",
                `Meta semanal: ${result.goal.weeklyTarget ?? "Não configurada"}`,
                output,
              );
              for (const session of result.sessions)
                node(
                  "p",
                  `${session.performedOn} • ${session.planName} / ${session.divisionName} • ${session.status}`,
                  output,
                );
              for (const plan of result.plans) {
                node("h4", plan.name, output);
                if (
                  plan.status === "available" &&
                  relationship.capabilities.includes("fitness.manage")
                )
                  button("Ajustar esta ficha", output, () =>
                    editor(
                      "workout",
                      {
                        role: "professional",
                        capabilities: relationship.capabilities,
                      },
                      {
                        name: plan.name,
                        scope: "private",
                        data: {
                          validityDays: 30,
                          divisions: plan.divisions.map((division: any) => ({
                            name: division.name,
                            exercises: division.exercises.map((ex: any) => ({
                              name: ex.name,
                              sets: ex.sets,
                              reps: ex.reps,
                              load: ex.load ?? null,
                              restSeconds: ex.restSeconds ?? null,
                              notes: ex.notes || "",
                            })),
                          })),
                        },
                      },
                      async (saved) => {
                        await api("/portal/assignments", "POST", {
                          contentId: saved.id,
                          relationshipId: relationship.id,
                          mode: "manage",
                          replaceWorkoutPlanId: plan.id,
                          requestId: crypto.randomUUID(),
                        });
                        await student(relationship);
                        notice(
                          "Ficha ajustada. A versão anterior foi arquivada e o histórico preservado.",
                        );
                      },
                    ),
                  );
                for (const division of plan.divisions)
                  node("p", `${division.label}: ${division.name}`, output);
              }
              if (!result.sessions.length)
                node("p", "Nenhuma sessão registrada no período.", output);
            } else if (area === "body") {
              for (const row of result.measurements)
                node(
                  "p",
                  `${row.date} • Peso: ${row.weightKg ?? "—"} kg • Cintura: ${row.waistCm ?? "—"} cm • ${row.notes || ""}`,
                  output,
                );
              if (!result.measurements.length)
                node("p", "Nenhuma medida registrada no período.", output);
            } else if (area === "mental") {
              for (const row of result.checkIns)
                node(
                  "p",
                  `${row.date} • Humor: ${row.mood} • ${row.note || ""}`,
                  output,
                );
              if (!result.checkIns.length)
                node("p", "Nenhum check-in registrado no período.", output);
            } else {
              node(
                "p",
                `Registros de ${result.date}. Ausência de registro não indica descumprimento da dieta.`,
                output,
              );
              for (const row of result.meals)
                node(
                  "p",
                  `${row.time} • ${row.name} • ${row.calories} kcal • P ${row.protein} / C ${row.carbs} / G ${row.fat} g`,
                  output,
                );
            }
          });
        },
      );
}
export async function groups() {
  content(
    '<div class="grid"><section class="card"><h2>Novo grupo</h2><form id="group-form"><label>Nome<input name="name" minlength="2" maxlength="80" required></label><label>Descrição<textarea name="description" maxlength="500"></textarea></label><button type="submit">Criar grupo</button></form></section><section class="card"><h2>Grupos</h2><p class="muted">A gestão administrativa não concede acesso ao feed privado dos membros.</p><div id="groups">Carregando…</div></section></div>',
  );
  submit("#group-form", async (form) => {
    await api("/portal/groups", "POST", {
      name: value(form, "name"),
      description: value(form, "description"),
    });
    await groups();
    notice("Grupo criado.");
  });
  const rows = await api("/portal/groups");
  const target = document.querySelector("#groups")!;
  target.replaceChildren();
  if (!rows.length) target.textContent = "Nenhum grupo.";
  for (const row of rows) {
    const section = document.createElement("article");
    section.className = "item";
    target.append(section);
    button("Membros e convites", section, () => groupMembers(row));
    const name = input(section, "Nome", "name", row.name);
    const description = text(
      section,
      "Descrição",
      "description",
      row.description || "",
    );
    const active = Boolean(row.active ?? true);
    node(
      "p",
      `${active ? "Ativo" : "Desativado"} • ${row.members ?? row.memberCount ?? "—"} membros`,
      section,
    );
    button("Salvar", section, async () => {
      await api(`/portal/groups/${row.id}`, "PATCH", {
        name: name.value,
        description: description.value,
        active,
      });
      notice("Grupo atualizado.");
    });
    button(active ? "Desativar" : "Reativar", section, async () => {
      if (!confirm("Confirmar alteração do grupo?")) return;
      await api(`/portal/groups/${row.id}`, "PATCH", {
        name: name.value,
        description: description.value,
        active: !active,
      });
      await groups();
    });
  }
}
async function groupMembers(group: any) {
  content(
    '<section class="card"><h2 id="group-members-title"></h2><form id="group-invite"><label>Nome de usuário (sem @)<input name="username" minlength="3" maxlength="30" required></label><button type="submit">Convidar para o grupo</button></form><div id="group-members">Carregando…</div></section>',
  );
  document.querySelector("#group-members-title")!.textContent =
    `Membros • ${group.name}`;
  submit("#group-invite", async (form) => {
    await api(`/portal/groups/${group.id}/invites`, "POST", {
      username: value(form, "username").replace(/^@/, ""),
    });
    form.reset();
    notice("Convite enviado. O usuário precisa aceitar no aplicativo.");
  });
  const rows = await api(`/portal/groups/${group.id}/members`),
    target = document.querySelector("#group-members")!;
  target.replaceChildren();
  for (const row of rows) {
    const section = document.createElement("article");
    section.className = "item";
    target.append(section);
    node("h3", row.displayName, section);
    node("p", `@${row.username || "—"} • ${row.role}`, section);
    if (row.role !== "owner") {
      const role = select(
        section,
        "Papel no grupo",
        "role",
        [
          ["member", "Membro"],
          ["moderator", "Moderador"],
          ["admin", "Administrador do grupo"],
        ],
        row.role,
      );
      button("Salvar papel", section, async () => {
        await api(`/portal/groups/${group.id}/members`, "PATCH", {
          userId: row.id,
          action: "role",
          role: role.value,
        });
        notice("Papel atualizado.");
      });
      button("Remover membro", section, async () => {
        if (!confirm("Remover este membro do grupo?")) return;
        await api(`/portal/groups/${group.id}/members`, "PATCH", {
          userId: row.id,
          action: "remove",
        });
        await groupMembers(group);
      });
    }
  }
}
