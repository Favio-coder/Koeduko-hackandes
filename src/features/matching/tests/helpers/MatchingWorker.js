import { createMatchingResult } from '../../services/matchingService'

export class MatchingWorker {
  terminated = false
  postMessage({ profiles, options }) {
    Promise.resolve().then(() => {
      if (this.terminated) return
      try { this.onmessage({ data: { result: createMatchingResult(profiles, options) } }) }
      catch (error) { this.onmessage({ data: { error: error.message } }) }
    })
  }
  terminate() { this.terminated = true }
}
