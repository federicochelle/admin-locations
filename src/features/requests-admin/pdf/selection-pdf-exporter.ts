import { jsPDF } from 'jspdf'
import { prepareImageForPdf } from './selection-pdf-images'
import type {
  SelectionPdfExportResult,
  SelectionPdfFailedImage,
  SelectionPdfLocation,
  SelectionPdfPayload,
  SelectionPdfProgress,
} from './selection-pdf.types'

type CreateSelectionPdfOptions = {
  onProgress?: (progress: SelectionPdfProgress) => void
}

function formatDateForDisplay(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('es-UY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatDateForFileName(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }

  return date.toISOString().slice(0, 10)
}

function normalizeFileNameSegment(value: string) {
  const normalizedValue = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalizedValue || 'locaciones'
}

function buildPdfFileName(payload: SelectionPdfPayload) {
  const productSegment = normalizeFileNameSegment(payload.project.product)
  const dateSegment = formatDateForFileName(payload.generatedAt)

  if (productSegment) {
    return `seleccion-${productSegment}-${dateSegment}.pdf`
  }

  return `seleccion-locaciones-${dateSegment}.pdf`
}

function addCoverPage(doc: jsPDF, payload: SelectionPdfPayload) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('Seleccion de locaciones', 20, 28)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)

  const lines = [
    `Producto: ${payload.project.product}`,
    `Productora: ${payload.project.productionCompany}`,
    `Jefe de locaciones: ${payload.project.locationManager}`,
    `Email: ${payload.project.email}`,
    `Fecha: ${formatDateForDisplay(payload.generatedAt)}`,
    `Total de locaciones: ${payload.totalLocations}`,
    `Total de imagenes: ${payload.totalImages}`,
  ]

  let currentY = 48

  for (const line of lines) {
    doc.text(line, 20, currentY)
    currentY += 10
  }
}

function addLocationPage(
  doc: jsPDF,
  location: SelectionPdfLocation,
  pageImages: Array<{
    dataUrl: string
    width: number
    height: number
  }>,
) {
  doc.addPage()

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  const imageAreaHeight = 116
  const slotGap = 10
  const topImageY = 44
  const showTitle =
    location.locationTitle.trim().length > 0 &&
    location.locationTitle !== location.locationCode

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(location.locationCode, margin, 22)

  if (showTitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.text(location.locationTitle, margin, 30)
  }

  pageImages.forEach((image, index) => {
    const slotY = topImageY + index * (imageAreaHeight + slotGap)
    const widthScale = contentWidth / image.width
    const heightScale = imageAreaHeight / image.height
    const scale = Math.min(widthScale, heightScale)
    const renderWidth = image.width * scale
    const renderHeight = image.height * scale
    const renderX = margin + (contentWidth - renderWidth) / 2
    const renderY = slotY + (imageAreaHeight - renderHeight) / 2

    doc.addImage(
      image.dataUrl,
      'JPEG',
      renderX,
      renderY,
      renderWidth,
      renderHeight,
      undefined,
      'FAST',
    )

    doc.setDrawColor(226, 220, 211)
    doc.roundedRect(margin, slotY, contentWidth, imageAreaHeight, 3, 3)
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Pagina generada el ${formatDateForDisplay(new Date().toISOString())}`,
    margin,
    pageHeight - 10,
  )
}

export async function createSelectionPdf(
  payload: SelectionPdfPayload,
  options: CreateSelectionPdfOptions = {},
): Promise<SelectionPdfExportResult> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const totalImages = payload.totalImages
  const failedImages: SelectionPdfFailedImage[] = []
  let includedImages = 0
  let processedImages = 0

  addCoverPage(doc, payload)

  for (const location of payload.locations) {
    let pageImages: Array<{
      dataUrl: string
      width: number
      height: number
    }> = []

    for (const image of location.images) {
      processedImages += 1
      options.onProgress?.({
        current: processedImages,
        total: totalImages,
        locationCode: location.locationCode,
      })

      try {
        const preparedImage = await prepareImageForPdf(image.imageUrl)

        pageImages.push(preparedImage)
        includedImages += 1

        if (pageImages.length === 2) {
          addLocationPage(doc, location, pageImages)
          pageImages = []
        }
      } catch (error) {
        failedImages.push({
          key: image.key,
          imageUrl: image.imageUrl,
          locationCode: location.locationCode,
          message:
            error instanceof Error
              ? error.message
              : 'No pudimos incluir la imagen en el PDF.',
        })
      }
    }

    if (pageImages.length > 0) {
      addLocationPage(doc, location, pageImages)
    }
  }

  if (includedImages === 0) {
    throw new Error(
      'No pudimos generar el PDF porque ninguna imagen pudo procesarse.',
    )
  }

  return {
    blob: doc.output('blob'),
    fileName: buildPdfFileName(payload),
    totalImages,
    includedImages,
    failedImages,
  }
}

export function openSelectionPdfInNewTab(blob: Blob) {
  const blobUrl = URL.createObjectURL(blob)
  const openedWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer')

  if (!openedWindow) {
    URL.revokeObjectURL(blobUrl)
    throw new Error('No pudimos abrir el PDF en una nueva pestana.')
  }

  window.setTimeout(() => {
    URL.revokeObjectURL(blobUrl)
  }, 60_000)
}
