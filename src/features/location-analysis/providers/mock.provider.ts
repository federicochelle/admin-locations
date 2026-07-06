import type {
  LocationAnalysisInput,
  LocationAnalysisProvider,
  LocationAnalysisResult,
} from '../location-analysis.types'

const MOCK_LOCATION_ANALYSIS_RESULT: LocationAnalysisResult = {
  description:
    'Casa contemporánea con espacios luminosos, presencia de materiales nobles y elementos arquitectónicos destacados. Ideal para producciones audiovisuales que buscan una locación versátil, cuidada y visualmente atractiva.',
  featureSlugs: ['moderna', 'residencial', 'piscina', 'jardin'],
  tagSlugs: ['madera', 'vidrio', 'ventanales', 'chimenea'],
}

export class MockLocationAnalysisProvider implements LocationAnalysisProvider {
  async analyzeLocation(
    _input: LocationAnalysisInput,
  ): Promise<LocationAnalysisResult> {
    return {
      description: MOCK_LOCATION_ANALYSIS_RESULT.description,
      featureSlugs: [...MOCK_LOCATION_ANALYSIS_RESULT.featureSlugs],
      tagSlugs: [...MOCK_LOCATION_ANALYSIS_RESULT.tagSlugs],
    }
  }
}
