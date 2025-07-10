import axios from './axios';

export const login = (credentials) =>
    axios.post('/auth/login', credentials);

export const register = (data) =>
    axios.post('/auth/register', data);

// export const logout = () =>
//   axios.post('/auth/logout');
