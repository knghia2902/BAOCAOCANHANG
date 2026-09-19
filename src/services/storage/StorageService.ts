import { supabase } from '@/supabase';

export const StorageService = {
    BUCKET_NAME: 'portfolio-assets',

    /**
     * Upload an image to Supabase Storage and return the public URL
     */
    async uploadImage(file: File, folder: string = 'general'): Promise<string | null> {
        try {
            const MAX_SIZE = 5 * 1024 * 1024; // 5MB
            const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

            if (file.size > MAX_SIZE) {
                console.error('File too large. Maximum size is 5MB.');
                throw new Error('File too large. Maximum size is 5MB.');
            }
            if (!ALLOWED_MIME.includes(file.type)) {
                console.error('Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.');
                throw new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.');
            }
            const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
            if (!ALLOWED_EXT.includes(fileExt)) {
                console.error('Invalid file extension. Only jpg, jpeg, png, webp, and gif are allowed.');
                throw new Error('Invalid file extension. Only jpg, jpeg, png, webp, and gif are allowed.');
            }

            // Create a unique file name
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
            const filePath = `${folder}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(this.BUCKET_NAME)
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: publicUrlData } = supabase.storage
                .from(this.BUCKET_NAME)
                .getPublicUrl(filePath);

            if (publicUrlData && publicUrlData.publicUrl) {
                return publicUrlData.publicUrl;
            }
            return null;
        } catch (error) {
            console.error('Error uploading image to storage:', error);
            return null;
        }
    },

    /**
     * Upload base64 image (used for backward compatibility or quick conversion)
     */
    async uploadBase64(base64: string, folder: string = 'general'): Promise<string | null> {
        try {
            // Convert base64 to Blob
            const response = await fetch(base64);
            const blob = await response.blob();

            // Generate a fake file object
            const file = new File([blob], 'image.png', { type: blob.type });
            return await this.uploadImage(file, folder);
        } catch (error) {
            console.error('Error uploading base64 to storage:', error);
            return null;
        }
    },

    /**
     * Delete an image from storage
     */
    async deleteImage(url: string): Promise<boolean> {
        try {
            // Extract path from URL
            const urlParts = url.split(`${this.BUCKET_NAME}/`);
            if (urlParts.length < 2) return false;

            const filePath = urlParts[1];
            if (!filePath) return false;

            const { error } = await supabase.storage
                .from(this.BUCKET_NAME)
                .remove([filePath]);

            return !error;
        } catch (error) {
            console.error('Error deleting image from storage:', error);
            return false;
        }
    }
};
