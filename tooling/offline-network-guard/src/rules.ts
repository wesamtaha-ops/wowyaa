/**
 * Static half of the offline/privacy guarantee (plan §12, §14). Fails CI if source code
 * gains network calls, tracking SDKs, or camera/microphone permissions.
 */
export interface Finding {
  rule: string;
  file: string;
  line?: number;
  detail: string;
}

/** SDK families that must never ship in the child app (ads, tracking, remote telemetry). */
export const DENIED_DEPENDENCIES: readonly RegExp[] = [
  /^@react-native-firebase\//,
  /^firebase$/,
  /^@segment\//,
  /^@amplitude\//,
  /^mixpanel/,
  /^@sentry\//,
  /^react-native-google-mobile-ads$/,
  /^expo-ads/,
  /^react-native-fbsdk/,
  /^appsflyer/,
  /^@?braze/,
  /^expo-camera$/,
  /^react-native-vision-camera$/,
  /^expo-location$/,
  /^axios$/,
];

const SOURCE_RULES: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: 'no-fetch', pattern: /\bfetch\s*\(/ },
  { rule: 'no-xhr', pattern: /\bXMLHttpRequest\b/ },
  { rule: 'no-websocket', pattern: /\bnew\s+WebSocket\b/ },
  { rule: 'no-remote-url', pattern: /['"`]https?:\/\/(?!localhost\b)[^'"`\s]+/ },
];

/** Files allowed to mention network primitives because they exist to block them. */
export const SOURCE_ALLOWLIST: readonly RegExp[] = [/apps\/mobile\/src\/network-guard\.ts$/];

export function scanSource(file: string, text: string): Finding[] {
  if (SOURCE_ALLOWLIST.some((re) => re.test(file))) return [];
  const findings: Finding[] = [];
  text.split('\n').forEach((line, i) => {
    // Strip line comments, but not the `//` inside a URL scheme.
    const code = line.replace(/(^|[^:])\/\/.*$/, '$1');
    for (const { rule, pattern } of SOURCE_RULES) {
      if (pattern.test(code))
        findings.push({ rule, file, line: i + 1, detail: line.trim().slice(0, 120) });
    }
  });
  return findings;
}

export function scanManifest(
  file: string,
  manifest: { dependencies?: object; devDependencies?: object },
): Finding[] {
  const runtime = Object.keys(manifest.dependencies ?? {});
  return runtime
    .filter((dep) => DENIED_DEPENDENCIES.some((re) => re.test(dep)))
    .map((dep) => ({ rule: 'denied-dependency', file, detail: dep }));
}

const DENIED_ANDROID_PERMISSIONS = [
  'CAMERA',
  'RECORD_AUDIO',
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'READ_CONTACTS',
];
const DENIED_IOS_KEYS = [
  'NSCameraUsageDescription',
  'NSMicrophoneUsageDescription',
  'NSLocationWhenInUseUsageDescription',
  'NSUserTrackingUsageDescription',
  'NSContactsUsageDescription',
];

export function scanAppConfig(
  file: string,
  config: {
    expo?: {
      android?: { permissions?: string[]; blockedPermissions?: string[] };
      ios?: { infoPlist?: Record<string, unknown> };
      plugins?: unknown[];
    };
  },
): Finding[] {
  const findings: Finding[] = [];
  const expo = config.expo ?? {};
  for (const p of expo.android?.permissions ?? []) {
    if (DENIED_ANDROID_PERMISSIONS.some((d) => p.endsWith(d))) {
      findings.push({ rule: 'denied-permission', file, detail: `android ${p}` });
    }
  }
  const blocked = expo.android?.blockedPermissions ?? [];
  for (const d of ['CAMERA', 'RECORD_AUDIO']) {
    if (!blocked.some((b) => b.endsWith(`.${d}`))) {
      findings.push({
        rule: 'permission-not-blocked',
        file,
        detail: `android.blockedPermissions must include ${d}`,
      });
    }
  }
  for (const key of Object.keys(expo.ios?.infoPlist ?? {})) {
    if (DENIED_IOS_KEYS.includes(key))
      findings.push({ rule: 'denied-permission', file, detail: `ios ${key}` });
  }
  for (const plugin of expo.plugins ?? []) {
    const name = Array.isArray(plugin) ? String(plugin[0]) : String(plugin);
    if (DENIED_DEPENDENCIES.some((re) => re.test(name))) {
      findings.push({ rule: 'denied-plugin', file, detail: name });
    }
  }
  return findings;
}
