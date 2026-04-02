import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { AlertTriangle, RotateCcw } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { reportIssue, trackError } from '../utils/monitoring';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Global Error Boundary to catch unhandled JS errors and prevent app crashes.
 * Displays a friendly error screen with a reload option.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        trackError(error, {
            source: "error_boundary",
            componentStack: errorInfo.componentStack || "n/a",
        }, {
            source: "error_boundary",
            priority: "critical",
            classification: "critical_crash",
            issueName: "app_error_boundary",
        });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        // In a real app, you might want to force a full reload or reset navigation state
    };

    render() {
        if (this.state.hasError) {
            return (
                <SafeAreaView className="flex-1 bg-white items-center justify-center p-6">
                    <View className="items-center mb-8">
                        <View className="w-24 h-24 bg-red-50 rounded-full items-center justify-center mb-6">
                            <AlertTriangle size={48} color="#ef4444" />
                        </View>
                        <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
                            Qualcosa è andato storto
                        </Text>
                        <Text className="text-gray-500 text-center mb-6">
                            Si è verificato un errore imprevisto. Abbiamo notificato il team tecnico.
                        </Text>

                        {this.state.error && (
                            <ScrollView className="w-full max-h-40 bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100">
                                <Text className="text-xs text-gray-600 font-mono">
                                    {this.state.error.toString()}
                                </Text>
                            </ScrollView>
                        )}

                        <TouchableOpacity
                            onPress={this.handleReset}
                            className="flex-row items-center bg-primary px-6 py-4 rounded-xl shadow-sm active:opacity-90"
                        >
                            <RotateCcw size={20} color="white" className="mr-2" />
                            <Text className="text-white font-bold text-base">Riprova</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                void reportIssue({
                                    screen: "global_error_boundary",
                                    error: this.state.error,
                                });
                            }}
                            className="mt-3 px-5 py-3 rounded-xl border border-primary/15 bg-primary/5 active:opacity-90"
                        >
                            <Text className="text-primary font-bold text-sm">Segnala un problema</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}
