# Arquitetura

## Organização inicial

O projeto é um monorepo com aplicativo e API implantáveis separadamente.

## Fluxo de uma funcionalidade

```text
necessidade do usuário
  -> fluxo e tela do app
  -> estados da interface
  -> contrato de dados
  -> endpoint da API
  -> integração e testes
```

O aplicativo não importa modelos do banco. Contratos compartilhados representam apenas a fronteira pública da API.

