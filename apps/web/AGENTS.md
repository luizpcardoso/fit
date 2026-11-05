# Web — complemento da raiz

Portal profissional e home pública em TypeScript, compilados com `tsc` e servidos pela API (`/portal`).

- Comece por `docs/portal-workspace-context.md`; consulte `docs/portal.md` para permissões e fluxos. Métricas: `docs/observability-context.md`.
- Entrada admin: Métricas do app; profissional: Meus alunos. UI não amplia capacidades, vínculo ou consentimento.
- Tokens apenas em memória; recarregar exige login. Use tema gerado `theme.css`, tokens `--fit-*`/`--brand-*`; identidade em `design/palette.json`.
- Novo JS deve entrar na lista de assets de `apps/api/src/portal.ts`.
- `npm run test:e2e --workspace=@fit/web`: transpila fontes em memória com fixtures isoladas; não gera `dist`, APK ou OTA. Verifique também 390px/overflow e recuperação de erro.
- `npm run build --workspace=@fit/web`: gera `dist` ignorado; necessário antes de servir/publicar os fontes atualizados. Primeiro admin: `npm run portal:admin --workspace=@fit/api -- email@existente`.
