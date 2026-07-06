import { useEffect, useMemo, useRef, useState } from 'react'

import type { LocationTagOption } from '../../locations.types'

type TagsEditorProps = {
  availableTags: LocationTagOption[]
  isDisabled: boolean
  isReadOnly: boolean
  onToggle: (tagId: string) => void
  selectedTags: LocationTagOption[]
  selectedTagIds: string[]
}

function TagsEditor({
  availableTags,
  isDisabled,
  isReadOnly,
  onToggle,
  selectedTags,
  selectedTagIds,
}: TagsEditorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const pickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isPickerOpen) {
      return
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        pickerRef.current &&
        event.target instanceof Node &&
        !pickerRef.current.contains(event.target)
      ) {
        setIsPickerOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
    }
  }, [isPickerOpen])

  const filteredTags = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase()

    return availableTags
      .filter((tag) => !selectedTagIds.includes(tag.id))
      .filter((tag) => {
        if (normalizedSearch.length === 0) {
          return true
        }

        return (
          tag.name.toLocaleLowerCase().includes(normalizedSearch) ||
          tag.slug.toLocaleLowerCase().includes(normalizedSearch)
        )
      })
      .sort((leftTag, rightTag) => leftTag.name.localeCompare(rightTag.name, 'es'))
  }, [availableTags, searchTerm, selectedTagIds])

  function handleTagSelect(tagId: string) {
    onToggle(tagId)
    setSearchTerm('')
    setIsPickerOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="relative" ref={pickerRef}>
        {selectedTags.length > 0 || !isReadOnly ? (
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[#B8924A]/30 bg-[#fff8eb] px-3 py-1.5 text-sm font-medium text-slate-800"
                >
                  <span>{tag.name}</span>
                  {!isReadOnly ? (
                    <button
                      type="button"
                      onClick={() => onToggle(tag.id)}
                      disabled={isDisabled}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 transition hover:bg-[#f3e4be] hover:text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(184,146,74,0.20)] disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Quitar tag ${tag.name}`}
                    >
                      ×
                    </button>
                  ) : null}
                </span>
              ))}
            </div>

            {!isReadOnly ? (
              <button
                type="button"
                onClick={() => setIsPickerOpen((currentValue) => !currentValue)}
                disabled={isDisabled}
                aria-label="Agregar tag"
                className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xl font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                +
              </button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-600">
            {isReadOnly
              ? 'Esta locación no tiene tags visibles.'
              : 'Todavía no hay tags seleccionados.'}
          </div>
        )}
        {!isReadOnly && isPickerOpen ? (
          <div className="absolute right-0 top-full z-30 mt-3 w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-3 shadow-xl">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar tag"
              autoComplete="off"
              className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />

            <div className="mt-3 max-h-[260px] space-y-1 overflow-x-hidden overflow-y-auto pr-1">
              {filteredTags.length > 0 ? (
                filteredTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleTagSelect(tag.id)}
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                  >
                    <span>{tag.name}</span>
                    {tag.group ? (
                      <span className="ml-3 text-xs uppercase tracking-[0.12em] text-slate-400">
                        {tag.group}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-sm text-slate-500">
                  No se encontraron tags disponibles.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default TagsEditor
