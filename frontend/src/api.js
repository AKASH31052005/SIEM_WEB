import axios from "axios";

const stripTrailingSlash = (value) => value.replace(/\/+$/, "");
const defaultBase = "http://localhost:5000";

export const API_BASE_URL = stripTrailingSlash(process.env.REACT_APP_API_URL || defaultBase);
export const SOCKET_URL = stripTrailingSlash(process.env.REACT_APP_SOCKET_URL || API_BASE_URL);

const API = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000
});

export default API;
