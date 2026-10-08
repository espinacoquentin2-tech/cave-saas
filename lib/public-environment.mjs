/** Refuse les secrets avant que Next.js ne crée les fichiers destinés au navigateur. */
export function assertSafePublicEnvironment(environment) {
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith("NEXT_PUBLIC_") || !value) continue;
    const allowedPublicKeys = ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"];
    const unknownKey = /(?:^|_)(KEY|TOKEN)(?:_|$)/i.test(name) && !allowedPublicKeys.includes(name);
    let privileged = unknownKey || /SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|DATABASE_URL/i.test(name)
      || /^(sb_secret_|sk_)/.test(value);
    if (value.split(".").length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString());
        privileged ||= ["service_role", "supabase_admin"].includes(payload.role);
      } catch {
        // Une valeur qui n'est pas un JWT n'a pas de rôle Supabase à inspecter.
      }
    }
    if (privileged) throw new Error(`Secret interdit dans la variable publique ${name}. Utiliser une variable serveur.`);
  }
}
