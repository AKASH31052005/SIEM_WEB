import axios from "axios";

const stripTrailingSlash = (value) => value.replace(/\/+$/, "");

function getDefaultBaseUrl() {
    if (typeof window !== "undefined" && window.location?.hostname) {
        return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return "http://localhost:5000";
}

const defaultBase = getDefaultBaseUrl();

export const API_BASE_URL = stripTrailingSlash(process.env.REACT_APP_API_URL || defaultBase);
export const SOCKET_URL = stripTrailingSlash(process.env.REACT_APP_SOCKET_URL || API_BASE_URL);

const API = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000
});

export default API;
