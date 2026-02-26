import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../utils/supabase';

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
     * Generic upload helper using FileSystem and Base64 (Most Robust for Expo)
     */
    private async uploadFile(bucket: string, fileName: string, uri: string): Promise<string | null> {
        try {
            console.log(`Uploading to bucket: ${bucket}, path: ${fileName}`);

            // 1. Read file as Base64 string using Expo FileSystem
            const base64 = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64',
            });

            // 2. Convert Base64 to ArrayBuffer
            const arrayBuffer = decode(base64);

            console.log(`[DEBUG] StorageService: Base64 read success. Buffer size: ${arrayBuffer.byteLength}`);

            if (arrayBuffer.byteLength < 100) {
                throw new Error(`File vuoto o non valido (size: ${arrayBuffer.byteLength}).`);
            }

            // 3. Upload ArrayBuffer to Supabase
            const { data, error } = await supabase.storage
                .from(bucket)
                .upload(fileName, arrayBuffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

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
