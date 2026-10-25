# Instruções da API

Estas regras complementam o `AGENTS.md` da raiz.

## API orientada pelo aplicativo

- Criar endpoints a partir de uma necessidade concreta de tela ou fluxo do aplicativo.
- Antes de implementar, identificar a tela consumidora, os estados necessários e o contrato mínimo.
- Não ampliar o endpoint com campos, filtros ou operações especulativas.
- Manter regras de negócio e decisões de autorização no servidor.

## Segurança da API

- Validar todos os parâmetros, payloads e respostas nos limites da aplicação.
- Autenticar endpoints privados e autorizar cada operação com base no usuário e no recurso.
- Nunca confiar em `userId`, papel ou propriedade de recurso enviados pelo cliente; derivar identidade da sessão autenticada.
- Selecionar apenas os campos que o cliente pode receber e evitar exposição acidental de dados internos.
- Não retornar stack traces, consultas, segredos ou detalhes de infraestrutura.
- Não registrar tokens, senhas ou payloads sensíveis.
- Usar consultas parametrizadas/ORM e transações quando a consistência exigir.
- Aplicar limites de tamanho, paginação e proteção contra abuso onde necessário.
- Criar testes para usuário não autenticado, usuário sem permissão, recurso de outro usuário e entrada inválida.
- Revisar efeitos de concorrência, repetição e idempotência em operações mutáveis.

## Contratos

- Publicar contratos externos em `packages/contracts`, sem expor entidades do banco.
- Manter compatibilidade ou documentar claramente uma alteração incompatível.
- Usar códigos HTTP e respostas de erro consistentes, sem revelar informações sensíveis.

