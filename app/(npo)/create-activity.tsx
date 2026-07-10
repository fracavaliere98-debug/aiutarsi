import { useState, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ActivityForm, ActivityFormValues } from "../../components/npo/ActivityForm";
import { countActiveUrgentActivities, isStartInPast, parseDateTimeOrNull } from "../../components/npo/activityFormLogic";
import { useCreateActivityMutation } from "../../hooks/activities/mutations";
import { useActivitiesListQuery } from "../../hooks/activities/queries";

const BLANK: ActivityFormValues = {
    title: "",
    category: "Sociale",
    address: "",
    lat: 45.464,
    lng: 9.190,
    date: "",
    slots: "10",
    description: "",
    startTime: "10:00",
    endTime: "12:00",
    isUrgent: false,
    skills: [],
    imageUrl: undefined,
    recurrence: "NONE",
};

export default function CreateActivityScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { user } = useAuth();
    const { showToast } = useToast();
    const { data: activities = [] } = useActivitiesListQuery(user?.id);
    const createActivityMutation = useCreateActivityMutation();

    const [initialValues, setInitialValues] = useState<ActivityFormValues>(BLANK);
    const [resetKey, setResetKey] = useState("blank");

    // Precompila da duplicazione o bozza AI (stessa logica di prima, ora produce solo initialValues).
    useEffect(() => {
        if (params.duplicate) {
            const original = activities.find((a) => a.id === params.duplicate);
            if (original) {
                setInitialValues({
                    ...BLANK,
                    title: params.recurrence === "true" ? `${original.title} (Ricorrente)` : original.title,
                    category: original.category,
                    address: original.location.address,
                    lat: original.location.coords.lat,
                    lng: original.location.coords.lng,
                    slots: original.slots.toString(),
                    description: original.description || "",
                    skills: original.skills,
                    imageUrl: original.imageUrl,
                });
                setResetKey(`duplicate-${original.id}`);
            }
        } else if (params.ai_draft === "true") {
            const successful = activities
                .filter((a) => a.npoId === user?.id && (a.status === "COMPLETATA" || a.iscritti.length >= a.slots))
                .sort((a, b) => b.iscritti.length - a.iscritti.length);

            if (successful.length > 0) {
                const best = successful[0];
                setInitialValues({
                    ...BLANK,
                    title: `${best.category} Live: ${best.title}`,
                    category: best.category,
                    description: `Visto il grande successo della nostra ultima attività di ${best.category.toLowerCase()}, torniamo con una nuova data! \n\n${best.description}`,
                    skills: best.skills,
                    slots: best.slots.toString(),
                    address: best.location.address,
                    lat: best.location.coords.lat,
                    lng: best.location.coords.lng,
                });
            } else {
                setInitialValues({
                    ...BLANK,
                    title: "Nuova Iniziativa Solidale",
                    description: "Stiamo pianificando la nostra prossima grande attività. Unisciti a noi per fare la differenza!",
                });
            }
            setResetKey("ai-draft");
        }
    }, [params.duplicate, params.ai_draft, params.recurrence, activities, user]);

    const urgentCount = countActiveUrgentActivities(activities, user?.id);

    const handleSubmit = async (values: ActivityFormValues) => {
        const start = parseDateTimeOrNull(values.date, values.startTime);
        const end = parseDateTimeOrNull(values.date, values.endTime);
        if (!start || !end) {
            showToast("error", "Data o orario non validi. Controlla i campi.");
            return;
        }
        if (isStartInPast(start)) {
            showToast("error", "Non puoi creare un'attività nel passato. Scegli data e orario futuri.");
            return;
        }
        if (!user || user.role !== "NPO") {
            showToast("error", "Profilo ente non valido per creare attività.");
            return;
        }
        try {
            await createActivityMutation.mutateAsync({
                npoId: user.id,
                npoName: user.npoName || "Ente Solidale",
                title: values.title,
                category: values.category,
                location: { coords: { lat: values.lat, lng: values.lng }, address: values.address },
                slots: parseInt(values.slots, 10),
                description: values.description,
                dateTime: start.toISOString(),
                endDateTime: end.toISOString(),
                skills: values.skills,
                status: "APERTA",
                iscritti: [],
                isUrgent: values.isUrgent,
                imageUrl: values.imageUrl,
                recurrence: values.recurrence === "NONE" ? undefined : values.recurrence,
            });
            router.replace("/(npo)" as any);
        } catch {
            showToast("error", "Non sono riuscita a creare l'attività. Riprova.");
        }
    };

    return (
        <ActivityForm
            mode="create"
            headerLabel="Inizia ora"
            headerTitle="Crea Attività"
            onBack={() => router.back()}
            initialValues={initialValues}
            resetKey={resetKey}
            onSubmit={handleSubmit}
            submitLabel="Pubblica Attività"
            isSubmitting={createActivityMutation.isPending}
            canEnableUrgent={() => urgentCount < 3}
            autoCurateOnLoad={params.ai_draft === "true"}
        />
    );
}
