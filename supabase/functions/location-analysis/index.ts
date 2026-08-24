import { createClient } from 'npm:@supabase/supabase-js@2'
import { getRequiredEnv, hasEnv } from '../_shared/env.ts'
import type {
  LocationAnalysisFeatureCatalogItem,
  LocationAnalysisImageInput,
  LocationAnalysisRequest,
  LocationAnalysisRequestBody,
  LocationAnalysisResponse,
  LocationAnalysisTagCatalogItem,
} from './location-analysis.types.ts'
import { systemPrompt } from './prompts/system.prompt.ts'
import { buildLocationAnalysisUserPrompt } from './prompts/user-prompt.builder.ts'

type ErrorResponseCode =
  | 'UNAUTHORIZED'
  | 'INVALID_BODY'
  | 'INVALID_PROVIDER'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'ANALYSIS_FAILED'

type AnalysisProviderName = 'mock' | 'openai'

type AnalysisUsage = {
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

type AnalysisRunLogInput = {
  durationMs: number
  errorCode?: string | null
  errorMessage?: string | null
  input: LocationAnalysisRequest
  model: string
  provider: AnalysisProviderName
  status: 'success' | 'error'
  usage?: AnalysisUsage | null
}

type OpenAIResponseEnvelope = {
  error?: unknown
  output?: Array<{
    content?: Array<{
      text?: string
      type?: string
    }>
    type?: string
  }>
  output_text?: string
  warnings?: unknown
  usage?: {
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }
  model?: string
}

const MOCK_DESCRIPTION =
  'Casa contemporánea con espacios luminosos, presencia de materiales nobles y elementos arquitectónicos destacados. Ideal para producciones audiovisuales que buscan una locación versátil, cuidada y visualmente atractiva.'
const MOCK_FEATURE_SLUGS = ['moderna', 'residencial', 'piscina', 'jardin']
const MOCK_TAG_SLUGS = ['madera', 'vidrio', 'ventanales', 'chimenea']
const MAX_IMAGES = 12
const MAX_AVAILABLE_FEATURES = 300
const MAX_AVAILABLE_TAGS = 300
const OPENAI_API_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_OPENAI_MODEL = 'gpt-5'
const MOCK_MODEL = 'mock-v1'
const PROMPT_VERSION = 'v4'
const MAX_TAG_SLUGS = 6
const DATA_URL_DEBUG_PREFIX_LENGTH = 40
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function isDebugEnabled() {
  const rawValue = Deno.env.get('LOCATION_ANALYSIS_DEBUG')?.trim().toLowerCase()
  return rawValue === '1' || rawValue === 'true' || rawValue === 'yes' || rawValue === 'on'
}

function getUrlProtocol(value: string) {
  try {
    return new URL(value).protocol
  } catch {
    if (value.startsWith('data:')) {
      return 'data:'
    }

    return 'invalid'
  }
}

function debugLogParsedImages(input: LocationAnalysisRequest) {
  console.info('[location-analysis][debug] Parsed request images summary', {
    imageCount: input.images.length,
    images: input.images.map((image) =>
      image.kind === 'file'
        ? {
            kind: image.kind,
            order: image.order,
            isCover: image.isCover,
            mimeType: image.mimeType,
            filename: image.filename,
            dataUrlLength: image.dataUrl.length,
            dataUrlPrefix: image.dataUrl.slice(0, DATA_URL_DEBUG_PREFIX_LENGTH),
          }
        : {
            kind: image.kind,
            order: image.order,
            isCover: image.isCover,
            mimeType: null,
            filename: null,
            dataUrlLength: null,
            dataUrlPrefix: null,
            urlProtocol: getUrlProtocol(image.url),
          }),
  })
}

function debugLogOpenAIRequest(requestBody: ReturnType<typeof buildOpenAIRequestBody>) {
  const userInput = requestBody.input.find((entry) => entry.role === 'user')
  const userContent = userInput?.content ?? []
  const textBlock = userContent.find((entry) => entry.type === 'input_text')
  const imageBlocks = userContent.filter((entry) => entry.type === 'input_image')
  const inputText = typeof textBlock?.text === 'string' ? textBlock.text : ''
  const imageSummaries = imageBlocks.map((entry) => {
    const imageUrl = typeof entry.image_url === 'string' ? entry.image_url : ''

    return {
      detail: entry.detail,
      imageUrlLength: imageUrl.length,
      protocol: getUrlProtocol(imageUrl),
    }
  })

  console.info('[location-analysis][debug] OpenAI request summary', {
    model: requestBody.model,
    inputImageCount: imageBlocks.length,
    dataImageCount: imageSummaries.filter((entry) => entry.protocol === 'data:').length,
    httpsImageCount: imageSummaries.filter((entry) => entry.protocol === 'https:').length,
    imageDetails: imageSummaries.map((entry) => entry.detail),
    imageUrlLengths: imageSummaries.map((entry) => entry.imageUrlLength),
    inputTextLength: inputText.length,
    inputTextContainsDataImagePrefix: inputText.includes('data:image'),
  })
}

function debugLogOpenAIResponse(response: OpenAIResponseEnvelope, outputText: string) {
  console.info('[location-analysis][debug] OpenAI response summary', {
    model: response.model ?? null,
    usage: response.usage ?? null,
    outputItemTypes: response.output?.map((item) => item.type ?? null) ?? [],
    outputContentTypes:
      response.output?.flatMap((item) =>
        (item.content ?? []).map((contentItem) => contentItem.type ?? null)
      ) ?? [],
    outputTextLength: outputText.length,
    outputText,
    warnings: response.warnings ?? null,
    error: response.error ?? null,
  })
}

function createJsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...(init?.headers ?? {}),
    },
  })
}

function errorResponse(
  code: ErrorResponseCode,
  message: string,
  status: number,
) {
  return createJsonResponse(
    {
      error: {
        code,
        message,
      },
    },
    { status },
  )
}

function toNullableString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return null
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

function toNullableNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseAvailableFeatures(
  value: unknown,
): LocationAnalysisFeatureCatalogItem[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => {
      const name = toNullableString(entry.name)
      const slug = toNullableString(entry.slug)
      const aliases = toStringArray(entry.aliases)

      if (!name || !slug || aliases === null) {
        return null
      }

      return {
        name,
        slug,
        group: toNullableString(entry.group),
        aliases,
      }
    })
    .filter((entry): entry is LocationAnalysisFeatureCatalogItem => entry !== null)
}

function parseAvailableTags(
  value: unknown,
): LocationAnalysisTagCatalogItem[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => {
      const name = toNullableString(entry.name)
      const slug = toNullableString(entry.slug)
      const aliases = toStringArray(entry.aliases)

      if (!name || !slug || aliases === null) {
        return null
      }

      return {
        name,
        slug,
        category: toNullableString(entry.category),
        aliases,
      }
    })
    .filter((entry): entry is LocationAnalysisTagCatalogItem => entry !== null)
}

function parseImages(value: unknown): LocationAnalysisImageInput[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => {
      const kind = entry.kind === 'file' ? 'file' : entry.kind === 'url' ? 'url' : null
      const isCover = entry.isCover === true
      const order =
        typeof entry.order === 'number' && Number.isFinite(entry.order)
          ? entry.order
          : null

      if (!kind || order === null) {
        return null
      }

      if (kind === 'url') {
        const url = toNullableString(entry.url)

        if (!url) {
          return null
        }

        return {
          kind,
          url,
          isCover,
          order,
        }
      }

      const dataUrl = toNullableString(entry.dataUrl)

      if (!dataUrl || !dataUrl.startsWith('data:')) {
        return null
      }

      return {
        kind,
        dataUrl,
        mimeType: toNullableString(entry.mimeType),
        filename: toNullableString(entry.filename),
        isCover,
        order,
      }
    })
    .filter((entry): entry is LocationAnalysisImageInput => entry !== null)
}

function parseRequestBody(body: LocationAnalysisRequestBody): LocationAnalysisRequest | null {
  const currentFeatureSlugs = toStringArray(body.currentFeatureSlugs)
  const currentTagSlugs = toStringArray(body.currentTagSlugs)
  const availableFeatures = parseAvailableFeatures(body.availableFeatures)
  const availableTags = parseAvailableTags(body.availableTags)
  const images = parseImages(body.images)

  if (
    typeof body.currentDescription !== 'string' ||
    currentFeatureSlugs === null ||
    currentTagSlugs === null ||
    availableFeatures === null ||
    availableTags === null ||
    images === null
  ) {
    return null
  }

  if (
    images.length > MAX_IMAGES ||
    availableFeatures.length > MAX_AVAILABLE_FEATURES ||
    availableTags.length > MAX_AVAILABLE_TAGS
  ) {
    return null
  }

  return {
    locationId: toNullableString(body.locationId),
    locationCode: toNullableString(body.locationCode),
    category: toNullableString(body.category),
    department: toNullableString(body.department),
    zone: toNullableString(body.zone),
    formattedAddress: toNullableString(body.formattedAddress),
    googleDepartmentName: toNullableString(body.googleDepartmentName),
    googleZoneName: toNullableString(body.googleZoneName),
    latitude: toNullableNumber(body.latitude),
    longitude: toNullableNumber(body.longitude),
    approxLatitude: toNullableNumber(body.approxLatitude),
    approxLongitude: toNullableNumber(body.approxLongitude),
    showExactLocation: body.showExactLocation === true,
    mapVisibility: toNullableString(body.mapVisibility),
    currentDescription: body.currentDescription.trim(),
    currentFeatureSlugs,
    currentTagSlugs,
    availableFeatures,
    availableTags,
    images,
  }
}

function getUniqueSlugs(slugs: string[]) {
  return Array.from(
    new Set(
      slugs
        .map((slug) => slug.trim())
        .filter((slug) => slug.length > 0),
    ),
  )
}

async function assertAuthenticated(request: Request) {
  const authorization = request.headers.get('Authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return false
  }

  const token = authorization.slice('Bearer '.length).trim()
  const adminClient = createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
  const {
    data: { user },
    error,
  } = await adminClient.auth.getUser(token)

  return !error && Boolean(user)
}

function buildMockAnalysisResponse(
  input: LocationAnalysisRequest,
): LocationAnalysisResponse {
  const availableFeatureSlugs = new Set(
    input.availableFeatures.map((feature) => feature.slug),
  )
  const availableTagSlugs = new Set(input.availableTags.map((tag) => tag.slug))

  return {
    description: MOCK_DESCRIPTION.trim(),
    featureSlugs: getUniqueSlugs(MOCK_FEATURE_SLUGS).filter((slug) =>
      availableFeatureSlugs.has(slug),
    ),
    tagSlugs: getUniqueSlugs(MOCK_TAG_SLUGS).filter((slug) =>
      availableTagSlugs.has(slug),
    ).slice(0, MAX_TAG_SLUGS),
  }
}

function prepareAnalysisPrompts(input: LocationAnalysisRequest) {
  return {
    system: systemPrompt,
    user: buildLocationAnalysisUserPrompt(input),
  }
}

function getConfiguredProvider(): AnalysisProviderName | 'invalid' {
  const provider = Deno.env.get('LOCATION_ANALYSIS_PROVIDER')?.trim() || 'mock'

  if (provider === 'mock' || provider === 'openai') {
    return provider
  }

  return 'invalid'
}

function normalizeAnalysisResponse(
  input: LocationAnalysisRequest,
  rawResult: unknown,
): LocationAnalysisResponse {
  const availableFeatureSlugs = new Set(
    input.availableFeatures.map((feature) => feature.slug),
  )
  const availableTagSlugs = new Set(
    input.availableTags.map((tag) => tag.slug),
  )
  const result =
    typeof rawResult === 'object' && rawResult !== null
      ? (rawResult as Partial<LocationAnalysisResponse>)
      : {}

  return {
    description:
      typeof result.description === 'string' ? result.description.trim() : '',
    featureSlugs: getUniqueSlugs(
      Array.isArray(result.featureSlugs) ? result.featureSlugs : [],
    ).filter((slug) => availableFeatureSlugs.has(slug)),
    tagSlugs: getUniqueSlugs(
      Array.isArray(result.tagSlugs) ? result.tagSlugs : [],
    )
      .filter((slug) => availableTagSlugs.has(slug))
      .slice(0, MAX_TAG_SLUGS),
  }
}

function extractOpenAIOutputText(response: OpenAIResponseEnvelope) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim()
  }

  const textParts =
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((contentItem) =>
        typeof contentItem.text === 'string' ? contentItem.text.trim() : '',
      )
      .filter((text) => text.length > 0) ?? []

  return textParts.join('\n').trim()
}

function getOpenAIUsage(response: OpenAIResponseEnvelope): AnalysisUsage {
  const inputTokens =
    typeof response.usage?.input_tokens === 'number'
      ? response.usage.input_tokens
      : null
  const outputTokens =
    typeof response.usage?.output_tokens === 'number'
      ? response.usage.output_tokens
      : null
  const totalTokens =
    typeof response.usage?.total_tokens === 'number'
      ? response.usage.total_tokens
      : inputTokens !== null || outputTokens !== null
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : null

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  }
}

function buildOpenAIRequestBody(input: LocationAnalysisRequest) {
  const prompts = prepareAnalysisPrompts(input)
  const userContent = [
    {
      type: 'input_text',
      text: prompts.user,
    },
    ...input.images.map((image) => ({
      type: 'input_image',
      image_url: image.kind === 'url' ? image.url : image.dataUrl,
      detail: image.isCover ? 'high' : 'auto',
    })),
  ]

  return {
    model: Deno.env.get('OPENAI_MODEL')?.trim() || DEFAULT_OPENAI_MODEL,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text: prompts.system,
          },
        ],
      },
      {
        role: 'user',
        content: userContent,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'location_analysis_result',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            description: {
              type: 'string',
            },
            featureSlugs: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            tagSlugs: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
          required: ['description', 'featureSlugs', 'tagSlugs'],
        },
      },
    },
  }
}

async function analyzeWithOpenAI(
  input: LocationAnalysisRequest,
): Promise<{
  model: string
  result: LocationAnalysisResponse
  usage: AnalysisUsage
}> {
  const apiKey = getRequiredEnv('OPENAI_API_KEY')
  const requestBody = buildOpenAIRequestBody(input)

  // Temporary runtime instrumentation for comparing URL vs Data URL image analysis.
  if (isDebugEnabled()) {
    debugLogOpenAIRequest(requestBody)
  }

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI request failed (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as OpenAIResponseEnvelope
  const outputText = extractOpenAIOutputText(data)

  // Temporary runtime instrumentation for inspecting the raw OpenAI analysis output.
  if (isDebugEnabled()) {
    debugLogOpenAIResponse(data, outputText)
  }

  if (!outputText) {
    throw new Error('OpenAI returned an empty analysis response.')
  }

  let parsedResult: unknown

  try {
    parsedResult = JSON.parse(outputText)
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid JSON returned by OpenAI: ${error.message}`
        : 'Invalid JSON returned by OpenAI.',
    )
  }

  return {
    model: requestBody.model,
    result: normalizeAnalysisResponse(input, parsedResult),
    usage: getOpenAIUsage(data),
  }
}

async function createAdminClient() {
  return createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
}

async function logAnalysisRun({
  durationMs,
  errorCode = null,
  errorMessage = null,
  input,
  model,
  provider,
  status,
  usage = null,
}: AnalysisRunLogInput) {
  if (!input.locationId) {
    return
  }

  try {
    const adminClient = await createAdminClient()
    const { error } = await adminClient.from('location_analysis_runs').insert({
      location_id: input.locationId,
      provider,
      model,
      prompt_version: PROMPT_VERSION,
      status,
      duration_ms: durationMs,
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      total_tokens: usage?.totalTokens ?? null,
      estimated_cost_usd: null,
      error_code: errorCode,
      error_message: errorMessage,
    })

    if (error) {
      console.error('No pudimos registrar location_analysis_runs.', error)
    }
  } catch (error) {
    console.error('No pudimos inicializar el log de análisis.', error)
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (request.method !== 'POST') {
    return createJsonResponse(
      { error: { code: 'ANALYSIS_FAILED', message: 'Method not allowed.' } },
      { status: 405 },
    )
  }

  try {
    const startedAt = Date.now()
    const configuredProvider = getConfiguredProvider()

    const isAuthenticated = await assertAuthenticated(request)

    if (!isAuthenticated) {
      return errorResponse(
        'UNAUTHORIZED',
        'Authentication is required to analyze locations.',
        401,
      )
    }

    if (configuredProvider === 'invalid') {
      return errorResponse(
        'INVALID_PROVIDER',
        'Invalid LOCATION_ANALYSIS_PROVIDER. Use "mock" or "openai".',
        500,
      )
    }

    const body = (await request.json()) as LocationAnalysisRequestBody
    const input = parseRequestBody(body)

    if (!input) {
      return errorResponse(
        'INVALID_BODY',
        'The request body is invalid.',
        400,
      )
    }

    // Temporary runtime instrumentation for comparing parsed URL vs file images.
    if (isDebugEnabled()) {
      debugLogParsedImages(input)
    }

    try {
      if (configuredProvider === 'mock') {
        const mockResult = buildMockAnalysisResponse(input)

        await logAnalysisRun({
          durationMs: Date.now() - startedAt,
          input,
          model: MOCK_MODEL,
          provider: 'mock',
          status: 'success',
        })

        return createJsonResponse(mockResult, { status: 200 })
      }

      if (!hasEnv('OPENAI_API_KEY')) {
        await logAnalysisRun({
          durationMs: Date.now() - startedAt,
          errorCode: 'PROVIDER_NOT_CONFIGURED',
          errorMessage: 'OPENAI_API_KEY is required when LOCATION_ANALYSIS_PROVIDER=openai.',
          input,
          model: Deno.env.get('OPENAI_MODEL')?.trim() || DEFAULT_OPENAI_MODEL,
          provider: 'openai',
          status: 'error',
        })

        return errorResponse(
          'PROVIDER_NOT_CONFIGURED',
          'OPENAI_API_KEY is required when LOCATION_ANALYSIS_PROVIDER=openai.',
          500,
        )
      }

      const { model, result, usage } = await analyzeWithOpenAI(input)

      await logAnalysisRun({
        durationMs: Date.now() - startedAt,
        input,
        model,
        provider: 'openai',
        status: 'success',
        usage,
      })

      return createJsonResponse(result, { status: 200 })
    } catch (error) {
      const internalMessage =
        error instanceof Error ? error.message : 'Unknown analysis error.'

      await logAnalysisRun({
        durationMs: Date.now() - startedAt,
        errorCode: 'ANALYSIS_FAILED',
        errorMessage: internalMessage,
        input,
        model:
          configuredProvider === 'openai'
            ? Deno.env.get('OPENAI_MODEL')?.trim() || DEFAULT_OPENAI_MODEL
            : MOCK_MODEL,
        provider: configuredProvider,
        status: 'error',
      })

      console.error('Location analysis failed.', error)

      return errorResponse(
        'ANALYSIS_FAILED',
        'No pudimos analizar la locación en este momento.',
        500,
      )
    }
  } catch (_error) {
    return errorResponse(
      'ANALYSIS_FAILED',
      'No pudimos analizar la locación en este momento.',
      500,
    )
  }
})
