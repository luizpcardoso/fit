# Instruções do aplicativo

Estas regras complementam o `AGENTS.md` da raiz.

## Orientação por tela

- Começar cada funcionalidade pelo objetivo, fluxo e estados da tela.
- Tratar carregamento, conteúdo vazio, falha, falta de conexão e sucesso quando aplicáveis.
- Não considerar dados simulados como implementação concluída.
- Ao criar uma funcionalidade de produto, definir o contrato necessário, implementar o endpoint em `apps/api` e integrar o fluxo na mesma entrega.
- Mudanças exclusivamente visuais, textos e navegação estática não justificam endpoints artificiais.

## Segurança no cliente

- Considerar o aplicativo um cliente não confiável; nunca depender apenas de bloqueios visuais para autorização.
- Não incluir segredos, chaves administrativas ou credenciais privadas no código, assets ou variáveis públicas do Expo.
- Armazenar tokens e credenciais apenas em mecanismo seguro do sistema operacional.
- Não exibir nem registrar detalhes internos retornados pela API.
- Não persistir dados pessoais ou sensíveis sem necessidade explícita.
- Limpar dados privados ao encerrar a sessão.
- Validar entradas para boa experiência, mantendo a validação definitiva na API.

## Integração

- Consumir a API pelo cliente tipado de `packages/api-client` quando ele existir.
- Compartilhar apenas contratos públicos por `packages/contracts`.
- Não importar código da API, modelos do banco ou detalhes de persistência.
- Representar falhas de autenticação, autorização, validação, rede e servidor de forma distinta quando isso ajudar o usuário.

