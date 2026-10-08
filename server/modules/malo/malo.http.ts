import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BusinessLogicError } from "@/lib/errors";
import {
  resolveAuthenticatedActor,
  assertRole,
  READ_ROLES,
  WRITE_ROLES,
} from "@/server/shared/request-context";
import { logger } from "@/server/shared/logger";
import { MaloService } from "./malo.service";
type Action =
  | "list"
  | "read"
  | "create"
  | "update"
  | "prepare"
  | "inputs"
  | "steps"
  | "homogenize"
  | "reference"
  | "transfer"
  | "distribute"
  | "close";
export async function handleMalo(
  request: Request,
  action: Action,
  id?: number,
) {
  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(
      actor,
      ["list", "read"].includes(action) ? READ_ROLES : WRITE_ROLES,
    );
    if (
      !["list", "create"].includes(action) &&
      (!id || !Number.isSafeInteger(id) || id < 1)
    )
      throw new BusinessLogicError("Identifiant de dossier invalide.");
    let data;
    if (action === "list") data = await MaloService.list(actor);
    else if (action === "read") data = await MaloService.read(id!, actor);
    else if (action === "create")
      data = await MaloService.create(await request.json(), actor);
    else data = await MaloService[action](id!, await request.json(), actor);
    return NextResponse.json(
      { status: "SUCCESS", data },
      { status: action === "create" ? 201 : 200 },
    );
  } catch (e) {
    if (e instanceof ZodError || e instanceof SyntaxError)
      return NextResponse.json(
        {
          message: "Paramètres Malo invalides.",
          ...(e instanceof ZodError ? { details: e.flatten() } : {}),
        },
        { status: 400 },
      );
    if (e instanceof BusinessLogicError)
      return NextResponse.json(
        { message: e.message },
        { status: e.statusCode },
      );
    logger.error({
      action: "malo.error",
      details: { error: e instanceof Error ? e.message : "Erreur inconnue" },
    });
    return NextResponse.json(
      {
        message:
          "Erreur serveur. Vérifiez le résultat de l’opération avant de réessayer.",
      },
      { status: 500 },
    );
  }
}
