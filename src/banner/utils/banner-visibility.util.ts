export type BannerSession = {
  day_from: number;
  day_to: number;
  start_hhmm: number;
  end_hhmm: number;
  status?: boolean;
};

export function isBannerActiveNow(
  scheduleEnabled: boolean,
  sessions: BannerSession[],
  currentDay: number,
  currentTime: number,
): boolean {
  if (!scheduleEnabled) return true;
  if (sessions.length === 0) return false;
  return sessions.some((session) => {
    if (session.status === false) return false;
    const inDayRange =
      session.day_from <= session.day_to
        ? currentDay >= session.day_from && currentDay <= session.day_to
        : currentDay >= session.day_from || currentDay <= session.day_to;
    if (!inDayRange) return false;
    if (session.end_hhmm < session.start_hhmm) {
      return currentTime >= session.start_hhmm || currentTime <= session.end_hhmm;
    }
    return currentTime >= session.start_hhmm && currentTime <= session.end_hhmm;
  });
}

