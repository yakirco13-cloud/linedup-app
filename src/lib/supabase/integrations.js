import { supabase } from './client';

/**
 * File Storage operations
 */
export const Storage = {
  async uploadFile({ file }, bucket = 'uploads') {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return { file_url: publicUrl };
  },

  async deleteFile(filePath, bucket = 'uploads') {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);
    if (error) throw error;
    return { success: true };
  },
};

/**
 * Core integrations - compatible with base44.integrations.Core
 */
export const Core = {
  UploadFile: Storage.uploadFile.bind(Storage),
};

export const integrations = {
  Core,
  Storage,
};

export default integrations;
