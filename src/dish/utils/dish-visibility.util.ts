import { DishSession } from "../entities/dish-session.entity";

export function isDishActiveNow(
  scheduleEnabled: boolean,
  sessions: DishSession[],
  currentDay: number,
  currentTime: number,
): boolean {
  if (!scheduleEnabled || sessions.length === 0) return true;

  return sessions.some((session) => {
    if (!session.status) return false;
    const dayMatch =
      session.day_from <= session.day_to
        ? currentDay >= session.day_from && currentDay <= session.day_to
        : currentDay >= session.day_from || currentDay <= session.day_to;
    if (!dayMatch) return false;

    if (session.end_hhmm < session.start_hhmm) {
      return currentTime >= session.start_hhmm || currentTime <= session.end_hhmm;
    }
    return currentTime >= session.start_hhmm && currentTime <= session.end_hhmm;
  });
}
