module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV || process.env.EXPO_PUBLIC_APP_ENV || "production";
  const isPreview = appEnv === "preview";
  const previewScheme = "aiutarsiapp-preview";

  return {
    ...config,
    name: isPreview ? "AiutarSi Preview" : config.name,
    scheme: isPreview ? previewScheme : config.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: isPreview ? "com.aiutarsi.app.preview" : config.ios?.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: isPreview ? "com.aiutarsi.app.preview" : config.android?.package,
    },
    extra: {
      ...config.extra,
      appEnv,
      authScheme: isPreview ? previewScheme : config.scheme,
    },
  };
};
