import axios from 'axios';

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });

API.interceptors.request.use((req) => {
  const token = localStorage.getItem('auth_token');
  if (token) req.headers.Authorization = 'Bearer ' + token;
  return req;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      if (!window.location.pathname.startsWith('/guest')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default API;
