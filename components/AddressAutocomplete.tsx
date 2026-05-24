import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { MapPin, X } from "lucide-react-native";
import { colors } from "@/theme";

interface Suggestion {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    address: {
        road?: string;
        house_number?: string;
        city?: string;
        town?: string;
        village?: string;
        postcode?: string;
    };
}

interface AddressAutocompleteProps {
    onSelect: (address: string, lat: number, lng: number) => void;
    onChangeText?: () => void;
    initialValue?: string;
    placeholder?: string;
}

export function AddressAutocomplete({ onSelect, onChangeText: onTextChange, initialValue = "", placeholder = "Cerca indirizzo..." }: AddressAutocompleteProps) {
    const [query, setQuery] = useState(initialValue);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Debounce logic could be added here, but for simplicity we'll just fetch on text change with a small timeout or relying on user pause
    // Implementing a simple debounce manually
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length > 2 && showSuggestions) {
                fetchSuggestions(query);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query, showSuggestions]);

    const fetchSuggestions = async (text: string) => {
        setLoading(true);
        try {
            // Limited to Italy for this app context, but customizable
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5&countrycodes=it`,
                {
                    headers: {
                        "OldUser-Agent": "AiutarSiApp/1.0"
                    }
                }
            );
            const data = await response.json();
            setSuggestions(data);
        } catch (error) {
            console.error("Error fetching address suggestions:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (item: Suggestion) => {
        // Construct a cleaner address string
        const addr = item.address;
        const main = addr.road ? `${addr.road} ${addr.house_number || ''}`.trim() : item.display_name.split(',')[0];
        const city = addr.city || addr.town || addr.village || '';
        const fullAddress = `${main}, ${city}`.replace(/^, /, '').trim(); // Fallback to display_name if needed, but this is usually cleaner

        // Use display_name as backup if our construction is empty
        const finalAddress = fullAddress || item.display_name;

        setQuery(finalAddress);
        setShowSuggestions(false);
        onSelect(finalAddress, parseFloat(item.lat), parseFloat(item.lon));
    };

    return (
        <View className="z-50 error-boundary-fix">
            <View className="bg-white p-4 rounded-2xl shadow-sm border border-primary/5 flex-row items-center relative">
                <View className="mr-3">
                    <MapPin size={20} color={colors.textSecondary} />
                </View>
                <TextInput
                    placeholder={placeholder}
                    value={query}
                    onChangeText={(text) => {
                        setQuery(text);
                        setShowSuggestions(true);
                        onTextChange?.();
                    }}
                    className="flex-1 text-primary font-medium text-base h-full" // Ensure height
                    style={{ paddingVertical: 0 }} // Fix android padding
                />
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => { setQuery(""); setShowSuggestions(false); }}>
                        <X size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Suggestions List */}
            {showSuggestions && (suggestions.length > 0 || loading) && (
                <View className="absolute top-[110%] left-0 right-0 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" style={{ maxHeight: 200 }}>
                    {loading && (
                        <View className="p-4 items-center">
                            <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                    )}
                    {!loading && (
                        <ScrollView keyboardShouldPersistTaps="handled" className="max-h-[200px]">
                            {suggestions.map((item) => (
                                <TouchableOpacity
                                    key={item.place_id.toString()}
                                    onPress={() => handleSelect(item)}
                                    className="p-3 border-b border-gray-50 flex-row items-center gap-3 active:bg-gray-50"
                                >
                                    <MapPin size={16} color={colors.accent} />
                                    <View className="flex-1">
                                        <Text className="text-primary font-bold text-sm" numberOfLines={1}>
                                            {item.address.road || item.display_name.split(',')[0]}
                                        </Text>
                                        <Text className="text-secondary text-xs" numberOfLines={1}>
                                            {item.display_name}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}
        </View>
    );
}
