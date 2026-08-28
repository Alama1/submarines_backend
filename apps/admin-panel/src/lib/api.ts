import axios from 'axios';
import { auth } from './firebase';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

// Request interceptor: attach Firebase ID Token or Admin API Key
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    } catch {
      // ignore
    }
  }

  // Optional plugin/dev key — never fall back to a hardcoded production default
  const storedKey = localStorage.getItem('admin_api_key') || import.meta.env.VITE_ADMIN_API_KEY;
  if (storedKey) {
    config.headers['x-api-key'] = storedKey;
  }

  return config;
});

// Response interceptor: handle 401/403 errors
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      console.warn('Unauthorized request to API');
    }
    return Promise.reject(err);
  }
);
