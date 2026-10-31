# Feedback no aplicativo

Configurações → Feedback, sugestões e bugs permite enviar mensagens autenticadas nas categorias feedback, sugestão e bug. Mensagens têm de 10 a 3000 caracteres e são armazenadas na tabela privada `user_feedback`, vinculadas à conta autenticada. O endpoint `POST /me/feedback` valida o contrato compartilhado e limita o envio a cinco mensagens por minuto. Não há listagem pública, conversa, resposta automática da equipe ou painel de triagem nesta versão.

No grupo, o proprietário e administradores encontram o atalho Convidar pessoas antes do feed. O convite usa o identificador público do convidado, disponível na edição do perfil, com ou sem `@`. O destinatário precisa aceitar na tela Grupos.
