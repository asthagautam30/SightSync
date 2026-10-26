const STORAGE_KEY_PREFIX = "smart-spectacles-weekly-report-dismissed:";

export function getWeeklyReportWeekKey(date = new Date()): string {
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(date);

  monday.setDate(date.getDate() - daysSinceMonday);
  monday.setHours(0, 0, 0, 0);

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const dateOfMonth = String(monday.getDate()).padStart(2, "0");

  return `${year}-${month}-${dateOfMonth}`;
}

export function isWeeklyReportNoticeDismissed(
  userId: string,
  weekKey: string
): boolean {
  if (typeof window === "undefined") return true;

  return (
    window.localStorage.getItem(
      `${STORAGE_KEY_PREFIX}${userId}:${weekKey}`
    ) === "true"
  );
}

export function dismissWeeklyReportNotice(
  userId: string,
  weekKey: string
): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${userId}:${weekKey}`,
    "true"
  );
}