import { ReactNode } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { Colors } from "../../constants/Colors";

interface AuthFieldProps extends TextInputProps {
    label: string;
    icon?: ReactNode;
}

export function AuthField({ label, icon, ...props }: AuthFieldProps) {
    return (
        <View style={styles.wrapper}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.inputWrap}>
                {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
                <TextInput
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    {...props}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 14,
    },
    label: {
        color: Colors.primary,
        fontSize: 13,
        fontWeight: "800",
        marginBottom: 8,
        marginLeft: 4,
    },
    inputWrap: {
        minHeight: 58,
        borderRadius: 22,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "rgba(70,34,130,0.08)",
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    iconWrap: {
        width: 22,
        alignItems: "center",
    },
    input: {
        flex: 1,
        color: Colors.primary,
        fontSize: 15,
        fontWeight: "600",
        paddingVertical: 16,
    },
});
