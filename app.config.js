export default ({ config }) => ({
  ...config,
  name: 'Tikki',
  slug: 'tikki',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'tikki',
  userInterfaceStyle: 'dark',
  ios: { bundleIdentifier: 'fi.tikki.app' },
  android: { package: 'fi.tikki.app' },
  extra: { serverUrl: process.env.EXPO_PUBLIC_SERVER_URL || 'https://YOUR-TIKKI-SERVER.example.com' },
});
