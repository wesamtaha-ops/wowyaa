// The native provider renders nothing until it measures insets, which never happens in Jest.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
