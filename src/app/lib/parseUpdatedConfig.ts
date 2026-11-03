import { parseFuxaConfig } from '../../domain/config/parseFuxaConfig'
import type { ParsedFuxaConfig } from '../../domain/config/types'

export function parseUpdatedConfig(
  rawConfig: ParsedFuxaConfig['rawConfig'],
  source: ParsedFuxaConfig,
): ParsedFuxaConfig {
  const parsed = parseFuxaConfig(JSON.stringify(rawConfig))
  return {
    ...parsed,
    originalText: source.originalText,
    sourceFormat: source.sourceFormat,
  }
}
