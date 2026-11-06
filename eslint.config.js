// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // These expo-lint rules produce false positives for common patterns
      // used throughout React Native (Animated.Value / PanResponder ref access,
      // Date.now() in gesture handlers, setState in effects).
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'no-unused-vars': 'warn',
      'react/display-name': 'off',
    },
    ignores: ['dist/*', 'files/*'],
  },
]);
