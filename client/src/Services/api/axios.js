import axios from 'axios';

// WILL be stored in env --> import.meta.env.API_BASE_URL
const API_BASE_URL = "http//localhost:5000"
const instance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default instance;
