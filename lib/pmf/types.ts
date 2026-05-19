/** Exit reasons captured when a user cancels their subscription. */
export const EXIT_REASONS = [
  { value: 'got_job',      label: '🟢 I got a job!' },
  { value: 'no_interviews', label: '🔴 I didn\'t get enough interviews' },
  { value: 'low_quality',  label: '🔴 Applications felt spammy / low quality' },
  { value: 'too_expensive', label: '🟡 Too expensive' },
  { value: 'not_used',     label: '🟡 I didn\'t use it enough' },
  { value: 'other',        label: '🔵 Other reason' },
] as const

export type ExitReason = (typeof EXIT_REASONS)[number]['value']

/** Survey types */
export const SURVEY_TYPES = {
  INTERVIEW_DAY30: 'interview_day30',
} as const

export type SurveyAnswer = 'yes' | 'no' | 'not_sure'

export interface SurveyResponse {
  answer: SurveyAnswer
  interviewCount?: number
}
