import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { AgeBand, ChildProfile } from '@huroofi/content-schema';
import { colors, radii, spacing, touchTargets } from '@huroofi/design-system';
import type { BootedApp } from '../bootstrap';
import { strings } from '../strings';
import { layout } from './layout';

/**
 * Profile picker: tap a child to play. The parent gate and profile editing arrive in M4.
 */
export function HomeScreen({
  app,
  onPlay,
}: {
  app: BootedApp;
  onPlay: (child: ChildProfile) => void;
}) {
  const [children, setChildren] = useState<ChildProfile[] | null>(null);

  const refresh = useCallback(() => {
    void app.repo.listChildren().then(setChildren);
  }, [app]);
  useEffect(refresh, [refresh]);

  const addChild = async (ageBand: AgeBand) => {
    await app.repo.createChild({
      displayName: strings.defaultChildName((children?.length ?? 0) + 1),
      ageBand,
    });
    refresh();
  };

  return (
    <ScrollView contentContainerStyle={layout.screen}>
      <View style={layout.center}>
        <Text style={{ fontSize: 96 }} accessibilityLabel="Faseeh" accessibilityRole="image">
          🦊
        </Text>
        <Text style={layout.title} accessibilityRole="header">
          {strings.appTitle}
        </Text>
        <View
          style={{
            backgroundColor: colors.surfaceSunken,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
          }}
        >
          <Text style={layout.body} testID="offline-badge">
            {strings.offlineBadge}
          </Text>
        </View>
      </View>

      <Text style={layout.body}>{strings.whoIsPlaying}</Text>
      {children?.length === 0 && <Text style={layout.body}>{strings.noProfiles}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {children?.map((child) => (
          <Pressable
            key={child.id}
            testID="child-profile"
            accessibilityRole="button"
            accessibilityLabel={`${strings.play}: ${child.displayName}`}
            onPress={() => onPlay(child)}
            style={{
              minWidth: touchTargets.preReader * 2,
              minHeight: touchTargets.preReader,
              borderRadius: radii.lg,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              padding: spacing.sm,
            }}
          >
            <Text style={layout.body}>{child.displayName}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        {(['4-6', '7-9'] as const).map((band) => (
          <Pressable
            key={band}
            accessibilityRole="button"
            accessibilityLabel={`${strings.addChild} ${band === '4-6' ? strings.ageBand46 : strings.ageBand79}`}
            testID={`add-child-${band}`}
            style={layout.bigButton}
            onPress={() => void addChild(band)}
          >
            <Text style={layout.bigButtonText}>
              {band === '4-6' ? strings.ageBand46 : strings.ageBand79}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={layout.debug} testID="build-info">
        {`${app.pack.packId}@${app.pack.version} · db v${app.schema.to} · content ${app.validation.errors.length} errors / ${app.validation.warnings.length} warnings · activities ${app.registry
          .list()
          .map((a) => `${a.type}@${a.version}`)
          .join(',')}`}
      </Text>
    </ScrollView>
  );
}
