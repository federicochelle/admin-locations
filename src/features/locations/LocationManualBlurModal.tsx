import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PendingLocationImageFile } from './location-images.types'
import {
  FACE_BLUR_FILTER,
  type BlurStroke,
} from './location-face-blur'

type LocationManualBlurModalProps = {
  errorMessage: string | null
  image: PendingLocationImageFile | null
  isApplying: boolean
  isOpen: boolean
  onApply: (imageId: string, strokes: BlurStroke[]) => Promise<void>
  onClose: () => void
}

type BrushCursorState = {
  isVisible: boolean
  x: number
  y: number
}

type CanvasPointerPosition = {
  imageX: number
  imageY: number
  renderedX: number
  renderedY: number
  scaleX: number
  scaleY: number
}

type EditorAssets = {
  baseCanvas: HTMLCanvasElement
  blurredCanvas: HTMLCanvasElement
  compositeCanvas: HTMLCanvasElement
  compositeContext: CanvasRenderingContext2D
  height: number
  maskCanvas: HTMLCanvasElement
  maskContext: CanvasRenderingContext2D
  release: () => void
  width: number
}

type LoadedEditorSource = {
  height: number
  release: () => void
  source: CanvasImageSource
  width: number
}

const BRUSH_RADIUS_RENDERED = 19
const BRUSH_CENTER_MARK_SIZE = 8

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

function UndoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 10H5V6" />
      <path d="M5 10a8 8 0 1 1 2.3 5.7" />
    </svg>
  )
}

async function loadEditorSource(file: File): Promise<LoadedEditorSource> {
  if (typeof window.createImageBitmap === 'function') {
    const bitmap = await window.createImageBitmap(file, {
      imageOrientation: 'from-image',
    })

    return {
      height: bitmap.height,
      release: () => bitmap.close(),
      source: bitmap,
      width: bitmap.width,
    }
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image()
      nextImage.onload = () => resolve(nextImage)
      nextImage.onerror = () =>
        reject(new Error('No pudimos preparar la imagen para blur manual.'))
      nextImage.src = objectUrl
    })

    return {
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
      source: image,
      width: image.naturalWidth,
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

async function createEditorAssets(file: File): Promise<EditorAssets> {
  const loadedSource = await loadEditorSource(file)

  try {
    const baseCanvas = document.createElement('canvas')
    baseCanvas.width = loadedSource.width
    baseCanvas.height = loadedSource.height
    const baseContext = baseCanvas.getContext('2d')

    if (!baseContext) {
      throw new Error('No pudimos preparar la imagen base para blur manual.')
    }

    baseContext.drawImage(
      loadedSource.source,
      0,
      0,
      loadedSource.width,
      loadedSource.height,
    )

    const blurredCanvas = document.createElement('canvas')
    blurredCanvas.width = loadedSource.width
    blurredCanvas.height = loadedSource.height
    const blurredContext = blurredCanvas.getContext('2d')

    if (!blurredContext) {
      throw new Error('No pudimos preparar la capa difuminada para blur manual.')
    }

    blurredContext.save()
    blurredContext.filter = FACE_BLUR_FILTER
    blurredContext.drawImage(baseCanvas, 0, 0, loadedSource.width, loadedSource.height)
    blurredContext.restore()

    const maskCanvas = document.createElement('canvas')
    maskCanvas.width = loadedSource.width
    maskCanvas.height = loadedSource.height
    const maskContext = maskCanvas.getContext('2d')

    if (!maskContext) {
      throw new Error('No pudimos preparar la mascara del blur manual.')
    }

    const compositeCanvas = document.createElement('canvas')
    compositeCanvas.width = loadedSource.width
    compositeCanvas.height = loadedSource.height
    const compositeContext = compositeCanvas.getContext('2d')

    if (!compositeContext) {
      throw new Error('No pudimos preparar la composicion del blur manual.')
    }

    return {
      baseCanvas,
      blurredCanvas,
      compositeCanvas,
      compositeContext,
      height: loadedSource.height,
      maskCanvas,
      maskContext,
      release: loadedSource.release,
      width: loadedSource.width,
    }
  } catch (error) {
    loadedSource.release()
    throw error
  }
}

function drawStrokeMask(
  context: CanvasRenderingContext2D,
  stroke: BlurStroke,
) {
  if (stroke.points.length === 0) {
    return
  }

  const [firstPoint, ...remainingPoints] = stroke.points

  context.save()
  context.fillStyle = '#ffffff'
  context.strokeStyle = '#ffffff'
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.lineWidth = stroke.radius * 2

  if (remainingPoints.length === 0) {
    context.beginPath()
    context.arc(firstPoint.x, firstPoint.y, stroke.radius, 0, Math.PI * 2)
    context.fill()
    context.restore()
    return
  }

  context.beginPath()
  context.moveTo(firstPoint.x, firstPoint.y)

  for (const point of remainingPoints) {
    context.lineTo(point.x, point.y)
  }

  context.stroke()
  context.restore()
}

function LocationManualBlurModal({
  errorMessage,
  image,
  isApplying,
  isOpen,
  onApply,
  onClose,
}: LocationManualBlurModalProps) {
  const titleId = useId()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasContainerRef = useRef<HTMLDivElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)
  const editorAssetsRef = useRef<EditorAssets | null>(null)
  const renderFrameRef = useRef<number | null>(null)
  const sessionIdRef = useRef(0)
  const activePointerIdRef = useRef<number | null>(null)
  const draftStrokeRef = useRef<BlurStroke | null>(null)
  const strokesRef = useRef<BlurStroke[]>([])
  const [strokes, setStrokes] = useState<BlurStroke[]>([])
  const [hasDraftStroke, setHasDraftStroke] = useState(false)
  const [isPreparing, setIsPreparing] = useState(true)
  const [editorErrorMessage, setEditorErrorMessage] = useState<string | null>(null)
  const [brushCursor, setBrushCursor] = useState<BrushCursorState>({
    isVisible: false,
    x: 0,
    y: 0,
  })

  const renderPreview = useCallback(() => {
    const canvas = canvasRef.current
    const assets = editorAssetsRef.current

    if (!canvas || !assets) {
      return
    }

    if (canvas.width !== assets.width) {
      canvas.width = assets.width
    }

    if (canvas.height !== assets.height) {
      canvas.height = assets.height
    }

    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    context.clearRect(0, 0, assets.width, assets.height)
    context.drawImage(assets.baseCanvas, 0, 0, assets.width, assets.height)

    const strokesToRender = [
      ...strokesRef.current,
      ...(draftStrokeRef.current ? [draftStrokeRef.current] : []),
    ].filter((stroke) => stroke.points.length > 0)

    if (strokesToRender.length === 0) {
      return
    }

    assets.maskContext.clearRect(0, 0, assets.width, assets.height)

    for (const stroke of strokesToRender) {
      drawStrokeMask(assets.maskContext, stroke)
    }

    assets.compositeContext.clearRect(0, 0, assets.width, assets.height)
    assets.compositeContext.drawImage(
      assets.blurredCanvas,
      0,
      0,
      assets.width,
      assets.height,
    )
    assets.compositeContext.globalCompositeOperation = 'destination-in'
    assets.compositeContext.drawImage(
      assets.maskCanvas,
      0,
      0,
      assets.width,
      assets.height,
    )
    assets.compositeContext.globalCompositeOperation = 'source-over'

    context.drawImage(
      assets.compositeCanvas,
      0,
      0,
      assets.width,
      assets.height,
    )
  }, [])

  const schedulePreviewRender = useCallback(() => {
    if (renderFrameRef.current !== null) {
      return
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderFrameRef.current = null
      renderPreview()
    })
  }, [renderPreview])

  const cleanupEditorAssets = useCallback(() => {
    editorAssetsRef.current?.release()
    editorAssetsRef.current = null
  }, [])

  const hideBrushCursor = useCallback(() => {
    setBrushCursor((currentCursor) =>
      currentCursor.isVisible
        ? {
            ...currentCursor,
            isVisible: false,
          }
        : currentCursor,
    )
  }, [])

  function getRenderedCanvasScale(
    bounds: DOMRect,
    assets: Pick<EditorAssets, 'width' | 'height'>,
  ) {
    return {
      scaleX: assets.width / bounds.width,
      scaleY: assets.height / bounds.height,
      }
  }

  function updateBrushCursorFromPointerPosition(
    pointerPosition: CanvasPointerPosition | null,
  ) {
    if (!pointerPosition) {
      hideBrushCursor()
      return
    }

    setBrushCursor({
      isVisible: true,
      x: pointerPosition.renderedX,
      y: pointerPosition.renderedY,
    })
  }

  function getCanvasPointerPosition(
    clientX: number,
    clientY: number,
  ): CanvasPointerPosition | null {
    const canvas = canvasRef.current
    const assets = editorAssetsRef.current

    if (!canvas || !assets) {
      return null
    }

    const bounds = canvas.getBoundingClientRect()

    if (
      clientX < bounds.left ||
      clientX > bounds.right ||
      clientY < bounds.top ||
      clientY > bounds.bottom
    ) {
      return null
    }

    const { scaleX, scaleY } = getRenderedCanvasScale(bounds, assets)
    const renderedX = clientX - bounds.left
    const renderedY = clientY - bounds.top

    return {
      imageX: clamp(renderedX * scaleX, 0, assets.width),
      imageY: clamp(renderedY * scaleY, 0, assets.height),
      renderedX,
      renderedY,
      scaleX,
      scaleY,
    }
  }

  function getBrushRadiusInImagePixels(
    pointerPosition: Pick<CanvasPointerPosition, 'scaleX'> | null,
  ) {
    if (!pointerPosition) {
      return BRUSH_RADIUS_RENDERED
    }

    return Math.max(1, BRUSH_RADIUS_RENDERED * pointerPosition.scaleX)
  }

  function commitDraftStroke() {
    const draftStroke = draftStrokeRef.current

    if (!draftStroke || draftStroke.points.length === 0) {
      draftStrokeRef.current = null
      setHasDraftStroke(false)
      schedulePreviewRender()
      return
    }

    setStrokes((currentStrokes) => [...currentStrokes, draftStroke])
    draftStrokeRef.current = null
    setHasDraftStroke(false)
  }

  const handleUndo = useCallback(() => {
    if (isApplying) {
      return
    }

    if (draftStrokeRef.current) {
      draftStrokeRef.current = null
      setHasDraftStroke(false)
      schedulePreviewRender()
      return
    }

    setStrokes((currentStrokes) => currentStrokes.slice(0, -1))
  }, [isApplying, schedulePreviewRender])

  async function handleConfirm() {
    if (!image || isApplying || isPreparing || strokes.length === 0) {
      return
    }

    await onApply(image.id, strokes)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (isApplying || isPreparing || activePointerIdRef.current !== null) {
      return
    }

    const pointerPosition = getCanvasPointerPosition(event.clientX, event.clientY)

    if (!pointerPosition) {
      return
    }

    const radius = getBrushRadiusInImagePixels(pointerPosition)
    activePointerIdRef.current = event.pointerId
    draftStrokeRef.current = {
      points: [
        {
          x: pointerPosition.imageX,
          y: pointerPosition.imageY,
        },
      ],
      radius,
    }
    setHasDraftStroke(true)

    event.currentTarget.setPointerCapture(event.pointerId)
    updateBrushCursorFromPointerPosition(pointerPosition)
    schedulePreviewRender()
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const pointerPosition = getCanvasPointerPosition(event.clientX, event.clientY)
    updateBrushCursorFromPointerPosition(pointerPosition)

    if (activePointerIdRef.current !== event.pointerId || !draftStrokeRef.current) {
      return
    }

    if (!pointerPosition) {
      return
    }

    const lastPoint =
      draftStrokeRef.current.points[draftStrokeRef.current.points.length - 1] ?? null

    if (
      lastPoint &&
      Math.abs(lastPoint.x - pointerPosition.imageX) < 0.8 &&
      Math.abs(lastPoint.y - pointerPosition.imageY) < 0.8
    ) {
      return
    }

    draftStrokeRef.current = {
      ...draftStrokeRef.current,
      points: [
        ...draftStrokeRef.current.points,
        {
          x: pointerPosition.imageX,
          y: pointerPosition.imageY,
        },
      ],
    }
    setHasDraftStroke(true)
    schedulePreviewRender()
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }

    activePointerIdRef.current = null

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    updateBrushCursorFromPointerPosition(
      getCanvasPointerPosition(event.clientX, event.clientY),
    )
    commitDraftStroke()
  }

  function handlePointerCancel(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return
    }

    activePointerIdRef.current = null
    draftStrokeRef.current = null
    setHasDraftStroke(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    hideBrushCursor()
    schedulePreviewRender()
  }

  useEffect(() => {
    strokesRef.current = strokes
    schedulePreviewRender()
  }, [schedulePreviewRender, strokes])

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return
    }

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isApplying) {
        event.preventDefault()
        onClose()
        return
      }

      if (
        !isApplying &&
        (event.key.toLowerCase() === 'z' && (event.metaKey || event.ctrlKey))
      ) {
        event.preventDefault()
        handleUndo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousActiveElementRef.current?.focus()
    }
  }, [handleUndo, isApplying, isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !image) {
      return
    }

    sessionIdRef.current += 1
    const currentSessionId = sessionIdRef.current

    void createEditorAssets(image.file)
      .then((assets) => {
        if (sessionIdRef.current !== currentSessionId) {
          assets.release()
          return
        }

        editorAssetsRef.current = assets
        schedulePreviewRender()
      })
      .catch((error: unknown) => {
        if (sessionIdRef.current !== currentSessionId) {
          return
        }

        setEditorErrorMessage(
          error instanceof Error
            ? error.message
            : 'No pudimos preparar la herramienta de blur manual.',
        )
      })
      .finally(() => {
        if (sessionIdRef.current === currentSessionId) {
          setIsPreparing(false)
        }
      })

    return () => {
      sessionIdRef.current += 1
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current)
        renderFrameRef.current = null
      }
      cleanupEditorAssets()
    }
  }, [cleanupEditorAssets, image, isOpen, schedulePreviewRender])

  if (!isOpen || !image || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/88">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full flex-col"
      >
        <h2 id={titleId} className="sr-only">
          Blur manual para {image.file.name}
        </h2>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-end px-4 py-4 sm:px-6 sm:py-6">
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Cancelar blur manual"
            onClick={onClose}
            disabled={isApplying}
            className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white shadow-lg transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-28 pt-20 sm:px-6 sm:pb-32 sm:pt-24">
          <div
            ref={canvasContainerRef}
            className="relative inline-flex max-h-full max-w-full items-center justify-center"
          >
            <canvas
              ref={canvasRef}
              className={[
                'max-h-[calc(100vh-11rem)] max-w-full touch-none object-contain shadow-2xl',
                isPreparing ? 'opacity-0' : 'opacity-100',
                editorErrorMessage ? 'cursor-not-allowed' : 'cursor-none',
              ].join(' ')}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onPointerLeave={() => {
                if (activePointerIdRef.current === null) {
                  hideBrushCursor()
                }
              }}
            />

            {brushCursor.isVisible && !isPreparing && !editorErrorMessage ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  height: BRUSH_RADIUS_RENDERED * 2,
                  left: brushCursor.x,
                  top: brushCursor.y,
                  transform: 'translate(-50%, -50%)',
                  width: BRUSH_RADIUS_RENDERED * 2,
                }}
              >
                <div className="absolute inset-0 rounded-full border border-white/90 bg-black/5 shadow-[0_0_0_1px_rgba(15,23,42,0.55)]" />
                <div
                  className="absolute left-1/2 top-1/2 bg-white/95 shadow-[0_0_0_1px_rgba(15,23,42,0.7)]"
                  style={{
                    height: 1,
                    transform: 'translate(-50%, -50%)',
                    width: BRUSH_CENTER_MARK_SIZE,
                  }}
                />
                <div
                  className="absolute left-1/2 top-1/2 bg-white/95 shadow-[0_0_0_1px_rgba(15,23,42,0.7)]"
                  style={{
                    height: BRUSH_CENTER_MARK_SIZE,
                    transform: 'translate(-50%, -50%)',
                    width: 1,
                  }}
                />
              </div>
            ) : null}

            {isPreparing ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/6 backdrop-blur-sm">
                <div className="rounded-full bg-white/12 px-4 py-2 text-sm text-white shadow-lg">
                  Preparando editor...
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {(errorMessage || editorErrorMessage) ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4 sm:bottom-28">
            <div className="pointer-events-auto max-w-xl rounded-2xl border border-red-300/40 bg-red-500/18 px-4 py-3 text-sm text-red-50 shadow-lg backdrop-blur">
              {editorErrorMessage ?? errorMessage}
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 py-4 sm:px-6 sm:py-6">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 text-white">
            <button
              type="button"
              title="Deshacer"
              aria-label="Deshacer ultimo trazo"
              onClick={handleUndo}
              disabled={isApplying || (strokes.length === 0 && !hasDraftStroke)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/12 text-white shadow-lg backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <UndoIcon />
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={
                isApplying ||
                isPreparing ||
                Boolean(editorErrorMessage) ||
                strokes.length === 0
              }
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:bg-white/40 disabled:text-slate-700"
            >
              {isApplying ? 'Guardando blur...' : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default LocationManualBlurModal
