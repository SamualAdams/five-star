# Implementation Plan: Multi-Organization Management with Role-Based Access

## Context

This change implements the complete user workflow shown in the diagram: after creating a personal account and logging in, users can create organizations, invite others via shareable links, and manage team members with role-based permissions (admin/viewer). Users can belong to multiple organizations with different roles in each.

**Current State:**
- Basic authentication exists (signup, login with JWT tokens)
- Single `User` model with email and password
- Simple React frontend with auth forms
- No organization or team management features

**User Requirements:**
- Organizations created as separate step after login (not during signup)
- Two roles: **admin** (can manage org, invite users, assign roles) and **viewer** (read-only access)
- Shareable invite links (no email system needed initially)
- Multi-org membership: users can join multiple organizations with different roles per org

---

## Database Schema Changes

### New Models

#### 1. **Role Enum**
```python
class Role(str, enum.Enum):
    ADMIN = "admin"
    VIEWER = "viewer"
```

#### 2. **Organization Model**
- `id` (primary key)
- `name` (string, required)
- `created_at` (timestamp)
- `created_by` (foreign key to users.id)
- Relationships: `members` (list of OrganizationMember), `invites` (list of Invite), `creator` (User)

#### 3. **OrganizationMember Model** (junction table)
- `id` (primary key)
- `user_id` (foreign key to users.id)
- `organization_id` (foreign key to organizations.id)
- `role` (Role enum: admin or viewer)
- `joined_at` (timestamp)
- **UniqueConstraint** on (user_id, organization_id) - prevents duplicate memberships
- Relationships: `user` (User), `organization` (Organization)

#### 4. **Invite Model**
- `id` (primary key)
- `organization_id` (foreign key to organizations.id)
- `token` (string, unique, indexed) - cryptographically secure URL-safe token
- `role` (Role enum: admin or viewer) - role assigned when invite is accepted
- `created_by` (foreign key to users.id)
- `created_at` (timestamp)
- `expires_at` (timestamp) - default 7 days from creation
- `used_at` (timestamp, nullable) - marked when invite is accepted
- `used_by` (foreign key to users.id, nullable)
- Relationships: `organization` (Organization), `creator` (User), `user` (User)

#### 5. **User Model Updates**
- Add relationship: `memberships` (list of OrganizationMember)

**File:** `/Users/jon/Desktop/workbench/five-star/backend/app/models.py`

---

## Backend Implementation

### 1. Create Dependencies Module

**New File:** `/Users/jon/Desktop/workbench/five-star/backend/app/dependencies.py`

Reusable FastAPI dependencies for auth and authorization:

- `get_current_user(db, credentials)` - Extract user from JWT Bearer token
- `get_user_org_membership(db, user, org_id)` - Verify user is member of org (raises 404 if not)
- `require_org_admin(db, user, org_id)` - Verify user is admin of org (raises 403 if not)

These eliminate code duplication and enforce consistent authorization checks across all endpoints.

### 2. Add Invite Utilities

**File:** `/Users/jon/Desktop/workbench/five-star/backend/app/security.py`

Add helper functions:
- `generate_invite_token()` - Uses `secrets.token_urlsafe(32)` for cryptographically secure tokens
- `is_invite_valid(invite)` - Check if invite is not expired and not already used

### 3. Create Pydantic Schemas

**File:** `/Users/jon/Desktop/workbench/five-star/backend/app/schemas.py`

Add request/response schemas:
- `OrganizationCreate`, `OrganizationUpdate`, `OrganizationOut`
- `MemberOut`, `MemberUpdateRole`
- `InviteCreate`, `InviteOut`, `InviteAccept`
- Update `UserOut` to optionally include `organizations: list[OrganizationOut]`

### 4. API Endpoints

**File:** `/Users/jon/Desktop/workbench/five-star/backend/app/main.py`

#### Organization Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/organizations` | Create new organization, creator becomes admin | User |
| GET | `/organizations` | List user's organizations with their roles | User |
| GET | `/organizations/{org_id}` | Get organization details | Member |
| PATCH | `/organizations/{org_id}` | Update organization name | Admin |
| DELETE | `/organizations/{org_id}` | Delete organization and all related data | Admin |

#### Member Management Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/organizations/{org_id}/members` | List all members with roles | Member |
| PATCH | `/organizations/{org_id}/members/{user_id}` | Update member's role | Admin |
| DELETE | `/organizations/{org_id}/members/{user_id}` | Remove member from org | Admin or self |

**Protection:** Prevent removing/demoting the last admin (validate admin count > 1)

#### Invite Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/organizations/{org_id}/invites` | Generate shareable invite link | Admin |
| GET | `/organizations/{org_id}/invites` | List org's invites | Admin |
| GET | `/invites/{token}` | Get invite info (for preview page) | Public |
| POST | `/invites/accept` | Accept invite and join organization | User |

**Invite Flow:**
1. Admin creates invite with role (admin/viewer) and expiration (default 7 days)
2. Returns `invite_url` like `https://app.example.com/invite/{token}`
3. Recipient visits URL, sees org name and role
4. If not logged in: redirected to signup/login with invite token preserved
5. Once authenticated: clicks "Accept" to join org
6. Invite marked as `used_at` (single-use)

#### Update `/auth/me` Endpoint

Add optional query param `include_orgs=true` to return user's organizations in the response.

---

## Frontend Implementation

### 1. Install React Router

```bash
cd frontend && npm install react-router-dom
```

### 2. Update API Client

**File:** `/Users/jon/Desktop/workbench/five-star/frontend/src/api.js`

Add API functions for:
- Organizations: `createOrganization`, `listOrganizations`, `getOrganization`, `updateOrganization`, `deleteOrganization`
- Members: `listMembers`, `updateMemberRole`, `removeMember`
- Invites: `createInvite`, `listInvites`, `getInviteInfo`, `acceptInvite`

### 3. Refactor App.jsx with Routing

**File:** `/Users/jon/Desktop/workbench/five-star/frontend/src/App.jsx`

**Major Changes:**
- Add React Router with routes: `/`, `/dashboard`, `/invite/:token`, `/org/:id/settings`
- Add state management:
  - `organizations` - array of user's orgs with roles
  - `currentOrgId` - selected organization (persisted to localStorage)
- Load organizations after authentication
- Post-login flow:
  - If user has no orgs → show "Create your first organization" modal
  - If user has orgs → show dashboard with org switcher
  - Set first org as current by default

### 4. Create New Components

#### **OrganizationSwitcher Component**
- Dropdown showing user's organizations
- Displays: "{Org Name} ({role})"
- Saves selected org to localStorage as `currentOrgId`
- Shown in nav bar when authenticated

#### **CreateOrgModal Component**
- Modal with form: organization name input
- Calls `createOrganization` API
- Automatically sets new org as current org after creation

#### **InviteAcceptPage Component**
- Route: `/invite/:token`
- Fetches invite info (org name, role) via `getInviteInfo`
- If not authenticated: shows "Sign up to accept" button → redirects to signup with token in URL
- If authenticated: shows "Accept Invite" button → calls `acceptInvite` → redirects to dashboard
- Handles expired/invalid invites gracefully

#### **OrgSettingsPage Component**
- Route: `/org/:id/settings`
- Only accessible to org members
- Tabs or sections for:
  - Organization details (rename, delete)
  - Members list
  - Invite management

#### **MemberList Component**
- Table showing: email, role, joined date
- Actions (admin only):
  - Change role dropdown
  - Remove member button
- Shows user's own row differently
- Leave org button for self

#### **InviteList Component**
- Table showing: role, created date, expiration, status (active/used/expired)
- Generate new invite button (admin only)
- Copy invite URL to clipboard button
- Shows `invite_url` for each active invite

---

## Security Considerations

1. **Invite Token Security:**
   - Use `secrets.token_urlsafe(32)` for cryptographic randomness (43-character base64url string)
   - Store as unique indexed column for fast, safe lookup
   - Single-use: mark `used_at` when accepted
   - Time-limited: default 7 days, max 30 days

2. **Authorization Enforcement:**
   - All org endpoints verify user membership via `get_user_org_membership`
   - Admin-only actions use `require_org_admin` dependency
   - Prevent last admin removal (check admin count before changes)
   - Allow self-removal for any member

3. **Database Integrity:**
   - UniqueConstraint on (user_id, organization_id) prevents duplicate memberships
   - Cascade deletes: removing org deletes all members and invites
   - Foreign key constraints ensure referential integrity

4. **Token Validation:**
   - Check `expires_at > now()` before accepting invite
   - Check `used_at is None` before accepting invite
   - Return `410 Gone` for expired/used invites

---

## Migration Strategy

Since the app uses `Base.metadata.create_all()` on startup (no Alembic migrations):

**For Development (Recommended):**
1. Stop application
2. Drop database: `docker-compose down -v`
3. Add new models to `models.py`
4. Start application: `docker-compose up -d`
5. Tables created automatically with all relationships

**For Production (if existing users):**
- Option A: Require users to manually create orgs after migration
- Option B: Run script to auto-create one org per existing user with user as admin

---

## Implementation Sequence

### Phase 1: Backend Data Layer
1. Update `/Users/jon/Desktop/workbench/five-star/backend/app/models.py`
   - Add Role enum
   - Add Organization, OrganizationMember, Invite models
   - Add relationships to User
2. Update `/Users/jon/Desktop/workbench/five-star/backend/app/schemas.py`
   - Add all request/response schemas
3. Test: Drop DB and restart to verify table creation

### Phase 2: Backend Dependencies
1. Create `/Users/jon/Desktop/workbench/five-star/backend/app/dependencies.py`
   - Add `get_current_user`, `get_user_org_membership`, `require_org_admin`
2. Update `/Users/jon/Desktop/workbench/five-star/backend/app/security.py`
   - Add `generate_invite_token()`, `is_invite_valid()`

### Phase 3: Backend Endpoints
1. Update `/Users/jon/Desktop/workbench/five-star/backend/app/main.py`
   - Add organization CRUD endpoints (5 endpoints)
   - Add member management endpoints (3 endpoints)
   - Add invite endpoints (4 endpoints)
   - Update `/auth/me` to optionally include organizations
2. Test: Use curl/Postman to verify each endpoint

### Phase 4: Frontend API Client
1. Update `/Users/jon/Desktop/workbench/five-star/frontend/src/api.js`
   - Add 12+ new API functions for orgs, members, invites
2. Test: Call functions from browser console

### Phase 5: Frontend Routing and Components
1. Install react-router-dom: `cd frontend && npm install react-router-dom`
2. Refactor `/Users/jon/Desktop/workbench/five-star/frontend/src/App.jsx`
   - Add routing
   - Load organizations after auth
   - Handle "no orgs" state
3. Create components:
   - `OrganizationSwitcher.jsx`
   - `CreateOrgModal.jsx`
   - `InviteAcceptPage.jsx`
   - `OrgSettingsPage.jsx`
   - `MemberList.jsx`
   - `InviteList.jsx`
4. Add CSS for new components

### Phase 6: Testing and Polish
1. End-to-end test critical workflows:
   - New user → create org → generate invite
   - Second user → accept invite → join org
   - Admin → change member role → verify permissions
   - User → switch between multiple orgs
2. Add error handling and user feedback messages
3. Update README with new features

---

## Critical Files

**Backend:**
- `/Users/jon/Desktop/workbench/five-star/backend/app/models.py` - Core data models
- `/Users/jon/Desktop/workbench/five-star/backend/app/schemas.py` - API request/response schemas
- `/Users/jon/Desktop/workbench/five-star/backend/app/dependencies.py` - Auth/authz dependencies (NEW)
- `/Users/jon/Desktop/workbench/five-star/backend/app/security.py` - Invite token utilities
- `/Users/jon/Desktop/workbench/five-star/backend/app/main.py` - API endpoints

**Frontend:**
- `/Users/jon/Desktop/workbench/five-star/frontend/src/App.jsx` - Main app with routing
- `/Users/jon/Desktop/workbench/five-star/frontend/src/api.js` - API client
- `/Users/jon/Desktop/workbench/five-star/frontend/src/components/*` - New UI components (6 files)

---

## Verification

### Backend Verification
1. Start services: `docker-compose up -d`
2. Check tables created: `docker-compose exec db psql -U user -d five_star -c "\dt"`
   - Should see: users, organizations, organization_members, invites
3. Test organization creation:
   ```bash
   # Sign up
   TOKEN=$(curl -X POST http://localhost:8000/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}' | jq -r '.token.access_token')

   # Create org
   curl -X POST http://localhost:8000/organizations \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Org"}'
   ```
4. Test invite flow:
   ```bash
   # Create invite
   INVITE=$(curl -X POST http://localhost:8000/organizations/1/invites \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"role":"viewer"}' | jq -r '.token')

   # Get invite info (public)
   curl http://localhost:8000/invites/$INVITE

   # Accept invite (as different user)
   curl -X POST http://localhost:8000/invites/accept \
     -H "Authorization: Bearer $NEW_USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"token\":\"$INVITE\"}"
   ```

### Frontend Verification
1. Navigate to `http://localhost:5173`
2. **New User Flow:**
   - Sign up with email/password
   - After login, see "Create your first organization" modal
   - Create org → redirected to dashboard
   - See org switcher in nav bar
3. **Invite Flow:**
   - Go to org settings
   - Generate invite link as admin
   - Copy invite URL
   - Open in incognito window
   - Sign up → accept invite → join org
4. **Multi-Org Flow:**
   - Create second organization
   - Use org switcher to toggle between orgs
   - Verify different roles displayed per org
5. **Member Management:**
   - View members list in org settings
   - Change member role (admin → viewer)
   - Remove member
   - Leave organization

### Edge Cases to Test
- Prevent last admin removal (should show error)
- Prevent demoting last admin (should show error)
- Accept expired invite (should show "Invite expired")
- Accept already-used invite (should show "Invite already used")
- Join org you're already a member of (should show error)
- Delete organization (should cascade delete members and invites)

---

## Summary

This implementation adds complete multi-organization support with role-based access control and shareable invite links. The architecture follows the existing patterns (SQLAlchemy 2.0, FastAPI with Pydantic, React with hooks) and maintains clean separation of concerns with reusable dependencies for authorization. The invite system uses secure tokens and proper expiration handling, while the database schema ensures data integrity with constraints and cascade deletes.
