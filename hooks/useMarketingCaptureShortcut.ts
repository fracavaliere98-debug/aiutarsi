import { useEffect, useRef } from "react";
import { NativeModules, Platform } from "react-native";
import { useRouter, useSegments } from "expo-router";
import Constants from "expo-constants";

const SHORTCUT_PATTERN = ["up", "down", "up"] as const;
const SEQUENCE_TIMEOUT_MS = 2500;
const ACTIVATION_COOLDOWN_MS = 1500;
const MIN_VOLUME_DELTA = 0.01;

type VolumeDirection = (typeof SHORTCUT_PATTERN)[number];

type VolumeSubscription = {
  remove: () => void;
};

type VolumeManagerModule = {
  showNativeVolumeUI: (options: { enabled: boolean }) => Promise<unknown>;
  getVolume: () => Promise<{ volume: number }>;
  addVolumeListener: (listener: ({ volume }: { volume: number }) => void) => VolumeSubscription;
};

export function useMarketingCaptureShortcut() {
  const router = useRouter();
  const segments = useSegments();
  const lastVolumeRef = useRef<number | null>(null);
  const sequenceRef = useRef<{ direction: VolumeDirection; timestamp: number }[]>([]);
  const cooldownUntilRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    if (!__DEV__ || Platform.OS === "web") {
      return () => {
        isMountedRef.current = false;
      };
    }

    if (Constants.appOwnership === "expo" || !NativeModules.VolumeManager) {
      return () => {
        isMountedRef.current = false;
      };
    }

    let volumeManager: VolumeManagerModule | null = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require("react-native-volume-manager");
      volumeManager = (module?.VolumeManager || module?.default || null) as VolumeManagerModule | null;
    } catch {
      return () => {
        isMountedRef.current = false;
      };
    }

    if (!volumeManager) {
      return () => {
        isMountedRef.current = false;
      };
    }

    const segmentKey = segments.join("/");
    const onMarketingCapture = segmentKey === "dev/marketing-capture";

    const registerDirection = (direction: VolumeDirection) => {
      const now = Date.now();

      if (now < cooldownUntilRef.current) {
        return;
      }

      sequenceRef.current = [
        ...sequenceRef.current.filter((entry) => now - entry.timestamp <= SEQUENCE_TIMEOUT_MS),
        { direction, timestamp: now },
      ];

      const recentDirections = sequenceRef.current.map((entry) => entry.direction);
      const matched = SHORTCUT_PATTERN.every((expected, index) => recentDirections[index] === expected);

      if (!matched) {
        if (recentDirections[recentDirections.length - 1] !== SHORTCUT_PATTERN[0]) {
          sequenceRef.current = [];
        } else {
          sequenceRef.current = [{ direction: SHORTCUT_PATTERN[0], timestamp: now }];
        }
        return;
      }

      cooldownUntilRef.current = now + ACTIVATION_COOLDOWN_MS;
      sequenceRef.current = [];

      if (!onMarketingCapture) {
        router.push("/dev/marketing-capture");
      }
    };

    void volumeManager.showNativeVolumeUI({ enabled: false }).catch(() => undefined);

    void volumeManager.getVolume()
      .then(({ volume }) => {
        if (isMountedRef.current) {
          lastVolumeRef.current = volume;
        }
      })
      .catch(() => undefined);

    const subscription = volumeManager.addVolumeListener(({ volume }) => {
      const previous = lastVolumeRef.current;
      lastVolumeRef.current = volume;

      if (previous === null) {
        return;
      }

      const delta = volume - previous;

      if (Math.abs(delta) < MIN_VOLUME_DELTA) {
        return;
      }

      registerDirection(delta > 0 ? "up" : "down");
    });

    return () => {
      isMountedRef.current = false;
      subscription.remove();
      void volumeManager.showNativeVolumeUI({ enabled: true }).catch(() => undefined);
    };
  }, [router, segments]);
}
