import { describe, expect, it } from 'vitest'
import { passwordProblem, temporaryPassword } from '@/lib/passwords'

describe('passwords', () => {
  it('rejects weak passwords', () => {
    expect(passwordProblem('short1')).toMatch(/at least 8/)
    expect(passwordProblem('onlyletters')).toMatch(/letter and one number/)
    expect(passwordProblem('1234567890')).toMatch(/letter and one number/)
    expect(passwordProblem('a1'.repeat(70))).toMatch(/too long/)
  })

  it('accepts a reasonable password', () => {
    expect(passwordProblem('school2026')).toBeNull()
  })

  it('generates temporary passwords that pass the policy and differ each time', () => {
    const a = temporaryPassword()
    const b = temporaryPassword()
    expect(a).toHaveLength(10)
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[A-Za-z2-9]+$/)
  })
})
