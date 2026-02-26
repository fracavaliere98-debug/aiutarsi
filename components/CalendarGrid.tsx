import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { Activity } from "../types";

interface CalendarGridProps {
    activities: Activity[];
    onSelectDate: (date: Date) => void;
    selectedDate: Date;
}

export function CalendarGrid({ activities, onSelectDate, selectedDate }: CalendarGridProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date: Date) => {
        let day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        return day === 0 ? 6 : day - 1; // Adjust for Monday start (0=Mon, 6=Sun)
    };

    const monthNames = [
        "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
        "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];

    const prevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const getDayActivities = (day: number) => {
        const dateStr = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();
        return activities.filter(a => new Date(a.dateTime).toDateString() === dateStr);
    };

    const renderDays = () => {
        const totalDays = daysInMonth(currentMonth);
        const startDay = firstDayOfMonth(currentMonth);
        const days = [];

        // Empty cells for previous month
        for (let i = 0; i < startDay; i++) {
            days.push(<View key={`empty-${i}`} className="w-[14.28%] aspect-square" />);
        }

        // Days of current month
        for (let i = 1; i <= totalDays; i++) {
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            const dayActivities = getDayActivities(i);
            const hasActivities = dayActivities.length > 0;

            days.push(
                <TouchableOpacity
                    key={`day-${i}`}
                    onPress={() => onSelectDate(date)}
                    className="w-[14.28%] aspect-square items-center justify-center relative"
                >
                    <View
                        className={`w-9 h-9 items-center justify-center rounded-full ${isSelected ? 'bg-primary' : isToday ? 'bg-indigo-50 border border-indigo-200' : hasActivities ? 'border border-green-500' : ''}`}
                    >
                        <Text className={`font-medium ${isSelected ? 'text-white font-bold' : isToday ? 'text-primary font-bold' : 'text-gray-700'}`}>
                            {i}
                        </Text>
                    </View>

                    {/* Activity Dots */}
                    <View className="flex-row gap-0.5 mt-1 h-1.5">
                        {dayActivities.slice(0, 3).map((act, idx) => {
                            let dotColor = "bg-gray-300";
                            if (act.status === 'APERTA') dotColor = "bg-green-500";
                            if (act.status === 'IN_CORSO') dotColor = "bg-yellow-500";
                            if (act.status === 'COMPLETATA') dotColor = "bg-emerald-600";
                            if (act.status === 'CANCELLATA') dotColor = "bg-red-500";

                            return (
                                <View key={idx} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                            );
                        })}
                        {dayActivities.length > 3 && (
                            <View className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        )}
                    </View>
                </TouchableOpacity>
            );
        }

        return days;
    };

    return (
        <View className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 mb-6">
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4 px-2">
                <TouchableOpacity onPress={prevMonth} className="p-2 bg-gray-50 rounded-full">
                    <ChevronLeft size={20} color={Colors.primary} />
                </TouchableOpacity>
                <Text className="text-lg font-black text-primary capitalize">
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </Text>
                <TouchableOpacity onPress={nextMonth} className="p-2 bg-gray-50 rounded-full">
                    <ChevronRight size={20} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Week Days Header */}
            <View className="flex-row mb-2 border-b border-gray-100 pb-2">
                {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day, index) => (
                    <Text key={index} className="w-[14.28%] text-center text-xs font-bold text-gray-400 uppercase">
                        {day}
                    </Text>
                ))}
            </View>

            {/* Days Grid */}
            <View className="flex-row flex-wrap">
                {renderDays()}
            </View>
        </View>
    );
}
