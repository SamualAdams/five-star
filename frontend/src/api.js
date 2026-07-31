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

export async function requestPasswordReset(email) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token, password) {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
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

export async function updateOrganization(token, orgId, data) {
  return request(`/organizations/${orgId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function updateOrgReviewLinks(token, orgId, reviewLinks) {
  return request(`/organizations/${orgId}/review-links`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ review_links: reviewLinks }),
  });
}

export async function deleteOrganization(token, orgId) {
  return request(`/organizations/${orgId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

// Social connections

export async function listSocialConnections(token, orgId) {
  return request(`/organizations/${orgId}/social-connections`, {
    headers: authHeaders(token),
  });
}

export async function beginSocialConnection(token, orgId, provider) {
  return request(`/organizations/${orgId}/social-connections/${provider}/authorize`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function disconnectSocialConnection(token, orgId, provider) {
  return request(`/organizations/${orgId}/social-connections/${provider}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function getFacebookPageOptions(token, orgId, setupToken) {
  return request(
    `/organizations/${orgId}/social-connections/facebook/options?setup=${encodeURIComponent(setupToken)}`,
    { headers: authHeaders(token) }
  );
}

export async function completeFacebookConnection(token, orgId, setupToken, pageId) {
  return request(`/organizations/${orgId}/social-connections/facebook/complete`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ setup_token: setupToken, page_id: pageId }),
  });
}

export async function listSocialPosts(token, orgId, limit = 25) {
  return request(`/organizations/${orgId}/social-posts?limit=${limit}`, {
    headers: authHeaders(token),
  });
}

export async function generateSocialDrafts(token, orgId, masterCaption) {
  return request(`/organizations/${orgId}/social-posts/drafts/generate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ master_caption: masterCaption }),
  });
}

export async function createSocialPost(token, orgId, data) {
  return request(`/organizations/${orgId}/social-posts`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function publishSocialPost(token, orgId, postId) {
  return request(`/organizations/${orgId}/social-posts/${postId}/publish`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

// Locations

export async function listLocations(token, orgId) {
  return request(`/organizations/${orgId}/locations`, {
    headers: authHeaders(token),
  });
}

export async function createLocation(token, orgId, data) {
  return request(`/organizations/${orgId}/locations`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function updateLocation(token, orgId, locationId, data) {
  return request(`/organizations/${orgId}/locations/${locationId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function deleteLocation(token, orgId, locationId) {
  return request(`/organizations/${orgId}/locations/${locationId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function updateLocationReviewLinks(token, orgId, locationId, reviewLinks) {
  return request(`/organizations/${orgId}/locations/${locationId}/review-links`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ review_links: reviewLinks }),
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

export async function updateMemberLocationAssignments(token, orgId, userId, assignments) {
  return request(`/organizations/${orgId}/members/${userId}/locations`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ assignments }),
  });
}

// Invites

export async function createInvite(token, orgId, role, expiresInHours = 168, locationId = null) {
  return request(`/organizations/${orgId}/invites`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      role,
      expires_in_hours: expiresInHours,
      location_id: locationId,
    }),
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

export async function polishReview(feedbackToken, content, style) {
  return request(`/api/feedback/${feedbackToken}/polish`, {
    method: "POST",
    body: JSON.stringify({ content, style }),
  });
}

// Future: Admin feedback list
export async function listOrganizationFeedback(token, orgId, locationId = null) {
  const params = new URLSearchParams();
  if (locationId) params.set("location_id", locationId);
  return request(`/organizations/${orgId}/feedback${params.size ? `?${params}` : ""}`, {
    headers: authHeaders(token),
  });
}

// Organization voting board

export async function listOrganizationInitiatives(token, orgId, locationId = null) {
  const params = new URLSearchParams();
  if (locationId) params.set("location_id", locationId);
  return request(`/organizations/${orgId}/initiatives${params.size ? `?${params}` : ""}`, {
    headers: authHeaders(token),
  });
}

export async function createOrganizationInitiative(token, orgId, data) {
  return request(`/organizations/${orgId}/initiatives`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function updateOrganizationInitiative(token, orgId, initiativeId, data) {
  return request(`/organizations/${orgId}/initiatives/${initiativeId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
}

export async function deleteOrganizationInitiative(token, orgId, initiativeId) {
  return request(`/organizations/${orgId}/initiatives/${initiativeId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function getPublicBoard(feedbackToken, { query = "", status = "", sort = "top", visitorId } = {}) {
  const params = new URLSearchParams({ sort });
  if (query.trim()) params.set("q", query.trim());
  if (status) params.set("status", status);
  return request(`/api/boards/${feedbackToken}?${params.toString()}`, {
    headers: visitorId ? { "X-Visitor-ID": visitorId } : {},
  });
}

export async function updatePublicInitiativeVote(feedbackToken, initiativeId, value, visitorId) {
  return request(`/api/boards/${feedbackToken}/initiatives/${initiativeId}/vote`, {
    method: "PUT",
    headers: { "X-Visitor-ID": visitorId },
    body: JSON.stringify({ value }),
  });
}

// Feedback Stats

export async function getFeedbackStats(token, orgId, days = 7, locationId = null) {
  const params = new URLSearchParams({ days: String(days) });
  if (locationId) params.set("location_id", locationId);
  return request(`/organizations/${orgId}/feedback/stats?${params}`, {
    headers: authHeaders(token),
  });
}

// Digests

export async function generateDigest(token, orgId, periodStart, periodEnd, locationId = null) {
  return request(`/organizations/${orgId}/digests/generate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ period_start: periodStart, period_end: periodEnd, location_id: locationId }),
  });
}

export async function listDigests(token, orgId, locationId = null) {
  const params = new URLSearchParams();
  if (locationId) params.set("location_id", locationId);
  return request(`/organizations/${orgId}/digests${params.size ? `?${params}` : ""}`, {
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
