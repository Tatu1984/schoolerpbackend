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
    tokenVersion: user.tokenVersion,
  }

  return {
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      schoolId: profile.schoolId,
      schoolName: profile.schoolName,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    },
    accessToken: await signAccessToken(profile),
    refreshToken: await signRefreshToken(user.id, user.tokenVersion),
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
  }
}
