# Capas ilustrativas de fichas

Oito ilustrações originais geradas pela ferramenta integrada `image_gen`. Prompts e arquivos de origem estão em [prompts.json](prompts.json); a [galeria](catalog.html) apresenta a coleção. Os arquivos finais estão em `apps/mobile/assets/images/plan-covers/`, em WebP 640 × 360, proporção 16:9; total de 119.594 bytes. Sharp foi usado somente para redimensionar e codificar os arquivos.

Catálogo: running-woman, running-man, muscle-woman, muscle-man, strength, conditioning, mobility e wellness. As capas são decorativas e independentes das imagens de exercícios e das ilustrações dos treinos A/B/C. O app inclui os arquivos para uso offline, conserva a proporção e utiliza Bem-estar como alternativa.

Somente o admin seleciona capas no editor de fichas do portal. A API valida IDs do catálogo e bloqueia alterações por outros perfis. Não há upload nem URLs arbitrárias. Profissionais preservam a capa ao editar outros campos. Cópias do catálogo e atribuições profissionais mantêm a capa da origem como snapshot.

Migration 045 preenche fichas existentes pelo nome/objetivo e público explícito do programa, sem consultar perfil pessoal nem alterar exercícios ou prescrições. Capas já definidas são preservadas. Testes em `apps/api/test/workout-covers.test.ts` verificam permissões, cópia, persistência, preenchimento e os oito assets.

Distribuído no APK 1.05. Preenchimento aplicado às fichas e modelos existentes após validação em cópia isolada do banco; prescrições preservadas. Seleção e persistência verificadas no portal real, além do app em larguras de 320 e 390 px.
