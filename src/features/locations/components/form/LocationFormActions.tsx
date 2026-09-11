import Button from '../../../../components/ui/Button'

type LocationFormActionsProps = {
  hasProcessingPendingImages: boolean
  isDropboxImporting: boolean
  isReadOnly: boolean
  isSubmitting: boolean
  mode: 'create' | 'edit' | 'view'
  onCancel: () => void
  processedImagesCount: number
  totalImagesToProcess: number
}

export default function LocationFormActions({
  hasProcessingPendingImages,
  isDropboxImporting,
  isReadOnly,
  isSubmitting,
  mode,
  onCancel,
  processedImagesCount,
  totalImagesToProcess,
}: LocationFormActionsProps) {
  if (isReadOnly) {
    return null
  }

  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
      <Button
        variant="secondary"
        onClick={onCancel}
        disabled={isSubmitting || hasProcessingPendingImages || isDropboxImporting}
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        disabled={isSubmitting || hasProcessingPendingImages || isDropboxImporting}
      >
        {isSubmitting
          ? mode === 'edit'
            ? 'Guardando cambios...'
            : 'Guardando...'
          : hasProcessingPendingImages
            ? `Procesando imagenes ${processedImagesCount} de ${totalImagesToProcess}...`
          : mode === 'edit'
            ? 'Guardar cambios'
            : 'Guardar locación'}
      </Button>
    </div>
  )
}
