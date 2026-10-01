import prisma from './prisma'
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from './jwt'

// The login / refresh response shared by web and mobile clients.
export async function issueTokens(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { school: { select: { id: true, name: true } } },
  })
  if (!user || !user.isActive) return null

  const profile = {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    role: user.role,
    schoolId: user.schoolId,
    schoolName: user.school.name,
  }

  return {
    user: { ...profile, firstName: user.firstName, lastName: user.lastName, phone: user.phone, isActive: user.isActive },
    accessToken: await signAccessToken(profile),
    refreshToken: await signRefreshToken(user.id),
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
  }
}
