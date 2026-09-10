type LocationImageFeedbackProps = {
  errors: string[]
}

export default function LocationImageFeedback({
  errors,
}: LocationImageFeedbackProps) {
  if (errors.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ul className="space-y-1">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
