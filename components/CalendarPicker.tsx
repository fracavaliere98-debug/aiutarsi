/**
 * CalendarPicker.tsx
 * A self-contained calendar modal: shows a month grid, lets the user
 * pick any future date, and calls onSelect with a "YYYY-MM-DD" string.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { Colors } from '../constants/Colors';

interface CalendarPickerProps {
    visible: boolean;
    value?: string; // YYYY-MM-DD or '' — optional, defaults to ''
    onSelect: (date: string) => void;
    onClose: () => void;
    minDate?: Date;
}

const MONTHS_IT = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const DAYS_IT = ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'];

function daysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
    // Monday-first: 0=Mon … 6=Sun
    const raw = new Date(year, month, 1).getDay();
    return (raw + 6) % 7;
}

export function CalendarPicker({ visible, value = '', onSelect, onClose, minDate }: CalendarPickerProps) {
    const today = new Date();
    const min = minDate || today;

    const initDate = value ? new Date(value) : today;
    const [viewYear, setViewYear] = useState(initDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initDate.getMonth());

    const selectedDate = value ? new Date(value) : null;

    function prevMonth() {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    }

    function nextMonth() {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    }

    function pickDay(day: number) {
        // Zero-pad month and day
        const m = String(viewMonth + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        onSelect(`${viewYear}-${m}-${d}`);
        onClose();
    }

    function isDisabled(day: number) {
        const d = new Date(viewYear, viewMonth, day);
        d.setHours(0, 0, 0, 0);
        const m = new Date(min);
        m.setHours(0, 0, 0, 0);
        return d < m;
    }

    function isSelected(day: number) {
        if (!selectedDate) return false;
        return (
            selectedDate.getFullYear() === viewYear &&
            selectedDate.getMonth() === viewMonth &&
            selectedDate.getDate() === day
        );
    }

    function isToday(day: number) {
        return (
            today.getFullYear() === viewYear &&
            today.getMonth() === viewMonth &&
            today.getDate() === day
        );
    }

    const totalDays = daysInMonth(viewYear, viewMonth);
    const offset = firstDayOfMonth(viewYear, viewMonth);

    // Build grid cells: empty pads + day numbers
    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    // Pad to full rows
    while (cells.length % 7 !== 0) cells.push(null);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
                <View style={{
                    backgroundColor: 'white',
                    borderTopLeftRadius: 28, borderTopRightRadius: 28,
                    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
                }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                        <Text style={{ flex: 1, fontSize: 18, fontWeight: '900', color: Colors.primary }}>Scegli la data</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Month navigation */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
                        <TouchableOpacity onPress={prevMonth} style={{ padding: 8, borderRadius: 20, backgroundColor: '#f1f5f9' }}>
                            <ChevronLeft size={18} color={Colors.primary} />
                        </TouchableOpacity>
                        <Text style={{ flex: 1, textAlign: 'center', fontWeight: '900', fontSize: 16, color: Colors.primary }}>
                            {MONTHS_IT[viewMonth]} {viewYear}
                        </Text>
                        <TouchableOpacity onPress={nextMonth} style={{ padding: 8, borderRadius: 20, backgroundColor: '#f1f5f9' }}>
                            <ChevronRight size={18} color={Colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {/* Day names */}
                    <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 }}>
                        {DAYS_IT.map(d => (
                            <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#94a3b8' }}>{d}</Text>
                        ))}
                    </View>

                    {/* Grid */}
                    <View style={{ paddingHorizontal: 16, gap: 4 }}>
                        {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => (
                            <View key={rowIdx} style={{ flexDirection: 'row' }}>
                                {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
                                    if (!day) return <View key={colIdx} style={{ flex: 1, height: 42 }} />;
                                    const disabled = isDisabled(day);
                                    const selected = isSelected(day);
                                    const todayCell = isToday(day);
                                    return (
                                        <TouchableOpacity
                                            key={colIdx}
                                            onPress={() => !disabled && pickDay(day)}
                                            activeOpacity={disabled ? 1 : 0.75}
                                            style={{
                                                flex: 1, height: 42, alignItems: 'center', justifyContent: 'center',
                                                borderRadius: 21,
                                                backgroundColor: selected ? Colors.primary : todayCell ? `${Colors.primary}20` : 'transparent',
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 14, fontWeight: selected ? '900' : todayCell ? '800' : '600',
                                                color: selected ? 'white' : disabled ? '#d1d5db' : todayCell ? Colors.primary : '#1e1b4b',
                                            }}>
                                                {day}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
