import React, { useRef, useState } from "react";
import { View, Text, TouchableOpacity, Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import { Colors } from "../constants/Colors";
import { NPOInsight } from "../hooks/useNPOInsights";
import { GemmaAvatar } from "./GemmaAvatar";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// The component is rendered inside a bleed wrapper with negative margins,
// so its natural parent width = full screen width.
const H_PAD = 16; // inner horizontal padding for card content

interface InsightCarouselProps {
    insights: NPOInsight[];
    onDismiss: (id: string) => void;
}

export function InsightCarousel({ insights, onDismiss }: InsightCarouselProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    if (insights.length === 0) return null;

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
        setActiveIndex(Math.max(0, Math.min(index, insights.length - 1)));
    };

    const renderItem = ({ item }: { item: NPOInsight }) => (
        <View style={{ width: SCREEN_WIDTH, paddingHorizontal: H_PAD }}>
            <LinearGradient
                colors={[Colors.primary, '#5b3dc4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    borderRadius: 24,
                    padding: 20,
                    shadowColor: Colors.primary,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 15,
                    elevation: 8,
                }}
            >
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <GemmaAvatar size={22} bordered />
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2 }}>Consiglio di Gemma</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => onDismiss(item.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <X size={18} color="white" opacity={0.6} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', marginBottom: 4 }}>{item.title}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 20, marginBottom: 20, fontWeight: '500' }}>
                    {item.description}
                </Text>

                {/* Action Button */}
                <TouchableOpacity
                    onPress={item.onAction}
                    style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
                    activeOpacity={0.7}
                >
                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {item.actionLabel}
                    </Text>
                </TouchableOpacity>
            </LinearGradient>
        </View>
    );

    return (
        <View style={{ marginBottom: 24 }}>
            <FlatList
                ref={flatListRef}
                data={insights}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                snapToInterval={SCREEN_WIDTH}
                snapToAlignment="start"
                decelerationRate="fast"
                onScroll={handleScroll}
                scrollEventThrottle={16}
                getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            />

            {/* Pagination dots */}
            {insights.length > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, gap: 6 }}>
                    {insights.map((_, i) => (
                        <View
                            key={i}
                            style={{
                                width: i === activeIndex ? 20 : 6,
                                height: 6,
                                borderRadius: 3,
                                backgroundColor: i === activeIndex ? Colors.primary : '#d1d5db',
                            }}
                        />
                    ))}
                </View>
            )}
        </View>
    );
}
