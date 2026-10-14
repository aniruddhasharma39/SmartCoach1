import { API_URL } from './config';
import { toast } from './context/ToastContext';

export const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

export const authHeaders = (contentType: boolean = false): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

// Dispatch session expired event and clear local state
export const triggerSessionExpired = (message: string = 'Your session has expired. Please log in again.') => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.dispatchEvent(new CustomEvent('auth:expired', { detail: { message } }));
  toast.warning(message, 'Session Expired');
};

// Global fetch interceptor to catch any 401s from the backend across all modules
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
    // Do not trigger session expired on standard failed login/register credential errors
    const isAuthRoute =
      url.includes('/api/v1/auth/login') ||
      url.includes('/api/v1/auth/otp/verify') ||
      url.includes('/api/v1/auth/register');

    if (!isAuthRoute) {
      triggerSessionExpired();
    }
  }
  return response;
};

export { API_URL };
