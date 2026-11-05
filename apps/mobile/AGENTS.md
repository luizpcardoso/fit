# Mobile — complemento da raiz

Expo/React Native + expo-router; rotas em `src/app`, alias `@/*` → `src/*`. Android prioritário; web também é alvo de E2E. Versões em `package.json`.

## Integração e sessão

- `src/app/_layout.tsx`: `Stack.Protected` para autenticação; abas em `(tabs)`, demais fluxos na pilha raiz. Consulte o layout para a navegação atual.
- `useAuth()` de `auth/auth-context.tsx`: usuário, ações e `api` tipada de `@fit/api-client`. Não importe API/modelos de persistência. SecureStore nativo; localStorage somente no build web. Não persista dados sensíveis sem necessidade explícita.
- Distinga erros de rede/autenticação/autorização/validação quando útil. Arquivos `.web.ts` substituem implementações nativas.

## UI e acessibilidade

- `useAppTheme().colors`/`AppPalette`; tokens `Type`, `Radius`, `Scrim` em `constants/theme.ts`. Sem cores fixas nem edição de `palette.generated.ts`. Tema Claro/Escuro/Sistema local ao aparelho, independente da conta.
- Conteúdo sobre primária: `onPrimary`; campos: `fieldBorder`; interruptores: `controlTrackOff`/`controlThumb`. Fonte mínima 12; toque mínimo 44×44.
- Diálogos: `showDialog`/`confirmAction`/`showToast` de `components/app-dialog.tsx`; `Alert.alert` não funciona na web. Confirmações com verbo + objeto.
- Pilha: `ScreenHeader` com volta nomeada + Início; em telas que rolam, `FixedScreenHeader` mantém o cabeçalho fora da rolagem e ações de salvar/iniciar ficam num rodapé fixo; alterações pendentes usam `useUnsavedChanges` (inclui voltar Android). Para voltar à aba, `router.dismissTo('/rota')`; `replace` duplica abas.
- Datas visíveis via `utils/dates.ts`, nunca ISO. Fundo de modal como irmão absoluteFill da folha, evitando botões aninhados.
- Estados com `aria-checked/selected/disabled/busy/expanded`; RN Web ignora `accessibilityState`. Abas refletem foco em `aria-selected`.
- Ícones: `MaterialCommunityIcons` de `@/components/icon`, nunca direto de `@expo/vector-icons`; botão só com ícone exige `accessibilityLabel`.

## Verificação

`npm run test:e2e` usa Playwright/app web: `FIT_E2E_WEB_URL` (padrão `http://127.0.0.1:8087`) e `FIT_E2E_API_URL`. Metro pode manter a URL de `.env.local` em cache; E2E reescrevem chamadas a `:3333`. Para desempenho, leia `docs/mobile-performance.md`; lembretes/registro corporal exigem os docs indicados na raiz.
