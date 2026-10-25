# Instruções de contratos

- Este pacote representa a fronteira pública entre app e API.
- Compartilhar schemas, tipos de entrada, tipos de saída e códigos de erro públicos.
- Não compartilhar entidades do banco, hashes, campos internos, segredos ou detalhes de infraestrutura.
- Preferir contratos mínimos derivados das necessidades reais das telas.
- Alterações devem ser validadas nos dois consumidores: app e API.

