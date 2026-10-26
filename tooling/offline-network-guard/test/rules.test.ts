import { describe, expect, it } from 'vitest';
import { scanAppConfig, scanManifest, scanSource } from '../src/rules';

describe('offline network guard rules', () => {
  it('flags network primitives and remote URLs', () => {
    const src = [
      "await fetch('https://api.example.com')",
      'const x = new XMLHttpRequest();',
      "const ws = new WebSocket('wss://x');",
      "const ok = 'http://localhost:8081';",
      '// fetch( in a comment is fine',
    ].join('\n');
    expect(scanSource('packages/x/src/a.ts', src).map((f) => `${f.rule}:${f.line}`)).toEqual([
      'no-fetch:1',
      'no-remote-url:1',
      'no-xhr:2',
      'no-websocket:3',
    ]);
  });

  it('allows the guard implementation itself', () => {
    expect(scanSource('apps/mobile/src/network-guard.ts', 'target.fetch = () => fetch(x)')).toEqual(
      [],
    );
  });

  it('flags tracking SDK runtime dependencies only', () => {
    expect(
      scanManifest('p.json', {
        dependencies: { '@react-native-firebase/analytics': '1', zod: '4' },
        devDependencies: { axios: '1' },
      }),
    ).toEqual([
      { rule: 'denied-dependency', file: 'p.json', detail: '@react-native-firebase/analytics' },
    ]);
  });

  it('flags camera/microphone permissions and requires them blocked', () => {
    const findings = scanAppConfig('app.json', {
      expo: {
        android: { permissions: ['android.permission.CAMERA'], blockedPermissions: [] },
        ios: { infoPlist: { NSMicrophoneUsageDescription: 'x' } },
        plugins: [['expo-camera', {}]],
      },
    });
    expect(findings.map((f) => f.rule).sort()).toEqual(
      [
        'denied-permission',
        'denied-permission',
        'denied-plugin',
        'permission-not-blocked',
        'permission-not-blocked',
      ].sort(),
    );
  });
});
