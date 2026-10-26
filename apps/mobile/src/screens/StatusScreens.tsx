import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from '@huroofi/design-system';
import { strings } from '../strings';
import { layout } from './layout';

export function LoadingScreen() {
  return (
    <View style={[layout.screen, layout.center]} accessibilityLabel={strings.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={layout.body}>{strings.loading}</Text>
    </View>
  );
}

export function BootErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <View style={[layout.screen, layout.center]}>
      <Text style={layout.title}>{strings.bootFailed}</Text>
      <Pressable accessibilityRole="button" style={layout.bigButton} onPress={onRetry}>
        <Text style={layout.bigButtonText}>{strings.retry}</Text>
      </Pressable>
      <Text style={layout.debug} testID="boot-error">
        {error.name}: {error.message}
      </Text>
    </View>
  );
}
