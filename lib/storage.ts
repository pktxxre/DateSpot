import { supabase } from './supabase';

const BUCKET = 'photos';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// Upload a local file URI to Supabase Storage and return the public URL.
// Uses FormData (the React Native-correct approach) — fetch→blob produces 0-byte files.
export async function uploadPhoto(localUri: string, storagePath: string): Promise<string | null> {
  if (!supabase || !SUPABASE_URL) return null;
  try {
    const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const filename = localUri.split('/').pop() ?? `photo.${ext}`;

    const formData = new FormData();
    formData.append('file', { uri: localUri, name: filename, type: contentType } as any);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const response = await fetch(
      `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'true',
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('Supabase upload error:', response.status, text);
      return null;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  } catch (e) {
    console.error('uploadPhoto failed:', e);
    return null;
  }
}

// Delete a photo from Supabase Storage by its public URL.
export async function deletePhoto(publicUrl: string): Promise<void> {
  if (!supabase) return;
  try {
    const urlObj = new URL(publicUrl);
    // path after /object/public/<bucket>/
    const parts = urlObj.pathname.split(`/object/public/${BUCKET}/`);
    if (parts.length < 2) return;
    await supabase.storage.from(BUCKET).remove([parts[1]]);
  } catch (e) {
    console.error('deletePhoto failed:', e);
  }
}
