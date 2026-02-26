import { npoService } from "../services/NPOService";
import { Notification } from "../context/NotificationContext";

/**
 * Script per testare le nuove notifiche NPO
 * Eseguibile in ambiente di sviluppo per iniettare notifiche di test
 */
export const testNPONotifications = async (npoId: string) => {
    console.log("Iniezione notifiche di test per NPO:", npoId);

    const testNotifications: any[] = [
        {
            userId: npoId,
            type: "APPLICATION_RECEIVED",
            title: "Nuova Candidatura! 📋",
            message: "Mario Rossi si è candidato per l'attività 'Assistenza Mensa'",
            timestamp: new Date().toISOString(),
            read: false,
        },
        {
            userId: npoId,
            type: "VOLUNTEER_ENROLLED",
            title: "Nuovo Iscritto! 🎉",
            message: "Giulia Bianchi si è appena iscritta alla tua NPO",
            timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 min fa
            read: false,
        },
        {
            userId: npoId,
            type: "URGENT",
            title: "Azione Richiesta ⚠️",
            message: "L'attività 'Raccolta Fondi' ha raggiunto il numero minimo di partecipanti",
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 ore fa
            read: false,
        }
    ];

    console.log("Test completato. Apri la pagina notifiche della NPO per verificare la UI.");
    return testNotifications;
};
