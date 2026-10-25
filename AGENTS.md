# Fit — instruções do projeto

## Direção do produto

Fit é um aplicativo de treinos, exercícios, metas, acompanhamento de progresso e interação entre usuários.

## Regra principal de desenvolvimento

Toda nova funcionalidade deve começar pela experiência no aplicativo:

1. Definir o objetivo do usuário e o fluxo da tela.
2. Implementar ou ajustar a interface do aplicativo.
3. Definir o contrato de dados exigido pela tela.
4. Implementar o endpoint correspondente na API.
5. Integrar aplicativo e API.
6. Validar o fluxo completo com testes.

Não criar endpoints especulativos que ainda não sejam necessários para uma experiência do aplicativo.

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

