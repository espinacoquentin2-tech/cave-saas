// app/api/users/route.ts
import { NextResponse } from 'next/server';
import { UserSchema } from '../../../validations/admin.schema';
import { AdminService } from '../../../services/admin.service';

// CRÉATION D'UN UTILISATEUR
export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const validation = UserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // Remplacer "system@cave.fr" par l'email de l'Admin connecté (via la session)
    const result = await AdminService.upsertUser(validation.data, "system@cave.fr");
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[USERS_API_POST_ERROR]", error);
    // Si l'erreur vient des droits (définis dans le service), on renvoie 403 (Forbidden)
    const status = error.message.includes("Droits") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status });
  }
}

// MISE À JOUR D'UN UTILISATEUR EXISTANT
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    
    const validation = UserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }

    // Le service upsertUser détectera la présence de data.id et fera un UPDATE
    const result = await AdminService.upsertUser(validation.data, "system@cave.fr");
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error("[USERS_API_PUT_ERROR]", error);
    const status = error.message.includes("Droits") ? 403 : 400;
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status });
  }
}