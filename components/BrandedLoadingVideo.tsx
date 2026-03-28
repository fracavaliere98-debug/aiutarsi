import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoSource, VideoView } from "expo-video";

interface BrandedLoadingVideoProps {
    source: VideoSource;
    style?: ViewStyle;
    overlayOpacity?: number;
    showOverlay?: boolean;
    contentFit?: "contain" | "cover" | "fill" | "none" | "scale-down";
    startAtSeconds?: number;
}

export function BrandedLoadingVideo({
    source,
    style,
    overlayOpacity = 0.38,
    showOverlay = true,
    contentFit = "cover",
    startAtSeconds = 0,
}: BrandedLoadingVideoProps) {
    const player = useVideoPlayer(source, (instance) => {
        instance.loop = true;
        instance.muted = true;
        if (startAtSeconds > 0) {
            instance.currentTime = startAtSeconds;
        }
        instance.play();
    });

    return (
        <View style={[styles.container, style]}>
            <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                nativeControls={false}
                allowsFullscreen={false}
                contentFit={contentFit}
            />
            {showOverlay && (
                <LinearGradient
                    colors={[
                        `rgba(15,23,42,${overlayOpacity + 0.12})`,
                        `rgba(76,29,149,${overlayOpacity})`,
                        `rgba(15,23,42,${overlayOpacity + 0.18})`,
                    ]}
                    style={StyleSheet.absoluteFill}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#0f172a",
        overflow: "hidden",
    },
});
