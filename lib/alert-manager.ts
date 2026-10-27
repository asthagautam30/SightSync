export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertCandidate {
  key: string;
  severity: AlertSeverity;
  message: string;
}

interface AlertManagerOptions {
  cooldownMs?: number;
}

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

export class AlertManager {
  private lastSentAt = new Map<string, number>();
  private cooldownMs: number;

  constructor(options: AlertManagerOptions = {}) {
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  }

  shouldSend(alert: AlertCandidate, now = Date.now()): boolean {
    // Critical alerts always pass through immediately.
    if (alert.severity === "critical") {
      return true;
    }

    const lastSent = this.lastSentAt.get(alert.key);

    if (lastSent !== undefined && now - lastSent < this.cooldownMs) {
      return false;
    }

    this.lastSentAt.set(alert.key, now);
    return true;
  }

  clear(alertKey: string): void {
    this.lastSentAt.delete(alertKey);
  }

  clearAll(): void {
    this.lastSentAt.clear();
  }
}

export const alertManager = new AlertManager();