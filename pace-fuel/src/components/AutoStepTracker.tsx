import React from 'react';
import { db, doc, getDoc, setDoc } from '../firebase';
import {
  getAutoStepLogId,
  getStepTrackingEnabled,
  getStepTrackingSnapshot,
  getTodayStepKey,
  isStepTrackingSupported,
  subscribeToStepTracking,
  updateStepTrackingSnapshot,
} from '../lib/stepTracking';

const STEP_THRESHOLD = 1.12;
const STEP_RESET_THRESHOLD = 0.35;
const MIN_STEP_INTERVAL_MS = 340;
const SYNC_INTERVAL_MS = 12000;

interface AutoStepTrackerProps {
  user: { uid: string } | null;
}

export default function AutoStepTracker({ user }: AutoStepTrackerProps) {
  const [trackingEnabled, setTrackingEnabled] = React.useState(getStepTrackingEnabled());
  const pendingStepsRef = React.useRef(0);
  const sessionStepsRef = React.useRef(0);
  const gravityRef = React.useRef(9.81);
  const lastStepAtRef = React.useRef(0);
  const thresholdOpenRef = React.useRef(false);
  const lastSnapshotAtRef = React.useRef(0);
  const syncInFlightRef = React.useRef(false);
  const dateKeyRef = React.useRef(getTodayStepKey());

  const publishSnapshot = React.useCallback(
    (
      updates: Partial<ReturnType<typeof getStepTrackingSnapshot>>,
      force = false,
    ) => {
      const now = Date.now();
      if (!force && now - lastSnapshotAtRef.current < 750) {
        return;
      }

      lastSnapshotAtRef.current = now;
      updateStepTrackingSnapshot({
        dateKey: dateKeyRef.current,
        sessionSteps: sessionStepsRef.current,
        pendingSteps: pendingStepsRef.current,
        ...updates,
      });
    },
    [],
  );

  const syncPendingSteps = React.useCallback(async () => {
    if (!user?.uid || syncInFlightRef.current || pendingStepsRef.current <= 0) {
      return;
    }

    const stepsToSync = pendingStepsRef.current;
    pendingStepsRef.current = 0;
    syncInFlightRef.current = true;

    try {
      const stepDocRef = doc(
        db,
        'stepLogs',
        getAutoStepLogId(user.uid, dateKeyRef.current),
      );
      const stepDoc = await getDoc(stepDocRef);
      const existingSteps = stepDoc.exists()
        ? Number(stepDoc.data().steps || 0)
        : 0;

      await setDoc(
        stepDocRef,
        {
          userId: user.uid,
          steps: existingSteps + stepsToSync,
          source: 'auto',
          dateKey: dateKeyRef.current,
          timestamp: new Date().toISOString(),
        },
        { merge: true },
      );

      const stillEnabled = getStepTrackingEnabled();
      publishSnapshot(
        {
          enabled: stillEnabled,
          status: stillEnabled ? 'active' : 'off',
          message: stillEnabled
            ? 'Auto pedometer is running while the app stays open.'
            : 'Auto step tracking is off.',
          pendingSteps: pendingStepsRef.current,
        },
        true,
      );
    } catch (error) {
      console.error('Auto step sync failed:', error);
      pendingStepsRef.current += stepsToSync;
      const stillEnabled = getStepTrackingEnabled();
      publishSnapshot(
        {
          enabled: stillEnabled,
          status: stillEnabled ? 'error' : 'off',
          message: stillEnabled
            ? 'Could not sync steps right now. The app will retry automatically.'
            : 'Auto step tracking is off.',
        },
        true,
      );
    } finally {
      syncInFlightRef.current = false;
    }
  }, [publishSnapshot, user?.uid]);

  React.useEffect(() => {
    const unsubscribe = subscribeToStepTracking((snapshot) => {
      setTrackingEnabled(snapshot.enabled);
    });

    return unsubscribe;
  }, []);

  React.useEffect(() => {
    const todayKey = getTodayStepKey();
    const snapshot = getStepTrackingSnapshot();

    if (snapshot.dateKey === todayKey) {
      sessionStepsRef.current = snapshot.sessionSteps;
      pendingStepsRef.current = snapshot.pendingSteps;
    } else {
      sessionStepsRef.current = 0;
      pendingStepsRef.current = 0;
    }
    dateKeyRef.current = todayKey;
  }, [user?.uid]);

  React.useEffect(() => {
    if (!user?.uid) {
      publishSnapshot(
        {
          enabled: false,
          status: 'off',
          message: 'Auto step tracking is off.',
          sessionSteps: 0,
          pendingSteps: 0,
          dateKey: getTodayStepKey(),
        },
        true,
      );
      return;
    }

    if (!trackingEnabled) {
      publishSnapshot(
        {
          enabled: false,
          status: 'off',
          message: 'Auto step tracking is off.',
          sessionSteps: 0,
          pendingSteps: 0,
          dateKey: getTodayStepKey(),
        },
        true,
      );
      return;
    }

    if (!isStepTrackingSupported()) {
      publishSnapshot(
        {
          enabled: false,
          status: 'unsupported',
          message: 'This device does not expose motion sensors for pedometer tracking.',
        },
        true,
      );
      return;
    }

    const refreshDateKeyIfNeeded = () => {
      const todayKey = getTodayStepKey();
      if (todayKey === dateKeyRef.current) {
        return;
      }

      void syncPendingSteps();
      dateKeyRef.current = todayKey;
      sessionStepsRef.current = 0;
      pendingStepsRef.current = 0;
      gravityRef.current = 9.81;
      lastStepAtRef.current = 0;
      thresholdOpenRef.current = false;
      publishSnapshot(
        {
          enabled: true,
          status: 'active',
          message: 'Auto pedometer is running while the app stays open.',
          sessionSteps: 0,
          pendingSteps: 0,
          dateKey: todayKey,
        },
        true,
      );
    };

    const handleMotion = (event: DeviceMotionEvent) => {
      refreshDateKeyIfNeeded();

      const acceleration =
        event.accelerationIncludingGravity || event.acceleration;
      if (!acceleration) {
        return;
      }

      const x = acceleration.x || 0;
      const y = acceleration.y || 0;
      const z = acceleration.z || 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      gravityRef.current = gravityRef.current * 0.9 + magnitude * 0.1;
      const filteredMagnitude = Math.abs(magnitude - gravityRef.current);
      const now = Date.now();

      if (
        filteredMagnitude > STEP_THRESHOLD &&
        !thresholdOpenRef.current &&
        (lastStepAtRef.current === 0 ||
          now - lastStepAtRef.current > MIN_STEP_INTERVAL_MS)
      ) {
        thresholdOpenRef.current = true;
        lastStepAtRef.current = now;
        pendingStepsRef.current += 1;
        sessionStepsRef.current += 1;

        publishSnapshot({
          enabled: true,
          status: 'active',
          message: 'Auto pedometer is running while the app stays open.',
        });
      } else if (filteredMagnitude < STEP_RESET_THRESHOLD) {
        thresholdOpenRef.current = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void syncPendingSteps();
      }
    };

    publishSnapshot(
      {
        enabled: true,
        status: 'starting',
        message: 'Move with your phone to begin auto step tracking.',
      },
      true,
    );

    const syncTimer = window.setInterval(() => {
      void syncPendingSteps();
    }, SYNC_INTERVAL_MS);

    window.addEventListener('devicemotion', handleMotion);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(syncTimer);
      void syncPendingSteps();
    };
  }, [publishSnapshot, syncPendingSteps, trackingEnabled, user?.uid]);

  return null;
}
