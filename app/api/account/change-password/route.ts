// Same handler as /api/auth/change-password. The web frontend uses this path because
// /api/auth/* on the frontend is owned by NextAuth.
export { POST } from '@/app/api/auth/change-password/route'
