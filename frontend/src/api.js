const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.detail || "Request failed";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return payload;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

// Auth

export async function signup(email, password) {
  return request("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function me(token) {
  return request("/auth/me", {
    headers: authHeaders(token),
  });
}

// Organizations

export async function createOrganization(token, name) {
  return request("/organizations", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
}

export async function listOrganizations(token) {
  return request("/organizations", {
    headers: authHeaders(token),
  });
}

export async function getOrganization(token, orgId) {
  return request(`/organizations/${orgId}`, {
    headers: authHeaders(token),
  });
}

export async function updateOrganization(token, orgId, name) {
  return request(`/organizations/${orgId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
}

export async function deleteOrganization(token, orgId) {
  return request(`/organizations/${orgId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// Members

export async function listMembers(token, orgId) {
  return request(`/organizations/${orgId}/members`, {
    headers: authHeaders(token),
  });
}

export async function updateMemberRole(token, orgId, userId, role) {
  return request(`/organizations/${orgId}/members/${userId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ role }),
  });
}

export async function removeMember(token, orgId, userId) {
  return request(`/organizations/${orgId}/members/${userId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// Invites

export async function createInvite(token, orgId, role, expiresInHours = 168) {
  return request(`/organizations/${orgId}/invites`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ role, expires_in_hours: expiresInHours }),
  });
}

export async function listInvites(token, orgId) {
  return request(`/organizations/${orgId}/invites`, {
    headers: authHeaders(token),
  });
}

export async function getInviteInfo(inviteToken) {
  return request(`/invites/${inviteToken}`);
}

export async function acceptInvite(authToken, inviteToken) {
  return request("/invites/accept", {
    method: "POST",
    headers: authHeaders(authToken),
    body: JSON.stringify({ token: inviteToken }),
  });
}

// Organization Search (Public)

export async function searchOrganizations(query) {
  return request(`/organizations/search?q=${encodeURIComponent(query)}`);
}

// Feedback (Public)

export async function getFeedbackFormInfo(feedbackToken) {
  return request(`/api/feedback/${feedbackToken}`);
}

export async function submitFeedback(feedbackToken, content, submitterEmail = null, submitterName = null) {
  return request(`/api/feedback/${feedbackToken}/submit`, {
    method: "POST",
    body: JSON.stringify({
      content,
      submitter_email: submitterEmail || undefined,
      submitter_name: submitterName || undefined,
    }),
  });
}

// Future: Admin feedback list
export async function listOrganizationFeedback(token, orgId) {
  return request(`/organizations/${orgId}/feedback`, {
    headers: authHeaders(token),
  });
}

// Feedback Stats

export async function getFeedbackStats(token, orgId, days = 7) {
  return request(`/organizations/${orgId}/feedback/stats?days=${days}`, {
    headers: authHeaders(token),
  });
}

// Digests

export async function generateDigest(token, orgId, periodStart, periodEnd) {
  return request(`/organizations/${orgId}/digests/generate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ period_start: periodStart, period_end: periodEnd }),
  });
}

export async function listDigests(token, orgId) {
  return request(`/organizations/${orgId}/digests`, {
    headers: authHeaders(token),
  });
}

export async function getDigest(token, orgId, digestId) {
  return request(`/organizations/${orgId}/digests/${digestId}`, {
    headers: authHeaders(token),
  });
}

export async function updateDigest(token, orgId, digestId, patch) {
  return request(`/organizations/${orgId}/digests/${digestId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
}

export async function publishDigest(token, orgId, digestId) {
  return request(`/organizations/${orgId}/digests/${digestId}/publish`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function deleteDigest(token, orgId, digestId) {
  return request(`/organizations/${orgId}/digests/${digestId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
