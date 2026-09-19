export class DiscourseApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Discourse API error: ${status}`)
    this.name = 'DiscourseApiError'
    this.status = status
  }
}

export function isDiscourseNotFound(err: unknown): boolean {
  return err instanceof DiscourseApiError && err.status === 404
}
