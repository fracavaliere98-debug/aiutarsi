import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useRouter, useSegments } from "expo-router";
import { VolumeManager } from "react-native-volume-manager";

const SHORTCUT_PATTERN = ["up", "down", "up"] as const;
const SEQUENCE_TIMEOUT_MS = 2500;
const ACTIVATION_COOLDOWN_MS = 1500;
const MIN_VOLUME_DELTA = 0.01;

type VolumeDirection = (typeof SHORTCUT_PATTERN)[number];

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

    void VolumeManager.showNativeVolumeUI({ enabled: false }).catch(() => undefined);

    void VolumeManager.getVolume()
      .then(({ volume }) => {
        if (isMountedRef.current) {
          lastVolumeRef.current = volume;
        }
      })
      .catch(() => undefined);

    const subscription = VolumeManager.addVolumeListener(({ volume }) => {
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
      void VolumeManager.showNativeVolumeUI({ enabled: true }).catch(() => undefined);
    };
  }, [router, segments]);
}
