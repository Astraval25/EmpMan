import { getAuthHeaders, httpClient } from "./httpClient"

export const adminLogin = async (payload) => {
  const { data } = await httpClient.post("/admin/login", payload)
  return data
}

export const adminRegister = async (payload) => {
  const { data } = await httpClient.post("/admin/register", payload)
  return data
}

export const fetchUsers = async (token) => {
  const { data } = await httpClient.get("/admin/users", {
    headers: getAuthHeaders(token),
  })
  return data
}

export const createUser = async (token, payload) => {
  const { data } = await httpClient.post("/admin/users", payload, {
    headers: getAuthHeaders(token),
  })
  return data
}

export const fetchUserLogs = async (token, username) => {
  const { data } = await httpClient.get(`/admin/users/${username}/logs`, {
    headers: getAuthHeaders(token),
  })
  return data
}

export const fetchUserAnalytics = async (token, username) => {
  const { data } = await httpClient.get(`/admin/users/${username}/analytics`, {
    headers: getAuthHeaders(token),
  })
  return data
}
