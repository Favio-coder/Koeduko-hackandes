import { createMatchingResult } from '../services/matchingService'

self.onmessage = ({ data }) => {
  try {
    self.postMessage({ result: createMatchingResult(data.profiles, data.options) })
  } catch (error) {
    self.postMessage({ error: error.message || 'No se pudo calcular el agrupamiento.' })
  }
}
