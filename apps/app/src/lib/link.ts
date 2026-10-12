import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { api } from './api';

/**
 * Opens Finverse Link. On web the page navigates away and comes back to /linked;
 * on a phone it opens an in-app browser and resolves with the result.
 */
export async function startBankLink(): Promise<'ok' | 'error' | 'cancelled' | 'redirected'> {
  const returnTo = Platform.OS === 'web' ? `${window.location.origin}/linked` : Linking.createURL('linked');
  const { linkUrl } = await api<{ linkUrl: string }>('/link/token', {
    method: 'POST',
    body: JSON.stringify({ returnTo }),
  });

  if (Platform.OS === 'web') {
    window.location.assign(linkUrl);
    return 'redirected';
  }

  const result = await WebBrowser.openAuthSessionAsync(linkUrl, returnTo);
  if (result.type !== 'success') return 'cancelled';
  return Linking.parse(result.url).queryParams?.status === 'ok' ? 'ok' : 'error';
}
