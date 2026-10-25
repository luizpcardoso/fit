# Checklist de funcionalidade

## Produto e tela

- [ ] Objetivo do usuário e fluxo definidos.
- [ ] Permissões e visibilidade dos dados definidas.
- [ ] Estados de carregamento, vazio, erro e sucesso tratados quando aplicáveis.
- [ ] Perguntas de produto ou segurança pendentes foram resolvidas.

## Contrato e API

- [ ] Contrato mínimo de entrada e saída criado ou atualizado.
- [ ] Endpoint correspondente implementado.
- [ ] Autenticação e autorização por recurso verificadas.
- [ ] Entradas, limites e respostas validados.
- [ ] Erros não revelam informações internas.

## Integração

- [ ] Tela integrada à API sem mocks no fluxo final.
- [ ] Tokens e dados sensíveis tratados com armazenamento e logs seguros.
- [ ] Falhas de rede, autenticação e autorização têm comportamento definido.

## Verificação

- [ ] Teste do caminho principal.
- [ ] Teste de entrada inválida.
- [ ] Teste sem autenticação, quando aplicável.
- [ ] Teste de tentativa de acesso ao recurso de outro usuário, quando aplicável.
- [ ] Typecheck e lint aprovados.
- [ ] Documentação atualizada.
