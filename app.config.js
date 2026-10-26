const { withEntitlementsPlist } = require("expo/config-plugins");

// Solo build locale su iPhone con Apple ID gratuito (Personal Team): `IOS_FREE_TEAM=1 npx expo run:ios --device`.
// Il team gratuito non può firmare push (aps-environment) né universal link (associated-domains),
// quindi li togliamo. Bundle id invariato (com.aiutarsi.app).
// Senza la variabile la config è identica: build EAS, OTA e fingerprint non cambiano.
const isFreeTeam = process.env.IOS_FREE_TEAM === "1";

const withoutPaidIosCapabilities = (config) =>
  withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["aps-environment"];
    delete cfg.modResults["com.apple.developer.associated-domains"];
    return cfg;
  });

module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV || process.env.EXPO_PUBLIC_APP_ENV || "production";
  const isPreview = appEnv === "preview";
  const previewScheme = "aiutarsiapp-preview";

  const result = {
    ...config,
    name: isPreview ? "AiutarSi Preview" : config.name,
    scheme: isPreview ? previewScheme : config.scheme,
    ios: {
      ...config.ios,
      // La variante preview ha un altro bundle id: non deve rivendicare i link https di aiutarsi.app.
      associatedDomains: isPreview ? undefined : config.ios?.associatedDomains,
      bundleIdentifier: isPreview ? "com.aiutarsi.app.preview" : config.ios?.bundleIdentifier,
    },
    android: {
      ...config.android,
      intentFilters: isPreview ? undefined : config.android?.intentFilters,
      package: isPreview ? "com.aiutarsi.app.preview" : config.android?.package,
    },
    extra: {
      ...config.extra,
      appEnv,
      authScheme: isPreview ? previewScheme : config.scheme,
    },
  };

  if (!isFreeTeam) return result;

  return withoutPaidIosCapabilities({
    ...result,
    ios: {
      ...result.ios,
      associatedDomains: undefined,
    },
  });
};
