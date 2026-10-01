import { randomBytes } from 'crypto'

// When no meeting link is supplied we create a private Jitsi Meet room,
// so every scheduled class is joinable without any third-party account.
export function generateMeetingLink() {
  return `https://meet.jit.si/SchoolERP-${randomBytes(8).toString('hex')}`
}
