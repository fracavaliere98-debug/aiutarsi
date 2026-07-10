import * as FileSystem from 'expo-file-system/legacy';

/**
 * Moves a file from a temporary location (e.g. cache) to the app's permanent document storage.
 * This ensures files persist across app restarts and cache clearing.
 * 
 * @param uri The source URI of the file (e.g. from ImagePicker)
 * @returns The new permanent URI, or the original URI if operation fails
 */
export const saveImageToPermanentStorage = async (uri: string): Promise<string> => {
    try {
        // Validation
        if (!uri) return uri;

        // If it's a remote URL (http/https), return as is
        if (uri.startsWith('http')) return uri;

        // Check if FileSystem is available (vital for Web support checks)
        if (!FileSystem || !('documentDirectory' in FileSystem) || !FileSystem.documentDirectory) {
            console.warn("FileSystem.documentDirectory is not available.");
            return uri;
        }

        // If it's already in documentDirectory, return it to avoid duplication
        if (uri.includes(FileSystem.documentDirectory as string)) {
            // console.log("[FileStorage] Image is already in permanent storage.");
            return uri;
        }

        // Generate unique filename to prevent collisions
        const extension = uri.split('.').pop() || 'jpg';
        const filename = `avatar_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
        const newPath = (FileSystem.documentDirectory as string) + filename;

        // Copy file
        // console.log(`[FileStorage] Copying from ${uri} to ${newPath}`);
        await FileSystem.copyAsync({
            from: uri,
            to: newPath
        });

        return newPath;
    } catch (error) {
        console.error("[FileStorage] Error saving image to permanent storage:", error);
        return uri; // Fallback to original URI
    }
};
