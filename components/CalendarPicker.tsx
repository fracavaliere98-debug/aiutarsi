/**
 * CalendarPicker.tsx
 * Range-aware calendar modal.
 * - Single-tap mode  (rangeMode=false, default): picks one date → calls onSelect(date, date)
 * - Range mode       (rangeMode=true):           first tap = start, second tap = end
 *   If the second tap is before start the two dates are swapped automatically.
 *   Calls onSelect(fromDate, toDate).
 * All dates are "YYYY-MM-DD" strings.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform, ScrollView } from 'react-native';
import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { colors } from "@/theme";

export interface CalendarPickerProps {
    visible: boolean;
    /** Initial "from" date. Optional. */
    value?: string;       // YYYY-MM-DD or ''
    /** Initial "to" date. Only used in range mode. */
    valueTo?: string;     // YYYY-MM-DD or ''
    /** Enable range selection (two taps). Default false (single date). */
    rangeMode?: boolean;
    onSelect: (from: string, to: string) => void;
    onClose: () => void;
    minDate?: Date;
    maxDate?: Date;
}

const MONTHS_IT = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
const DAYS_IT = ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function dateStr(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function daysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function firstDayOfMonth(year: number, month: number) {
    return (new Date(year, month, 1).getDay() + 6) % 7; // 0=Mon…6=Sun
}
function parseDate(s: string) { return s ? new Date(s) : null; }

export function CalendarPicker({
    visible, value = '', valueTo = '', rangeMode = false,
    onSelect, onClose, minDate, maxDate,
}: CalendarPickerProps) {
    const today = useMemo(() => new Date(), []);
    const min = minDate || today;
    const max = maxDate || null;

    const initDate = parseDate(value) || today;
    const [viewYear, setViewYear] = useState(initDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(initDate.getMonth());

    // Internal range selection state (in range mode)
    const [pendingFrom, setPendingFrom] = useState<string>(value);
    const [pendingTo, setPendingTo] = useState<string>(valueTo);
    // Track whether we're picking start or end
    const [pickingEnd, setPickingEnd] = useState<boolean>(false);
    const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);

    useEffect(() => {
        if (!visible) return;
        const fresh = parseDate(value) || today;
        setViewYear(fresh.getFullYear());
        setViewMonth(fresh.getMonth());
        setPendingFrom(value);
        setPendingTo(valueTo);
        setPickingEnd(false);
        setShowMonthYearPicker(false);
    }, [visible, value, valueTo, today]);

    function prevMonth() {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    }
    function nextMonth() {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    }

    function pickDay(day: number) {
        const ds = dateStr(viewYear, viewMonth, day);

        if (!rangeMode) {
            // Single-date mode: immediately select and close
            onSelect(ds, ds);
            return;
        }

        if (!pickingEnd) {
            // First tap → set start, clear end, wait for end
            setPendingFrom(ds);
            setPendingTo('');
            setPickingEnd(true);
        } else {
            // Second tap → set end (swap if needed), call onSelect
            let from = pendingFrom;
            let to = ds;
            if (to < from) { [from, to] = [to, from]; }
            onSelect(from, to);
            // Reset state for next open
            setPendingFrom('');
            setPendingTo('');
            setPickingEnd(false);
        }
    }

    function handleClose() {
        // Reset intermediate state on cancel
        setPendingFrom(value);
        setPendingTo(valueTo);
        setPickingEnd(false);
        setShowMonthYearPicker(false);
        onClose();
    }

    function jumpToMonthYear(month: number, year: number) {
        setViewMonth(month);
        setViewYear(year);
        setShowMonthYearPicker(false);
    }

    function isDisabled(day: number) {
        const d = new Date(viewYear, viewMonth, day);
        d.setHours(0, 0, 0, 0);
        const m = new Date(min);
        m.setHours(0, 0, 0, 0);
        if (d < m) return true;
        if (max) {
            const maxCopy = new Date(max);
            maxCopy.setHours(0, 0, 0, 0);
            if (d > maxCopy) return true;
        }
        return false;
    }

    const ds = (day: number) => dateStr(viewYear, viewMonth, day);

    function isStart(day: number) { return !!pendingFrom && ds(day) === pendingFrom; }
    function isEnd(day: number) { return !!pendingTo && ds(day) === pendingTo; }
    function isInRange(day: number) {
        if (!pendingFrom || !pendingTo) return false;
        const s = ds(day);
        return s > pendingFrom && s < pendingTo;
    }

    const totalDays = daysInMonth(viewYear, viewMonth);
    const offset = firstDayOfMonth(viewYear, viewMonth);
    const cells: (number | null)[] = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    // Label under header
    const headerLabel = rangeMode
        ? (pickingEnd ? 'Scegli la data di fine' : 'Scegli la data di inizio')
        : 'Scegli la data';

    // Format a date string nicely for display inside the modal
    const fmtDate = (s: string) => {
        if (!s) return '—';
        const d = new Date(s);
        return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const yearOptions = useMemo(() => {
        const minYear = min.getFullYear();
        const maxYear = (max || today).getFullYear();
        const years: number[] = [];
        for (let year = maxYear; year >= minYear; year -= 1) {
            years.push(year);
        }
        return years;
    }, [min, max, today]);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
                <View style={{
                    backgroundColor: 'white',
                    borderTopLeftRadius: 28, borderTopRightRadius: 28,
                    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
                }}>
                    {/* Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.primary }}>{headerLabel}</Text>
                            {rangeMode && (
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                                    <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>
                                        Da: <Text style={{ color: pendingFrom ? colors.primary : '#94a3b8', fontWeight: '800' }}>{fmtDate(pendingFrom)}</Text>
                                    </Text>
                                    {pendingTo ? (
                                        <Text style={{ fontSize: 12, color: '#64748b', fontWeight: '600' }}>
                                            A: <Text style={{ color: colors.primary, fontWeight: '800' }}>{fmtDate(pendingTo)}</Text>
                                        </Text>
                                    ) : null}
                                </View>
                            )}
                        </View>
                        <TouchableOpacity onPress={handleClose}>
                            <X size={20} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {/* Month navigation */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 }}>
                        <TouchableOpacity onPress={prevMonth} style={{ padding: 8, borderRadius: 20, backgroundColor: '#f1f5f9' }}>
                            <ChevronLeft size={18} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowMonthYearPicker((current) => !current)}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                        >
                            <Text style={{ fontWeight: '900', fontSize: 16, color: colors.primary }}>
                                {MONTHS_IT[viewMonth]} {viewYear}
                            </Text>
                            <ChevronDown size={16} color={colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={nextMonth} style={{ padding: 8, borderRadius: 20, backgroundColor: '#f1f5f9' }}>
                            <ChevronRight size={18} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {showMonthYearPicker && (
                        <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
                            <View style={{ backgroundColor: '#f8fafc', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' }}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
                                    Scegli mese e anno
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 12, minHeight: 268 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>Mese</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                            {MONTHS_IT.map((monthLabel, monthIndex) => {
                                                const selected = monthIndex === viewMonth;
                                                return (
                                                    <TouchableOpacity
                                                        key={monthLabel}
                                                        onPress={() => jumpToMonthYear(monthIndex, viewYear)}
                                                        style={{
                                                            width: '31%',
                                                            paddingVertical: 10,
                                                            borderRadius: 14,
                                                            backgroundColor: selected ? `${colors.primary}18` : 'white',
                                                            borderWidth: 1,
                                                            borderColor: selected ? `${colors.primary}55` : '#e2e8f0',
                                                            alignItems: 'center',
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 12, fontWeight: '800', color: selected ? colors.primary : '#475569' }}>
                                                            {monthLabel.slice(0, 3)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    </View>
                                    <View style={{ width: 96, minHeight: 268 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>Anno</Text>
                                        <ScrollView style={{ maxHeight: 268 }} showsVerticalScrollIndicator={false}>
                                            <View style={{ gap: 8 }}>
                                                {yearOptions.map((year) => {
                                                    const selected = year === viewYear;
                                                    return (
                                                        <TouchableOpacity
                                                            key={year}
                                                            onPress={() => jumpToMonthYear(viewMonth, year)}
                                                            style={{
                                                                paddingVertical: 10,
                                                                borderRadius: 14,
                                                                backgroundColor: selected ? `${colors.primary}18` : 'white',
                                                                borderWidth: 1,
                                                                borderColor: selected ? `${colors.primary}55` : '#e2e8f0',
                                                                alignItems: 'center',
                                                            }}
                                                        >
                                                            <Text style={{ fontSize: 12, fontWeight: '800', color: selected ? colors.primary : '#475569' }}>
                                                                {year}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        </ScrollView>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Day names */}
                    <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 }}>
                        {DAYS_IT.map(d => (
                            <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: '#94a3b8' }}>{d}</Text>
                        ))}
                    </View>

                    {/* Grid */}
                    <View style={{ paddingHorizontal: 16, gap: 2 }}>
                        {Array.from({ length: cells.length / 7 }).map((_, rowIdx) => (
                            <View key={rowIdx} style={{ flexDirection: 'row' }}>
                                {cells.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, colIdx) => {
                                    if (!day) return <View key={colIdx} style={{ flex: 1, height: 40 }} />;
                                    const disabled = isDisabled(day);
                                    const start = isStart(day);
                                    const end = isEnd(day);
                                    const inRange = isInRange(day);
                                    const todayCell = (new Date()).setHours(0, 0, 0, 0) === new Date(viewYear, viewMonth, day).setHours(0, 0, 0, 0);
                                    const highlighted = start || end;
                                    return (
                                        <TouchableOpacity
                                            key={colIdx}
                                            onPress={() => !disabled && pickDay(day)}
                                            activeOpacity={disabled ? 1 : 0.75}
                                            style={{
                                                flex: 1, height: 40, alignItems: 'center', justifyContent: 'center',
                                                borderRadius: highlighted ? 20 : (inRange ? 0 : 20),
                                                backgroundColor: highlighted ? colors.primary : inRange ? `${colors.primary}20` : todayCell ? `${colors.primary}15` : 'transparent',
                                            }}
                                        >
                                            <Text style={{
                                                fontSize: 14,
                                                fontWeight: highlighted ? '900' : inRange ? '700' : todayCell ? '800' : '600',
                                                color: highlighted ? 'white' : disabled ? '#d1d5db' : inRange ? colors.primary : todayCell ? colors.primary : '#1e1b4b',
                                            }}>
                                                {day}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ))}
                    </View>

                    {/* Range mode: reset button */}
                    {rangeMode && (pendingFrom || pendingTo) && (
                        <TouchableOpacity
                            onPress={() => { setPendingFrom(''); setPendingTo(''); setPickingEnd(false); }}
                            style={{ marginTop: 12, marginHorizontal: 20, alignItems: 'center', paddingVertical: 10 }}
                        >
                            <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: '600' }}>Resetta intervallo</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}
