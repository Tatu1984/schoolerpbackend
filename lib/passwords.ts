import { randomInt } from 'crypto'

export const MIN_PASSWORD_LENGTH = 8

// Returns a message if the password is too weak, otherwise null
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  if (password.length > 128) return 'Password is too long'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number'
  return null
}

// Temporary password handed out by an administrator; avoids look-alike characters
export function temporaryPassword(length = 10) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)]
  return out
}
