import type {
  LocationAnalysisInput,
  LocationAnalysisProvider,
  LocationAnalysisResult,
} from './location-analysis.types'
import { OpenAIProvider } from './providers/openai.provider'

const MAX_TAG_SLUGS = 6

function getUniqueSlugs(slugs: string[]) {
  return Array.from(
    new Set(
      slugs
        .map((slug) => slug.trim())
        .filter((slug) => slug.length > 0),
    ),
  )
}

function normalizeLocationAnalysisResult(
  result: LocationAnalysisResult,
): LocationAnalysisResult {
  return {
    description: result.description.trim(),
    featureSlugs: getUniqueSlugs(result.featureSlugs),
    tagSlugs: getUniqueSlugs(result.tagSlugs).slice(0, MAX_TAG_SLUGS),
  }
}

export class LocationAnalysisService {
  private readonly provider: LocationAnalysisProvider

  constructor(provider: LocationAnalysisProvider) {
    this.provider = provider
  }

  async analyzeLocation(
    input: LocationAnalysisInput,
  ): Promise<LocationAnalysisResult> {
    const result = await this.provider.analyzeLocation(input)

    return normalizeLocationAnalysisResult(result)
  }
}

export function createLocationAnalysisService(
  provider: LocationAnalysisProvider = new OpenAIProvider(),
) {
  return new LocationAnalysisService(provider)
}

export const locationAnalysisService = createLocationAnalysisService()
