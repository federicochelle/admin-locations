import { useEffect, useState } from 'react'
import {
  archiveCategory,
  deleteCategory,
  getCategories,
} from './categories.service'
import type { CategoryListItem } from './categories.types'

type UseCategoriesResult = {
  categories: CategoryListItem[]
  isLoading: boolean
  errorMessage: string | null
  actionErrorMessage: string | null
  activeActionKey: string | null
  loadCategories: () => Promise<void>
  retry: () => Promise<void>
  archive: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar las categorías en este momento.'
}

export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<CategoryListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)

  async function loadCategories() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextCategories = await getCategories()
      setCategories(nextCategories)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadCategories()
  }

  async function runCategoryAction(
    actionKey: string,
    action: () => Promise<string>,
  ) {
    try {
      setActiveActionKey(actionKey)
      setActionErrorMessage(null)

      await action()
      await loadCategories()
    } catch (error) {
      setActionErrorMessage(getErrorMessage(error))
    } finally {
      setActiveActionKey(null)
    }
  }

  async function archive(id: string) {
    await runCategoryAction(`archive:${id}`, () => archiveCategory(id))
  }

  async function remove(id: string) {
    await runCategoryAction(`delete:${id}`, () => deleteCategory(id))
  }

  useEffect(() => {
    let isActive = true

    void getCategories()
      .then((nextCategories) => {
        if (!isActive) {
          return
        }

        setCategories(nextCategories)
        setErrorMessage(null)
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return
        }

        setErrorMessage(getErrorMessage(error))
      })
      .finally(() => {
        if (!isActive) {
          return
        }

        setIsLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [])

  return {
    categories,
    isLoading,
    errorMessage,
    actionErrorMessage,
    activeActionKey,
    loadCategories,
    retry,
    archive,
    remove,
  }
}
