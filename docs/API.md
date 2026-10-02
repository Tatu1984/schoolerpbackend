# School ERP API

Base URL: `<backend>/api/v1` (`/api` is the same API without the version prefix).

All responses are JSON: `{ "success": true, "data": ... }` or `{ "success": false, "error": "message", "details"?: {...} }`.
Authenticated calls send `Authorization: Bearer <accessToken>`. `401` means the token is missing or expired; `403` means the role is not allowed.

## Auth

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/auth/login` | none | `{ email, password }` | `{ user, accessToken, refreshToken, tokenType, expiresIn, refreshExpiresIn }` |
| POST | `/auth/refresh` | none | `{ refreshToken }` | same as login (new token pair) |
| GET | `/auth/me` | any | | user profile |
| POST | `/auth/change-password` | any | `{ currentPassword, newPassword }` | `{ message, user, accessToken, refreshToken, ... }` |
| POST | `/auth/logout-all` | any | | `{ message }` |
| GET | `/health` | none | | `{ status, database }` |

`user` is `{ id, email, name, firstName, lastName, phone, role, schoolId, schoolName, isActive, mustChangePassword }`.
Access tokens last 8 hours and refresh tokens 30 days by default (`ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_SECONDS`).

Rules clients must handle:

- **Rate limiting.** Five failed sign-ins for one email (or thirty from one IP) within 15 minutes lock further attempts for 15 minutes: `429` with a `Retry-After` header (seconds).
- **Temporary passwords.** When `user.mustChangePassword` is true, every call outside `/auth/*` returns `403` with `"code": "PASSWORD_CHANGE_REQUIRED"`. Send the user to a change-password screen and call `/auth/change-password`; use the token pair it returns.
- **Password policy.** At least 8 characters, with a letter and a number.
- **Revocation.** Changing a password, an administrator resetting it, `/auth/logout-all`, or deactivating the account invalidates every access and refresh token already issued. Treat `401` after a failed refresh as signed out.

`/account/change-password` is an alias of `/auth/change-password`.

Portal logins are created automatically when a student is admitted, with a temporary password that must be changed at first sign-in:
- student: date of birth as `DDMMYYYY`
- parent: email (or `<phone>@parent.school` if none was given), password is the 10-digit phone number

Staff can issue new temporary passwords for a student and their guardians with `POST /students/{id}/reset-login` (roles `SUPER_ADMIN`, `SCHOOL_ADMIN`, `PRINCIPAL`). The response lists each login and its temporary password once.

## Parent / student portal

Roles `PARENT` and `STUDENT` only.

### GET `/portal/data?studentId=<id>`

Everything the portal shows for one child. `studentId` is optional and only meaningful for parents with several children; an id that does not belong to the caller is ignored and the first child is returned.

```jsonc
{
  "role": "PARENT",
  "children": [{ "id", "firstName", "lastName", "admissionNumber", "rollNumber", "class": { "name" }, "section": { "name" } }],
  "student": { /* the selected child, same shape */ },
  "attendance": {
    "records": [{ "date", "status", "remarks" }],            // last 90 days; status PRESENT | ABSENT | LATE | LEAVE
    "summary": { "PRESENT", "ABSENT", "LATE", "LEAVE", "total", "percentage" }
  },
  "fees": {
    "items": [{ "id", "amount", "paidAmount", "dueDate", "status", "paymentDate", "receiptNumber", "fee": { "name", "type", "frequency" } }],
    "totalDue", "totalPaid"
  },
  "courses": [{ "id", "name", "code", "teacher": { "firstName", "lastName" } }],
  "assignments": [{ "id", "title", "description", "dueDate", "maxScore", "course": { "name" },
                    "submission": { "content", "score", "feedback", "submittedAt", "gradedAt" } /* or null */ }],
  "exams": [{ "id", "title", "examDate", "duration", "maxScore", "course": { "name" } }],   // upcoming only
  "examResults": [{ "id", "score", "remarks", "exam": { "title", "examDate", "maxScore", "course": { "name" } } }],
  "reportCards": [{ "id", "term", "grades", "overallScore", "remarks", "publishedAt", "academicYear": { "name" } }],
  "onlineClasses": [{ "id", "title", "scheduledTime", "duration", "status", "meetingLink", "recordingLink",
                      "course": { "name", "teacher": { "firstName", "lastName" } } }],  // last 30 days onward
  "announcements": [{ "id", "title", "content", "priority", "publishedAt", "createdAt" }]
}
```

If no student is linked to the login, `children` is `[]` and `student` is `null`.

### POST `/portal/submissions`

`STUDENT` only. Body `{ assignmentId, content }`. Creates or replaces the student's answer until it has been graded.

## Staff API

Used by the web dashboard; staff roles only. Resources follow the same conventions (`GET` list, `POST` create, `GET/PUT/DELETE /{id}`), with `?page=&limit=` (max 100) on paginated lists returning a `pagination` object.

`/students`, `/students/attendance`, `/staff`, `/classes`, `/sections`, `/subjects`, `/academic-years`, `/branches`, `/schools`, `/admissions/*`, `/fees`, `/finance/*`, `/lms/*` (courses, assignments, examinations, results, report-cards, classes = online classes), `/communication/*`, `/library/*`, `/books`, `/transport/*`, `/routes`, `/hostels`, `/hostel/*`, `/inventory/*`, `/assets`, `/canteen/*`, `/marketplace/*`, `/analytics/*`, `/dashboard/*`, `/roles`, `/security/*`, `/settings`.

## CORS

Browsers calling the API directly must come from an origin listed in `CORS_ORIGINS`. Mobile apps and the web frontend (which calls server-to-server) need no CORS entry.
