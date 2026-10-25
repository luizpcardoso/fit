# Fit — instruções do projeto

## Direção do produto

Fit é um aplicativo de treinos, exercícios, metas, acompanhamento de progresso e interação entre usuários.

## Regra principal de desenvolvimento

Toda nova tela ou funcionalidade de produto deve começar pela experiência no aplicativo e ser entregue de ponta a ponta:

1. Definir o objetivo do usuário, o fluxo e os estados da tela.
2. Fazer perguntas antes de implementar quando requisitos, permissões, privacidade ou comportamento estiverem ambíguos.
3. Implementar ou ajustar a interface do aplicativo, incluindo carregamento, vazio, erro e sucesso.
4. Definir o contrato de entrada e saída exigido pela tela.
5. Implementar o endpoint correspondente na API com autenticação, autorização e validação.
6. Integrar o aplicativo ao endpoint sem colocar regras de negócio ou segredos no cliente.
7. Validar o fluxo completo com testes do app, da API e dos controles de acesso.

Uma funcionalidade de produto visível no app não está concluída com dados simulados ou somente com a interface: o contrato, o endpoint e a integração também devem ser entregues na mesma mudança. Alterações exclusivamente visuais, textos, navegação estática ou refatorações não exigem a criação de endpoints artificiais.

Não criar endpoints especulativos que ainda não sejam necessários para uma experiência do aplicativo. Não implementar primeiro uma API genérica para depois procurar onde usá-la no app.

## Perguntas obrigatórias

Antes de tomar uma decisão irreversível ou sensível, perguntar ao usuário quando não estiver explícito:

- quem pode visualizar, criar, editar ou excluir o recurso;
- se dados, metas, treinos ou progresso são privados, compartilhados ou públicos;
- qual deve ser o comportamento de exclusão, retenção e recuperação de dados;
- se a ação envolve pagamentos, saúde, localização, fotos, contatos ou outros dados sensíveis;
- se uma integração externa, custo recorrente ou serviço com lock-in será introduzido;
- se houver mais de uma interpretação capaz de alterar o fluxo principal da tela.

Não interromper por detalhes reversíveis que possam ser resolvidos com os padrões já documentados.

## Organização

- `apps/mobile`: aplicativo React Native com Expo.
- `apps/api`: API do produto, adicionada conforme as telas exigirem backend.
- `packages/contracts`: contratos e validações compartilhados.
- `packages/api-client`: cliente tipado da API.
- `docs`: decisões de produto e arquitetura.

## Princípios

- Abrir e trabalhar sempre pela raiz do repositório.
- Manter cada mudança pequena, verificável e orientada a uma entrega do aplicativo.
- Não compartilhar modelos internos do banco com o aplicativo.
- Nunca versionar segredos ou arquivos `.env` reais.
- Atualizar a documentação quando uma decisão estrutural mudar.

## Segurança obrigatória

- Tratar todo dado vindo do aplicativo como não confiável; validar novamente na API.
- Manter a API como autoridade para regras de negócio, permissões e propriedade dos recursos.
- Exigir autenticação nos endpoints privados e autorização por recurso, não apenas por rota.
- Aplicar menor privilégio e negar acesso por padrão.
- Nunca enviar chaves privadas, credenciais administrativas ou segredos para o bundle do aplicativo.
- Não registrar tokens, senhas, dados de saúde ou informações pessoais desnecessárias em logs.
- Usar armazenamento seguro do sistema para credenciais no dispositivo; não usar armazenamento simples para tokens sensíveis.
- Retornar erros seguros ao cliente, sem stack traces, SQL ou detalhes internos.
- Usar consultas parametrizadas/ORM e validar tipos, limites, formatos e tamanho dos payloads.
- Projetar rate limiting e proteção contra abuso para autenticação, compartilhamento e endpoints públicos.
- Não desabilitar TLS, validação de certificado ou controles de segurança para contornar problemas locais.
- Não aplicar correções automáticas destrutivas de dependências sem revisar impacto e executar testes.
- Incluir testes de acesso não autenticado, acesso a recurso de outro usuário e payload inválido em funcionalidades protegidas.

Consultar `docs/security.md` e `docs/feature-checklist.md` antes de considerar uma funcionalidade concluída.

## Critério de conclusão

Uma funcionalidade só pode ser declarada pronta quando:

- a experiência no app está implementada e acessível;
- contrato e endpoint estão implementados;
- app e API estão integrados, sem depender de mocks no fluxo final;
- estados de carregamento, vazio, erro e sucesso foram tratados quando aplicáveis;
- autenticação, autorização, validação e privacidade foram revisadas;
- testes relevantes e verificações de tipo/lint passam;
- documentação e exemplos de ambiente foram atualizados sem incluir segredos.

