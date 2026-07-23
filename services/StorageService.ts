import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../utils/supabase';
import { withTimeout } from '../utils/withTimeout';

export class StorageService {
    /**
     * Uploads a user avatar to the 'avatars' bucket
     */
    async uploadAvatar(userId: string, uri: string): Promise<string | null> {
        const timestamp = Date.now();
        const fileName = `${userId}/avatar_${timestamp}.jpg`;
        return this.uploadFile('avatars', fileName, uri);
    }

    /**
     * Uploads an activity photo to the 'activities' bucket
     */
    async uploadActivityImage(activityId: string, uri: string): Promise<string | null> {
        const timestamp = Date.now();
        const fileName = `${activityId}/photo_${timestamp}.jpg`;
        return this.uploadFile('activities', fileName, uri);
    }

    /**
     * Uploads a verification document to the 'verification_docs' bucket
     */
    async uploadVerificationDoc(userId: string, uri: string, extension: string = 'pdf'): Promise<string | null> {
        const timestamp = Date.now();
        const fileName = `${userId}/doc_${timestamp}.${extension}`;
        // Note: Assumes 'verification_docs' bucket exists
        return this.uploadFile('verification_docs', fileName, uri, extension === 'pdf' ? 'application/pdf' : 'image/jpeg');
    }

    /**
     * Uploads a community post image
     */
    async uploadCommunityImage(userId: string, uri: string): Promise<string | null> {
        const timestamp = Date.now();
        const fileName = `${userId}/${timestamp}.jpg`;
        return this.uploadFile('community_media', fileName, uri);
    }

    /**
     * Uploads multiple community post images concurrently
     */
    async uploadCommunityImages(userId: string, uris: string[]): Promise<string[]> {
        const timestamp = Date.now();
        const uploadPromises = uris.map((uri, index) => {
            const fileName = `${userId}/${timestamp}_${index}.jpg`;
            return this.uploadFile('community_media', fileName, uri);
        });
        const results = await Promise.all(uploadPromises);
        return results.filter((url): url is string => url !== null);
    }

    /**
     * Uploads a story image
     */
    async uploadStoryImage(userId: string, uri: string): Promise<string | null> {
        const timestamp = Date.now();
        const fileName = `stories/${userId}/${timestamp}.jpg`;
        return this.uploadFile('community_media', fileName, uri);
    }

    /**
     * Generic upload helper using FileSystem and Base64 (Most Robust for Expo)
     */
    private async uploadFile(bucket: string, fileName: string, uri: string, contentType: string = 'image/jpeg'): Promise<string | null> {
        try {
            console.log(`Uploading to bucket: ${bucket}, path: ${fileName}`);

            // 1. Read file as Base64 string using Expo FileSystem
            // Con timeout: senza, un problema di I/O silenzioso lascerebbe il chiamante
            // (es. il pulsante "Salva Modifiche" del profilo) bloccato in caricamento
            // a tempo indefinito, senza nessun errore mostrato all'utente.
            const base64 = await withTimeout(
                FileSystem.readAsStringAsync(uri, { encoding: 'base64' }),
                `${bucket}: lettura file`,
                15000
            );

            // 2. Convert Base64 to ArrayBuffer
            const arrayBuffer = decode(base64);

            console.log(`[DEBUG] StorageService: Base64 read success. Buffer size: ${arrayBuffer.byteLength}`);

            if (arrayBuffer.byteLength < 100) {
                throw new Error(`File vuoto o non valido (size: ${arrayBuffer.byteLength}).`);
            }

            // 3. Upload ArrayBuffer to Supabase
            const { data, error } = await withTimeout(
                supabase.storage.from(bucket).upload(fileName, arrayBuffer, {
                    contentType: contentType,
                    upsert: true
                }),
                `${bucket}: upload`,
                25000
            );

            if (error || !data) {
                console.error("Supabase Storage error details:", JSON.stringify(error, null, 2));
                throw error || new Error("Upload returned no data");
            }

            // 4. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error: any) {
            console.error(`Storage Upload Error [${bucket}]:`, error);
            throw new Error(`Upload fallito su ${bucket}: ${error.message}`);
        }
    }
}

export const storageService = new StorageService();
