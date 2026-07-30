import type { LocationAnalysisRequest } from '../location-analysis.types.ts'

function formatAliases(aliases: string[]) {
  return aliases.length > 0 ? aliases.join(', ') : 'ninguno'
}

function formatFeatureCatalog(
  features: LocationAnalysisRequest['availableFeatures'],
) {
  if (features.length === 0) {
    return '- ninguno'
  }

  return features
    .map((feature) =>
      [
        `- Nombre: ${feature.name}`,
        `  Slug: ${feature.slug}`,
        `  Grupo: ${feature.group ?? 'ninguno'}`,
        `  Aliases: ${formatAliases(feature.aliases)}`,
      ].join('\n'),
    )
    .join('\n')
}

function formatTagCatalog(
  tags: LocationAnalysisRequest['availableTags'],
) {
  if (tags.length === 0) {
    return '- ninguno'
  }

  return tags
    .map((tag) =>
      [
        `- Nombre: ${tag.name}`,
        `  Slug: ${tag.slug}`,
        `  Categoría: ${tag.category ?? 'ninguna'}`,
        `  Aliases: ${formatAliases(tag.aliases)}`,
      ].join('\n'),
    )
    .join('\n')
}

function formatImageSummary(images: LocationAnalysisRequest['images']) {
  if (images.length === 0) {
    return JSON.stringify(
      {
        imageCount: 0,
        images: [],
      },
      null,
      2,
    )
  }

  return JSON.stringify(
    {
      imageCount: images.length,
      images: images.map((image) => ({
        kind: image.kind,
        order: image.order,
        isCover: image.isCover,
        filename: image.kind === 'file' ? image.filename : null,
        mimeType: image.kind === 'file' ? image.mimeType : null,
      })),
    },
    null,
    2,
  )
}

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
    formatFeatureCatalog(input.availableFeatures),
    '',
    'Catálogo disponible de tags:',
    formatTagCatalog(input.availableTags),
    '',
    'Imágenes disponibles:',
    formatImageSummary(input.images),
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
