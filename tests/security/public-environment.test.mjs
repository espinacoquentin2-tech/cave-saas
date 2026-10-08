import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function loadConfig(environment) {
  const code = ts.transpileModule(readFileSync("next.config.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText.replace(/from ['"]\.\/([^'"]+)['"]/g, (_, path) => `from ${JSON.stringify(pathToFileURL(`${process.cwd()}/${path}`).href)}`);
  return spawnSync(process.execPath, ["--input-type=module", "-e", code], {
    env: { ...process.env, ...environment }, encoding: "utf8",
  });
}

test("le build refuse une clé privilégiée placée dans une variable publique", () => {
  const secret = "sb_secret_recette_ne_pas_exposer";
  const result = loadConfig({ NEXT_PUBLIC_SUPABASE_ANON_KEY: secret });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.ok(!result.stderr.includes(secret), "Le diagnostic ne doit pas recopier le secret.");
});

test("le build refuse un mot de passe exposé même sous une autre variable publique", () => {
  const result = loadConfig({ NEXT_PUBLIC_DATABASE_PASSWORD: "recette-confidentielle" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEXT_PUBLIC_DATABASE_PASSWORD/);
});

test("le build accepte la clé Supabase publique", () => {
  assert.equal(loadConfig({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_recette" }).status, 0);
});

test("le build refuse aussi une ancienne clé JWT service_role", () => {
  const payload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
  const result = loadConfig({ NEXT_PUBLIC_SUPABASE_ANON_KEY: `header.${payload}.signature` });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});

test("une clé API inconnue doit rester côté serveur", () => {
  const result = loadConfig({ NEXT_PUBLIC_MAIL_API_KEY: "cle-confidentielle-recette" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /NEXT_PUBLIC_MAIL_API_KEY/);
});
