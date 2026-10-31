# Autenticação

## Fluxo do aplicativo

Ao abrir o app, o cliente tenta restaurar a sessão pelo armazenamento seguro do sistema. Uma sessão válida abre a tela inicial; sem sessão, o app exibe o login e permite acessar o cadastro.

O cadastro solicita nome, sobrenome, telefone, e-mail e senha. E-mails são normalizados para minúsculas e são únicos. Nome, sobrenome, telefone e e-mail são privados e retornados apenas ao próprio usuário autenticado.

## Sessão e segurança

- Senhas têm entre 8 e 72 caracteres e são armazenadas somente como hash bcrypt.
- Access tokens JWT expiram em 15 minutos.
- Refresh tokens aleatórios expiram em 30 dias, são armazenados como hash e rotacionados em cada uso.
- O app armazena tokens no SecureStore no Android/iOS e nunca armazena a senha.
- Login e cadastro possuem rate limiting. O login usa uma mensagem genérica para não confirmar a existência de contas.
- Logout revoga o refresh token e remove os tokens locais.
- Não há verificação de e-mail nem recuperação de senha nesta primeira versão.

## Endpoints

| Método | Rota | Autenticação | Finalidade |
|---|---|---|---|
| `POST` | `/auth/register` | Pública | Cria conta e inicia sessão |
| `POST` | `/auth/login` | Pública | Autentica com e-mail e senha |
| `POST` | `/auth/refresh` | Refresh token | Rotaciona e renova a sessão |
| `GET` | `/auth/me` | Bearer token | Retorna o perfil privado da sessão |
| `POST` | `/auth/logout` | Refresh token | Revoga a sessão atual |

A documentação OpenAPI interativa fica em `http://localhost:3333/docs` com a API em execução.

## Execução local no celular

1. Copie `apps/api/.env.example` para `apps/api/.env`, configure o MySQL e defina um segredo JWT forte.
2. Configure `apps/mobile/.env.local` com `EXPO_PUBLIC_API_URL=http://IP_DO_COMPUTADOR:3333`.
3. Execute `npm run api` e, em outro terminal, `npm run mobile -- --lan`.
4. Abra o projeto no Expo Go usando o QR code.

MySQL é acessado pelo Sequelize. As migrations em `apps/api/src/migrations` são executadas automaticamente antes de a API aceitar conexões e também podem ser aplicadas com `npm run db:migrate --workspace=@fit/api`. Em nuvem, ative `DB_SSL=true` quando exigido pelo provedor.

## Dados do perfil usados em estimativas

O perfil separa **gênero** (identidade, opcional: mulher, homem, não binário ou prefiro não informar) de **base para estimativas** (`estimationSex`: feminino ou masculino, opcional). As fórmulas de gasto calórico usam valores de referência por sexo; por isso a estimativa automática depende somente de `estimationSex`, data de nascimento, altura e peso, nunca do gênero. Quem não informa a base continua podendo registrar o gasto manualmente.

A migration 035 cria `users.estimation_sex` e copia o valor de `gender` apenas quando ele era `female` ou `male`. `PATCH /auth/me` aceita `estimationSex` (`female`, `male` ou `null`) e `GET /auth/me` o devolve. Em `DailyEnergyEstimate.missing`, a ausência aparece como `estimationSex`. O dado é privado: não aparece em grupos nem para profissionais sem consentimento.
