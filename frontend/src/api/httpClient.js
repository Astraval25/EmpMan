import axios from "axios"

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "/api").trim()

export const httpClient = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
})

export const getAuthHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
})
