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
    'Tomá el conjunto completo de imágenes como distintas vistas de una misma locación.',
    'Primero comprendé el carácter general del lugar y después sintetizá los elementos repetidos o relevantes.',
    'No describas cada fotografía por separado.',
    'No asumas que algo está presente en toda la locación solo porque aparece de forma aislada en una única imagen.',
    'Priorizá la evidencia visual por sobre el contexto administrativo para description y para la selección de rasgos visuales.',
    'Usá la ubicación solo como contexto. No inventes cercanías, barrios, landmarks ni información geográfica que no esté explícita en el input.',
    'La categoría, la ubicación, las features actuales y los tags actuales sirven como apoyo, pero no reemplazan lo que muestran las imágenes.',
    'Las features representan conceptos amplios, fuertes y útiles para clasificar la locación. Priorizá estilo, tipología, uso dominante o carácter general del lugar por encima de sumar muchas features.',
    'Los tags son secundarios. Devolvé como máximo 6 tags, y pueden ser menos o ninguno. No intentes completar 6 si no hay tags realmente útiles.',
    'Priorizá tags con mayor valor discriminante para búsqueda en este orden: arquitectura distintiva, materiales dominantes, iluminación relevante, exteriores o elementos visuales muy característicos, y recién al final mobiliario excepcional.',
    'No selecciones mobiliario común como tag solo por aparecer en las imágenes. Mesa, mesa larga, mesa redonda, sofá, sillón, escritorio, estanterías, biblioteca o taburetes normalmente deben quedar en description salvo que sean excepcionalmente protagonistas.',
    'La description debe ser rica en vocabulario natural útil para búsqueda y puede incluir conceptos que no existan como feature o tag si están visualmente justificados.',
    'No recortes description para compensar menos tags. Los detalles visuales descartados como tags deben seguir pudiendo quedar mencionados en description cuando aporten valor semántico.',
    'Si hay evidencia visual razonable, la description puede mencionar compatibilidades visuales con usos audiovisuales como publicidad, entrevistas, moda/editorial, lifestyle, ficción o escenas corporativas, sin usar lenguaje promocional ni afirmaciones absolutas.',
    'Usá español rioplatense/uruguayo natural. Evitá regionalismos de España poco naturales para Uruguay, especialmente "nave industrial" o "naves industriales".',
    'Cuando describas espacios industriales, preferí según la evidencia visual términos como "galpón industrial", "galpón", "depósito", "fábrica", "antigua fábrica", "espacio industrial" o "predio industrial".',
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
