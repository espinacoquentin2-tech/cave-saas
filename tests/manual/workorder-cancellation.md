# Mini-recette `TEST-WORKORDER-CANCEL-CODEX`

Préconditions : base migrée, quatre comptes `ADMIN`, `CHEF_CAVE`, `CAVISTE` et
`LECTURE_SEULE`, au moins un lot actif utilisable pour planifier un ordre.

1. Avec `ADMIN`, créer un ordre `PENDING` dont le détail commence par
   `TEST-WORKORDER-CANCEL-CODEX-ADMIN`.
2. L'annuler depuis « Ordres de travail » avec le motif
   `TEST-WORKORDER-CANCEL-CODEX - erreur de planification`.
3. Vérifier en base :
   - `work_orders.status = 'CANCELLED'`;
   - `cancelled_at`, `cancelled_by` et `cancel_reason` sont renseignés;
   - `execution_evidence` et `executed_at` restent nuls;
   - un `audit_logs.action` commençant par `WO_CANCELLED_` existe;
   - aucun `lot_events` ou `bottle_events` n'a été créé par l'annulation.
4. Répéter avec `CHEF_CAVE` et le détail
   `TEST-WORKORDER-CANCEL-CODEX-CHEF`.
5. Avec `CAVISTE`, appeler `POST /api/workorders/{id}/cancel` sur un ordre
   `PENDING` : attendre `403` et vérifier l'absence de mutation.
6. Répéter avec `LECTURE_SEULE` : attendre `403` et vérifier l'absence de
   mutation.
7. Sur un ordre `DONE`, appeler la route d'annulation : attendre `409`, puis
   vérifier que `status`, `executed_at` et `execution_evidence` sont inchangés.
8. Ouvrir le dashboard :
   - l'ordre `DONE` figure dans `recent-activity-card`;
   - la date est valide;
   - le type vient de `executionEvidence.businessOperation` lorsqu'il existe,
     sinon de `recette`;
   - aucun `recent-activity-row` ne dépasse horizontalement la carte.
