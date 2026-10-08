import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BusinessLogicError } from "@/lib/errors";
import {
  resolveAuthenticatedActor,
  assertRole,
  WRITE_ROLES,
} from "@/server/shared/request-context";
import { MixtionService } from "./mixtion.service";
export async function handleMixtion(
  request: Request,
  operation: "create" | "check",
) {
  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
    const result = await MixtionService[operation](await request.json(), actor);
    return NextResponse.json(
      { status: "SUCCESS", data: result },
      { status: operation === "create" ? 201 : 200 },
    );
  } catch (error) {
    if (error instanceof BusinessLogicError)
      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode },
      );
    if (error instanceof ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        {
          message: "Paramètres de mixtion invalides.",
          ...(error instanceof ZodError ? { details: error.flatten() } : {}),
        },
        { status: 400 },
      );
    console.error("mixtion operation failed", error);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}
