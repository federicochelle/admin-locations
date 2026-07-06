import type { LocationAnalysisRequest } from '../location-analysis.types.ts'

export function buildLocationAnalysisUserPrompt(
  input: LocationAnalysisRequest,
) {
  return [
    'Analizá esta locación usando exclusivamente la información provista.',
    'Usá la ubicación solo como contexto. No inventes cercanías, barrios, landmarks ni información geográfica que no esté explícita en el input.',
    '',
    'Contexto de la locación:',
    JSON.stringify(
      {
        locationCode: input.locationCode,
        category: input.category,
        department: input.department,
        zone: input.zone,
        currentDescription: input.currentDescription,
        currentFeatureSlugs: input.currentFeatureSlugs,
        currentTagSlugs: input.currentTagSlugs,
      },
      null,
      2,
    ),
    '',
    'Ubicación disponible:',
    JSON.stringify(
      {
        formattedAddress: input.formattedAddress,
        department: input.department,
        zone: input.zone,
        googleDepartmentName: input.googleDepartmentName,
        googleZoneName: input.googleZoneName,
        latitude: input.latitude,
        longitude: input.longitude,
        approxLatitude: input.approxLatitude,
        approxLongitude: input.approxLongitude,
        showExactLocation: input.showExactLocation,
        mapVisibility: input.mapVisibility,
      },
      null,
      2,
    ),
    '',
    'Catálogo disponible de features:',
    JSON.stringify(input.availableFeatures, null, 2),
    '',
    'Catálogo disponible de tags:',
    JSON.stringify(input.availableTags, null, 2),
    '',
    'Imágenes disponibles:',
    JSON.stringify(input.images, null, 2),
    '',
    'Respondé con este JSON estricto:',
    JSON.stringify(
      {
        description: '',
        featureSlugs: [],
        tagSlugs: [],
      },
      null,
      2,
    ),
  ].join('\n')
}
