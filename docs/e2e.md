# Tests E2E Playwright

Ce projet utilise Playwright avec un Chromium isole. Les smoke tests UI ne lisent pas les cookies de Chrome personnel et n'utilisent pas la session navigateur principale.

## Variables

Creer un `.env.local` ou exporter les variables suivantes avant de lancer les tests :

```bash
E2E_BASE_URL=http://localhost:3000
E2E_ADMIN_EMAIL=admin-test@example.com
E2E_ADMIN_PASSWORD=change-me
```

Un exemple sans secret est disponible dans `.env.e2e.example`.

Utiliser un compte de test. Ne pas mettre de secret dans Git et ne pas utiliser la session Chrome personnelle.

## Lancement

Demarrer l'application :

```bash
npm run dev
```

Lancer le smoke test V1 :

```bash
npm run test:e2e:ui-v1
```

Mode visible :

```bash
npm run test:e2e:headed -- tests/e2e/ui-v1-smoke.spec.ts
```

Le test ouvre les modules V1, verifie les ecrans et peut ouvrir/fermer certaines modales, sans soumettre de formulaire metier.
