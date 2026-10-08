import { handleLevainOperation } from "@/server/modules/levains/levain.http";
export const POST = (request: Request) =>
  handleLevainOperation(request, "create");

import { NextResponse } from "next/server";
import {
  resolveAuthenticatedActor,
  assertRole,
  READ_ROLES,
} from "@/server/shared/request-context";
import { BusinessLogicError } from "@/lib/errors";
import { LevainService } from "@/server/modules/levains/levain.service";
export async function GET(request: Request) {
  try {
    const actor = await resolveAuthenticatedActor(request);
    assertRole(actor, READ_ROLES);
    return NextResponse.json({ data: await LevainService.list(actor) });
  } catch (e) {
    if (e instanceof BusinessLogicError)
      return NextResponse.json(
        { message: e.message },
        { status: e.statusCode },
      );
    console.error("levain read failed", e);
    return NextResponse.json({ message: "Erreur serveur." }, { status: 500 });
  }
}
