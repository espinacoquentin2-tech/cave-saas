import type { MaloProfile, MaloProtocol, MaloScheduleItem } from "./malo-types";
export const MALO_KIT_REFERENCE = [
  { volumeHl: 25, mrLitres: 5 },
  { volumeHl: 100, mrLitres: 20 },
  { volumeHl: 500, mrLitres: 100 },
  { volumeHl: 1000, mrLitres: 200 },
  { volumeHl: 2000, mrLitres: 400 },
];
export function getMaloProtocol(profile: MaloProfile): MaloProtocol {
  const common = {
    schemaVersion: 1 as const,
    profile,
    mrTemperatureMin: null,
    mrTemperatureMax: null,
    pcmFaTemperature: null,
    pcmFmlTemperature: null,
    mrMalicThreshold: null,
    mrDays: null,
    doublingDays: null,
    pcmFirstControlDays: null,
    pcmControlIntervalDays: null,
    recipientFirstControlDays: null,
    preparedPcmPct: null,
    reference: "",
    notes: "",
  };
  if (profile === "PROGRESSIVE")
    return {
      ...common,
      label: "Réactivation progressive",
      mrTemperatureMin: 23,
      mrTemperatureMax: 25,
      pcmFaTemperature: 25,
      pcmFmlTemperature: 20,
      mrMalicThreshold: 1,
      recipientFirstControlDays: 21,
      preparedPcmPct: 3,
      reference:
        "https://ioc.eu.com/wp-content/uploads/documents/ioc/ft/FT%20INOBACTER%20%28FR%29.pdf",
      notes:
        "MR : eau et moût/vin à parts égales. FA du PCM : 20–25 °C. Table de formats documentaire sans interpolation ; volumes et intrants à confirmer. Dose documentaire 3–5 %, distincte de votre dose de distribution.",
    };
  if (profile === "CO_INOCULATION")
    return {
      ...common,
      label: "Co-inoculation sur moût",
      mrTemperatureMin: 25,
      mrTemperatureMax: 25,
      pcmFaTemperature: 25,
      pcmFmlTemperature: 20,
      mrDays: 3,
      doublingDays: 2,
      pcmFirstControlDays: 6,
      pcmControlIntervalDays: 2,
      recipientFirstControlDays: 15,
      reference:
        "https://www.oenotechnic.com/oenologie-conseil/outils-daide/plan-de-developpement-malo-en-co-inoculation/",
      notes:
        "Préparer MR et PCM en parallèle. Moût débourbé, de préférence de taille. Doubler le MR avec un prélèvement réel du PCM ; délai indicatif 3 puis 2 jours. Premier contrôle PCM à 6–7 jours. Dose documentaire 3 %. Les délais ne remplacent pas les analyses.",
    };
  return {
    ...common,
    label: "Personnalisé",
    notes:
      "Renseignez vos paramètres et critères de transfert. Aucun dosage d’intrant automatique.",
  };
}
function plusDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function buildMaloSchedule(
  protocol: MaloProtocol,
  anchors: {
    startedAt: string;
    pcmInoculatedAt?: string;
    distributedAt?: string;
  },
): MaloScheduleItem[] {
  const rows: MaloScheduleItem[] = [];
  if (protocol.mrDays != null)
    rows.push({
      kind: "MR",
      label: "Contrôler la réactivation / envisager le doublement",
      date: plusDays(anchors.startedAt, protocol.mrDays),
    });
  if (protocol.mrDays != null && protocol.doublingDays != null)
    rows.push({
      kind: "MR",
      label: "Contrôler avant incorporation du MR",
      date: plusDays(
        anchors.startedAt,
        protocol.mrDays + protocol.doublingDays,
      ),
    });
  if (anchors.pcmInoculatedAt && protocol.pcmFirstControlDays != null)
    for (let i = 0; i < 4; i++)
      rows.push({
        kind: "PCM",
        label: "Contrôle malique du PCM",
        date: plusDays(
          anchors.pcmInoculatedAt,
          protocol.pcmFirstControlDays +
            i * (protocol.pcmControlIntervalDays ?? 0),
        ),
      });
  if (anchors.distributedAt && protocol.recipientFirstControlDays != null)
    rows.push({
      kind: "CUVES",
      label: "Premier contrôle des cuves ensemencées",
      date: plusDays(anchors.distributedAt, protocol.recipientFirstControlDays),
    });
  return rows;
}
