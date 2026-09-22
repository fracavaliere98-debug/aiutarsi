module.exports = function (api) {
    api.cache(true);
    return {
        presets: [
            ["babel-preset-expo", { jsxImportSource: "nativewind" }],
            "nativewind/babel",
        ], // react-native-reanimated/plugin rimosso: babel-preset-expo lo inietta automaticamente (react-native-worklets/plugin) da quando reanimated 4 usa react-native-worklets — tenerlo esplicito duplicava la trasformazione (verificato: react-native-reanimated/plugin è ora solo un re-export di react-native-worklets/plugin). jsxImportSource: "nativewind" e "nativewind/babel" richiesti dall'upgrade a NativeWind v4 (CSS interop).
    };
};
