import { supabase } from './supabaseClient.js';

export async function api(url, options = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Your session has ended. Please sign in again.');

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401 || response.status === 403) {
    await supabase.auth.signOut();
    throw new Error('Your session has ended. Please sign in again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || Object.values(body.errors || {})[0] || 'Request failed');
  }
  return response.headers.get('content-type')?.includes('json') ? response.json() : response;
}

export async function downloadApi(url, filename) {
  const response = await api(url);
  const blobUrl = URL.createObjectURL(await response.blob());
  const link = Object.assign(document.createElement('a'), { href: blobUrl, download: filename });
  link.click();
  URL.revokeObjectURL(blobUrl);
}
