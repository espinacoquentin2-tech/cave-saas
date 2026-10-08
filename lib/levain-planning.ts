import type { PlannedTirageDay, LevainPlanningRow } from "./levain-types";
import { roundLevain } from "./levain";
const civilDay = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Date de planning invalide.");
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== date)
    throw new Error("Date de planning invalide.");
  return t / 86400000;
};
export function calculateLevainPlanning(
  days: PlannedTirageDay[],
  levainPct: number,
  temperatureC: 13 | 16 | 20,
): LevainPlanningRow[] {
  if (
    !Number.isFinite(levainPct) ||
    levainPct <= 0 ||
    levainPct > 100 ||
    ![13, 16, 20].includes(temperatureC)
  )
    throw new Error("Paramètres de planning invalides.");
  const rows: LevainPlanningRow[] = [];
  let next = 0;
  const dilution = { 13: 0.87, 16: 0.78, 20: 0.7 }[temperatureC];
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i],
      current = civilDay(day.date),
      intervalDays =
        i === days.length - 1 ? 0 : civilDay(days[i + 1].date) - current;
    if (
      (i < days.length - 1 && intervalDays <= 0) ||
      !Number.isFinite(day.baseWineVolumeHl) ||
      day.baseWineVolumeHl < 0
    )
      throw new Error("Journées non ordonnées ou volume invalide.");
    const required = (day.baseWineVolumeHl * levainPct) / 100,
      remaining = next * dilution ** intervalDays;
    rows.unshift({
      date: day.date,
      requiredLevainVolumeHl: roundLevain(required),
      morningVolumeHl: roundLevain(remaining + required),
      remainingVolumeHl: roundLevain(remaining),
      feedingVolumeHl: roundLevain(next - remaining),
      intervalDays,
    });
    next = remaining + required;
  }
  return rows;
}
