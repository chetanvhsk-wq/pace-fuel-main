export type StepTrackingStatus =
  | 'off'
  | 'starting'
  | 'active'
  | 'permission-denied'
  | 'unsupported'
  | 'error';

export interface StepTrackingSnapshot {
  enabled: boolean;
  status: StepTrackingStatus;
  message: string;
  sessionSteps: number;
  pendingSteps: number;
  dateKey: string;
  lastUpdatedAt: string | null;
}

const STEP_TRACKING_ENABLED_KEY = 'pacefuel_auto_step_tracking_enabled';
const STEP_TRACKING_SNAPSHOT_KEY = 'pacefuel_auto_step_tracking_snapshot';
const STEP_TRACKING_EVENT = 'pacefuel:auto-step-tracking-update';

export function getTodayStepKey(date = new Date()) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

export function getAutoStepLogId(uid: string, dateKey: string) {
  return `${uid}_${dateKey}_auto_steps`;
}

export function isStepTrackingSupported() {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

export function requiresMotionPermission() {
  if (typeof window === 'undefined') {
    return false;
  }

  return typeof (window as any).DeviceMotionEvent?.requestPermission === 'function';
}

export async function requestStepTrackingPermission() {
  if (!requiresMotionPermission()) {
    return true;
  }

  try {
    const result = await (window as any).DeviceMotionEvent.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

export function getStepTrackingEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(STEP_TRACKING_ENABLED_KEY) === 'true';
}

function createDefaultSnapshot(enabled = getStepTrackingEnabled()): StepTrackingSnapshot {
  return {
    enabled,
    status: enabled ? 'starting' : 'off',
    message: enabled
      ? 'Auto step tracking is preparing.'
      : 'Auto step tracking is off.',
    sessionSteps: 0,
    pendingSteps: 0,
    dateKey: getTodayStepKey(),
    lastUpdatedAt: null,
  };
}

export function getStepTrackingSnapshot() {
  if (typeof window === 'undefined') {
    return createDefaultSnapshot(false);
  }

  try {
    const raw = window.localStorage.getItem(STEP_TRACKING_SNAPSHOT_KEY);
    if (!raw) {
      return createDefaultSnapshot();
    }

    const parsed = JSON.parse(raw) as Partial<StepTrackingSnapshot>;
    const todayKey = getTodayStepKey();

    return {
      ...createDefaultSnapshot(getStepTrackingEnabled()),
      ...parsed,
      enabled: getStepTrackingEnabled(),
      dateKey: parsed.dateKey === todayKey ? parsed.dateKey : todayKey,
      sessionSteps: parsed.dateKey === todayKey ? parsed.sessionSteps || 0 : 0,
      pendingSteps: parsed.dateKey === todayKey ? parsed.pendingSteps || 0 : 0,
    };
  } catch {
    return createDefaultSnapshot();
  }
}

function publishStepTrackingSnapshot(snapshot: StepTrackingSnapshot) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(STEP_TRACKING_EVENT, { detail: snapshot }));
}

export function updateStepTrackingSnapshot(
  updates: Partial<StepTrackingSnapshot>,
) {
  if (typeof window === 'undefined') {
    return createDefaultSnapshot(false);
  }

  const current = getStepTrackingSnapshot();
  const next: StepTrackingSnapshot = {
    ...current,
    ...updates,
    enabled: updates.enabled ?? current.enabled,
    dateKey: updates.dateKey || current.dateKey || getTodayStepKey(),
    sessionSteps: updates.sessionSteps ?? current.sessionSteps,
    pendingSteps: updates.pendingSteps ?? current.pendingSteps,
    lastUpdatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(STEP_TRACKING_SNAPSHOT_KEY, JSON.stringify(next));
  publishStepTrackingSnapshot(next);
  return next;
}

export function setStepTrackingEnabled(enabled: boolean) {
  if (typeof window === 'undefined') {
    return createDefaultSnapshot(false);
  }

  window.localStorage.setItem(STEP_TRACKING_ENABLED_KEY, String(enabled));

  return updateStepTrackingSnapshot({
    enabled,
    status: enabled ? 'starting' : 'off',
    message: enabled
      ? 'Move with your phone to start counting steps.'
      : 'Auto step tracking is off.',
    dateKey: getTodayStepKey(),
    sessionSteps: enabled ? getStepTrackingSnapshot().sessionSteps : 0,
    pendingSteps: enabled ? getStepTrackingSnapshot().pendingSteps : 0,
  });
}

export function subscribeToStepTracking(
  callback: (snapshot: StepTrackingSnapshot) => void,
) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<StepTrackingSnapshot>;
    callback(customEvent.detail || getStepTrackingSnapshot());
  };

  window.addEventListener(STEP_TRACKING_EVENT, handler);
  return () => window.removeEventListener(STEP_TRACKING_EVENT, handler);
}
