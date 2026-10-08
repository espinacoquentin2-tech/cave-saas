import { expect, test } from "@playwright/test";

test("les API métier refusent les requêtes sans session", async ({ request }) => {
  for (const route of ["/api/me", "/api/lots", "/api/containers", "/api/workorders"]) {
    expect((await request.get(route)).status(), route).toBe(401);
  }
});

test("un compte lecture seule peut lire mais ne peut pas modifier les données", async ({ request }) => {
  const email = process.env.E2E_READONLY_EMAIL;
  const password = process.env.E2E_READONLY_PASSWORD;
  test.skip(!email || !password, "Compte E2E lecture seule requis.");
  const auth = await request.post(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }, data: { email, password },
  });
  expect(auth.status()).toBe(200);
  const { access_token: token } = await auth.json();
  const headers = { Authorization: `Bearer ${token}` };
  const me = await request.get("/api/me", { headers });
  expect(me.status()).toBe(200);
  expect((await me.json()).roleKey).toBe("LECTURE_SEULE");
  expect((await request.get("/api/lots", { headers })).status()).toBe(200);
  // Payload vide volontaire : même en cas de régression, aucune donnée valide ne peut être créée.
  for (const route of ["/api/containers", "/api/lots", "/api/transfers", "/api/pressings/load", "/api/levains", "/api/levains/feed"]) {
    expect((await request.post(route, { headers, data: {} })).status(), route).toBe(403);
  }
});


test("les opérations de levain exigent une session", async ({ request }) => {
  for (const route of ["/api/levains", "/api/levains/feed"]) {
    expect((await request.post(route, { data: {} })).status(), route).toBe(401);
  }
});
