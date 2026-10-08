import "server-only";
import { listLevains } from "./levain-read.service";
import {
  assertRole,
  WRITE_ROLES,
  type RequestActor,
} from "@/server/shared/request-context";
import { LevainFeedingService } from "./levain-feeding.service";
import { LevainPreparationService } from "./levain-preparation.service";
import { LevainQualificationService } from "./levain-qualification.service";
import type {
  CreateLevainInput,
  PreparationInput,
  QualifyLevainInput,
  ObservationInput,
  FeedLevainInput,
} from "./levain.schemas";
export class LevainService {
  static list(actor: RequestActor) {
    return listLevains(actor);
  }
  static create(input: CreateLevainInput, actor: RequestActor) {
    assertRole(actor, WRITE_ROLES);
    return LevainPreparationService.create(input, actor);
  }
  static prepare(input: PreparationInput, actor: RequestActor) {
    assertRole(actor, WRITE_ROLES);
    return LevainPreparationService.prepare(input, actor);
  }
  static qualify(input: QualifyLevainInput, actor: RequestActor) {
    assertRole(actor, WRITE_ROLES);
    return LevainQualificationService.qualify(input, actor);
  }
  static observe(input: ObservationInput, actor: RequestActor) {
    assertRole(actor, WRITE_ROLES);
    return LevainQualificationService.observe(input, actor);
  }
  static feed(input: FeedLevainInput, actor: RequestActor) {
    assertRole(actor, WRITE_ROLES);
    return LevainFeedingService.feed(input, actor);
  }
}
