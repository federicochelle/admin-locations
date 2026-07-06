type DescriptionEditorProps = {
  className: string
  description: string
  isReadOnly: boolean
  onChange: (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void
}

function DescriptionEditor({
  className,
  description,
  isReadOnly,
  onChange,
}: DescriptionEditorProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-base font-semibold text-slate-950">Descripción</h4>
      <div>
        <label htmlFor="description" className="sr-only">
          Descripción
        </label>
        <textarea
          id="description"
          name="description"
          className={className}
          value={description}
          onChange={onChange}
          readOnly={isReadOnly}
          rows={5}
        />
      </div>
    </div>
  )
}

export default DescriptionEditor
