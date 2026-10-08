import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BusinessLogicError } from "@/lib/errors";
import {
  getRequestId,
  resolveAuthenticatedActor,
  assertRole,
  WRITE_ROLES,
} from "@/server/shared/request-context";
import { logger, logApiError } from "@/server/shared/logger";
import { LevainService } from "./levain.service";

export async function handleLevainOperation(
  request: Request,
  operation: "create" | "feed" | "prepare" | "qualify" | "observe",
) {
  const requestId = getRequestId(request);
  const route = `/api/levains/${operation}`;
  let actor: Awaited<ReturnType<typeof resolveAuthenticatedActor>> | null =
    null;
  try {
    actor = await resolveAuthenticatedActor(request);
    assertRole(actor, WRITE_ROLES);
    const payload = await request.json();
    const data = await LevainService[operation](payload, actor);
    logger.info({
      action: `levain.${operation}.success`,
      requestId,
      userEmail: actor.email,
      role: actor.role,
      details: {
        eventId: data.eventId,
        levainLotId: "levainLotId" in data ? data.levainLotId : undefined,
      },
    });
    return NextResponse.json(
      { status: "SUCCESS", data },
      {
        status: operation === "create" ? 201 : 200,
        headers: { "x-request-id": requestId },
      },
    );
  } catch (error) {
    const headers = { "x-request-id": requestId };
    if (error instanceof ZodError || error instanceof SyntaxError)
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Paramètres de levain invalides.",
          ...(error instanceof ZodError ? { details: error.flatten() } : {}),
        },
        { status: 400, headers },
      );
    if (error instanceof BusinessLogicError)
      return NextResponse.json(
        { error: "OPERATION_REJECTED", message: error.message },
        { status: error.statusCode, headers },
      );
    logApiError({
      action: `levain.${operation}.unhandled_error`,
      route,
      requestId,
      actor,
      error,
    });
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500, headers },
    );
  }
}
