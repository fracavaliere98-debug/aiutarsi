
import React, { useState, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { Marker } from 'react-native-maps';
import { Zap } from 'lucide-react-native';
import { OldActivity } from '../types';
import { Colors } from '../constants/Colors';

interface ActivityMarkerProps {
    activity: OldActivity;
    isSelected: boolean;
    isEnrolled: boolean;
    markerColor: string;
    CatIcon: any;
    onPress: () => void;
}

export const ActivityMarker = ({ activity, isSelected, isEnrolled, markerColor, CatIcon, onPress }: ActivityMarkerProps) => {
    const [tracksView, setTracksView] = useState(true);

    // When selection state changes, we must enable tracking to let native side capture the new UI
    // then disable it for performance/stability.
    useEffect(() => {
        setTracksView(true);
        const timer = setTimeout(() => {
            setTracksView(false);
        }, 600); // 600ms is usually enough for the glow/scale animation
        return () => clearTimeout(timer);
    }, [isSelected]);

    return (
        <Marker
            key={activity.id}
            coordinate={{
                latitude: activity.location?.coords?.lat ?? 0,
                longitude: activity.location?.coords?.lng ?? 0
            }}
            onPress={onPress}
            anchor={{ x: 0.5, y: 0.9 }}
            tracksViewChanges={tracksView}
        >
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                {isSelected && (
                    <View style={{
                        position: 'absolute',
                        width: 50, height: 50,
                        borderRadius: 25,
                        backgroundColor: `${markerColor}30`,
                        borderWidth: 2, borderColor: markerColor,
                        transform: [{ scale: 1.2 }],
                        zIndex: -1
                    }} />
                )}

                <View style={{
                    width: isSelected ? 42 : 36,
                    height: isSelected ? 42 : 36,
                    backgroundColor: markerColor,
                    borderRadius: 12,
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3, shadowRadius: 5, elevation: 8,
                    borderWidth: 2, borderColor: 'white',
                    transform: [{ scale: isSelected ? 1.1 : 1 }],
                }}>
                    <CatIcon size={isSelected ? 20 : 18} color="white" strokeWidth={2.5} />
                </View>

                <View style={{
                    width: 0, height: 0,
                    borderLeftWidth: 6, borderLeftColor: 'transparent',
                    borderRightWidth: 6, borderRightColor: 'transparent',
                    borderTopWidth: 8, borderTopColor: 'white',
                    marginTop: -1, zIndex: 5
                }} />
                <View style={{
                    width: 0, height: 0,
                    borderLeftWidth: 4, borderLeftColor: 'transparent',
                    borderRightWidth: 4, borderRightColor: 'transparent',
                    borderTopWidth: 6, borderTopColor: markerColor,
                    marginTop: -7, zIndex: 6
                }} />

                {activity.isUrgent && !isSelected && (
                    <View style={{
                        position: 'absolute', top: -8, right: -8,
                        backgroundColor: Colors.accent,
                        borderRadius: 99, padding: 3,
                        borderWidth: 1.5, borderColor: 'white'
                    }}>
                        <Zap size={10} color="white" strokeWidth={3} />
                    </View>
                )}
            </View>
        </Marker>
    );
};
