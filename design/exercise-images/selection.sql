-- Somente leitura. Executar explicitamente no banco de PRODUÇÃO.
-- Exportar só estas colunas; não exportar usuários ou identificadores de fichas.
SELECT e.id, e.name, e.image_url AS imageKey,
       COUNT(DISTINCT p.id) AS activePlanCount
FROM exercises e
JOIN portal_content pc ON pc.id = e.id
  AND pc.kind = 'exercise' AND pc.scope = 'global' AND pc.archived = FALSE
LEFT JOIN workout_plan_exercises wpe ON wpe.exercise_id = e.id AND wpe.source = 'catalog'
LEFT JOIN workout_divisions wd ON wd.id = wpe.division_id
LEFT JOIN workout_plans p ON p.id = wd.plan_id
  AND p.is_active = TRUE AND p.status = 'available'
  AND (p.valid_until IS NULL OR p.valid_until > UTC_TIMESTAMP())
WHERE e.source = 'catalog' AND e.image_url IS NULL
GROUP BY e.id, e.name, e.image_url
ORDER BY activePlanCount DESC, e.name;
