import { createMaloDossier, updateMaloDossier } from "./malo-dossier.service";
import { listMalo, readMaloDossier } from "./malo-read.service";
import {
  prepareMaloLot,
  addMaloInputs,
  recordMaloStep,
} from "./malo-preparation.service";
import {
  setMaloInitialReference,
  confirmMaloHomogenization,
} from "./malo-control.service";
import { transferMalo } from "./malo-transfer.service";
import { distributeMalo, closeMaloDossier } from "./malo-distribution.service";
export const MaloService = {
  create: createMaloDossier,
  update: updateMaloDossier,
  list: listMalo,
  read: readMaloDossier,
  prepare: prepareMaloLot,
  inputs: addMaloInputs,
  steps: recordMaloStep,
  reference: setMaloInitialReference,
  homogenize: confirmMaloHomogenization,
  transfer: transferMalo,
  distribute: distributeMalo,
  close: closeMaloDossier,
};
