import { View, Text, TouchableOpacity, Image, TextInput } from "react-native";
import { User } from "../../types";
import { Trophy, Search, TrendingUp, ChevronRight } from "lucide-react-native";
import { Colors } from "../../constants/Colors";
import { Card } from "../../components/Card";
import { useState } from "react";
import { StandardLayout } from "../../components/StandardLayout";

export default function EmployeesScreen() {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredEmployees: any[] = []; // Temporary placeholder since MockData is being removed

    const HeaderSlot = (
        <View className="mt-4">
            <View className="flex-row items-center bg-white/10 rounded-2xl px-4 py-3 border border-white/20">
                <Search size={20} color="rgba(255,255,255,0.6)" />
                <TextInput
                    placeholder="Cerca dipendente o reparto..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    className="flex-1 ml-3 text-white font-medium"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>
        </View>
    );

    const HeaderActions = (
        <View className="bg-accent p-3 rounded-2xl shadow-lg">
            <Trophy size={24} color="white" />
        </View>
    );

    return (
        <StandardLayout
            label="Corporate Social Responsibility"
            title="Impact Leaderboard"
            rightElement={HeaderActions}
        >
            {/* Search Bar moved to Body for consistency */}
            <View className="mb-6">
                <View className="flex-row items-center bg-white rounded-2xl px-4 py-3 shadow-sm border border-primary/5">
                    <Search size={20} color={Colors.secondary} />
                    <TextInput
                        placeholder="Cerca dipendente o reparto..."
                        placeholderTextColor="#9ca3af"
                        className="flex-1 ml-3 text-primary font-medium"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>
            {/* Top 3 Highlighs (Only if no search) */}
            {!searchQuery && filteredEmployees.length >= 3 && (
                <View className="flex-row gap-2 mb-8 items-end justify-center">
                    {/* 2nd Place */}
                    <View className="items-center flex-1">
                        <Image source={{ uri: filteredEmployees[1].avatar }} className="w-16 h-16 rounded-full border-4 border-gray-300 mb-2" />
                        <Text className="text-primary font-black text-xs text-center">{filteredEmployees[1].name.split(' ')[0]}</Text>
                        <View className="bg-gray-300 w-full h-12 rounded-t-xl mt-2 items-center justify-center">
                            <Text className="text-gray-600 font-black">2°</Text>
                        </View>
                    </View>
                    {/* 1st Place */}
                    <View className="items-center flex-1">
                        <View className="absolute -top-6 z-10">
                            <Trophy size={20} color="#FFD700" fill="#FFD700" />
                        </View>
                        <Image source={{ uri: filteredEmployees[0].avatar }} className="w-20 h-20 rounded-full border-4 border-[#FFD700] mb-2" />
                        <Text className="text-primary font-black text-sm text-center">{filteredEmployees[0].name.split(' ')[0]}</Text>
                        <View className="bg-[#FFD700] w-full h-20 rounded-t-xl mt-2 items-center justify-center">
                            <Text className="text-white font-black text-xl">1°</Text>
                        </View>
                    </View>
                    {/* 3rd Place */}
                    <View className="items-center flex-1">
                        <Image source={{ uri: filteredEmployees[2].avatar }} className="w-14 h-14 rounded-full border-4 border-[#CD7F32]/50 mb-2" />
                        <Text className="text-primary font-black text-xs text-center">{filteredEmployees[2].name.split(' ')[0]}</Text>
                        <View className="bg-[#CD7F32]/50 w-full h-8 rounded-t-xl mt-2 items-center justify-center">
                            <Text className="text-[#CD7F32] font-black">3°</Text>
                        </View>
                    </View>
                </View>
            )}

            <Text className="text-primary font-black text-lg mb-4">Classifica Completa</Text>

            {filteredEmployees.map((emp, index) => (
                <Card key={emp.id} className="mb-3 py-3 px-4">
                    <View className="flex-row items-center gap-4">
                        <Text className="text-secondary font-black text-base w-6">{index + 1}°</Text>
                        <Image source={{ uri: emp.avatar }} className="w-12 h-12 rounded-full" />
                        <View className="flex-1">
                            <Text className="text-primary font-black text-base leading-tight">{emp.name}</Text>
                            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-tighter">{emp.department}</Text>
                        </View>
                        <View className="items-end">
                            <View className="flex-row items-center gap-1">
                                <TrendingUp size={14} color={Colors.accent} />
                                <Text className="text-accent font-black text-base">{emp.impactPoints}</Text>
                            </View>
                            <Text className="text-secondary text-[10px]">{emp.hoursVolunteered} ore</Text>
                        </View>
                        <ChevronRight size={16} color="#cbd5e1" />
                    </View>
                </Card>
            ))}
        </StandardLayout>
    );
}
