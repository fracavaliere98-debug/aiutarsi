import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert } from "react-native";
import { ActivityForm, ActivityFormValues } from "../../../components/npo/ActivityForm";
import { countActiveUrgentActivities, wasFutureActivityMovedToPast } from "../../../components/npo/activityFormLogic";
import { useActivitiesListQuery, useActivityDetailQuery } from "../../../hooks/activities/queries";
import { useDeleteActivityMutation, useUpdateActivityMutation } from "../../../hooks/activities/mutations";

export default function EditActivityScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const activityId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : "";
    const { data: activity } = useActivityDetailQuery(activityId);
    const { data: activities = [] } = useActivitiesListQuery(activity?.npoId);
    const updateActivityMutation = useUpdateActivityMutation();
    const deleteActivityMutation = useDeleteActivityMutation();

    const initialValues: ActivityFormValues = activity
        ? {
              title: activity.title,
              category: activity.category,
              address: activity.location.address,
              lat: activity.location.coords.lat,
              lng: activity.location.coords.lng,
              date: activity.dateTime.split("T")[0],
              slots: activity.slots.toString(),
              description: activity.description,
              startTime: new Date(activity.dateTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
              endTime: new Date(activity.endDateTime).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
              isUrgent: activity.isUrgent || false,
              skills: activity.skills || [],
              imageUrl: activity.imageUrl,
              recurrence: (activity.recurrence as any) || "NONE",
          }
        : ({} as ActivityFormValues); // non usato: isLoading=true finché activity non arriva

    const handleSubmit = async (values: ActivityFormValues) => {
        if (!activity) return;
        const startISO = `${values.date}T${values.startTime}:00Z`;
        const endISO = `${values.date}T${values.endTime}:00Z`;
        if (wasFutureActivityMovedToPast(activity.dateTime, startISO)) {
            Alert.alert("Errore", "Non puoi spostare un'attività futura nel passato.");
            return;
        }
        try {
            await updateActivityMutation.mutateAsync({
                ...activity,
                title: values.title,
                category: values.category,
                location: { coords: { lat: values.lat, lng: values.lng }, address: values.address },
                slots: parseInt(values.slots, 10),
                description: values.description,
                dateTime: startISO,
                endDateTime: endISO,
                skills: values.skills,
                isUrgent: values.isUrgent,
                imageUrl: values.imageUrl,
                recurrence: values.recurrence === "NONE" ? undefined : values.recurrence,
            });
            Alert.alert("Successo", "Attività aggiornata con successo! I volontari iscritti riceveranno una notifica.");
            router.back();
        } catch {
            Alert.alert("Errore", "Non sono riuscita ad aggiornare l'attività. Riprova.");
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Elimina Attività",
            "Sei sicuro di voler eliminare questa attività? Verrà spostata nello stato 'Cancellata' e i volontari iscritti riceveranno una notifica.",
            [
                { text: "Annulla", style: "cancel" },
                {
                    text: "Elimina",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteActivityMutation.mutateAsync(activityId);
                            router.back();
                        } catch {
                            Alert.alert("Errore", "Non sono riuscita a eliminare l'attività. Riprova.");
                        }
                    },
                },
            ]
        );
    };

    const otherUrgentCount = countActiveUrgentActivities(activities, activity?.npoId, activityId);

    return (
        <ActivityForm
            mode="edit"
            headerLabel="Gestione"
            headerTitle="Modifica Attività"
            onBack={() => router.back()}
            initialValues={initialValues}
            resetKey={activity?.id ?? "loading"}
            isLoading={!activity}
            onSubmit={handleSubmit}
            submitLabel="Salva Modifiche"
            isSubmitting={updateActivityMutation.isPending}
            canEnableUrgent={() => otherUrgentCount < 3}
            onDelete={handleDelete}
        />
    );
}
