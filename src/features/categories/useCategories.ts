import { useEffect, useState } from 'react'
import {
  archiveCategory,
  deleteCategory,
  getCategoriesPage,
} from './categories.service'
import type {
  CategoryListItem,
  CategorySortDirection,
  CategorySortKey,
} from './categories.types'

const PAGE_SIZE = 30

type UseCategoriesResult = {
  categories: CategoryListItem[]
  currentPage: number
  pageSize: number
  totalCount: number
  searchTerm: string
  sortKey: CategorySortKey
  sortDirection: CategorySortDirection
  isLoading: boolean
  errorMessage: string | null
  actionErrorMessage: string | null
  activeActionKey: string | null
  loadCategories: () => Promise<void>
  retry: () => Promise<void>
  setCurrentPage: (page: number) => void
  setSearchTerm: (value: string) => void
  setSort: (key: CategorySortKey) => void
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
  const [currentPage, setCurrentPageState] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTermState] = useState('')
  const [sortKey, setSortKey] = useState<CategorySortKey>('name')
  const [sortDirection, setSortDirection] = useState<CategorySortDirection>('asc')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)

  function setCurrentPage(page: number) {
    setCurrentPageState(Math.max(1, page))
  }

  function setSearchTerm(value: string) {
    setSearchTermState(value)
    setCurrentPageState(1)
  }

  function setSort(nextSortKey: CategorySortKey) {
    setCurrentPageState(1)

    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === 'asc' ? 'desc' : 'asc',
      )
      return
    }

    setSortKey(nextSortKey)
    setSortDirection('asc')
  }

  async function fetchCategoriesPage(page: number) {
    const result = await getCategoriesPage({
      page,
      pageSize: PAGE_SIZE,
      searchTerm,
      sortKey,
      sortDirection,
    })
    const lastAvailablePage = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))

    if (page > lastAvailablePage) {
      setCurrentPageState(lastAvailablePage)
      return null
    }

    return result
  }

  async function loadCategories() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const result = await fetchCategoriesPage(currentPage)

      if (!result) {
        return
      }

      setCategories(result.items)
      setTotalCount(result.totalCount)
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

    void getCategoriesPage({
      page: currentPage,
      pageSize: PAGE_SIZE,
      searchTerm,
      sortKey,
      sortDirection,
    })
      .then((result) => {
        if (!isActive) {
          return
        }

        const lastAvailablePage = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))

        if (currentPage > lastAvailablePage) {
          setCurrentPageState(lastAvailablePage)
          return
        }

        setCategories(result.items)
        setTotalCount(result.totalCount)
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
  }, [currentPage, searchTerm, sortDirection, sortKey])

  return {
    categories,
    currentPage,
    pageSize: PAGE_SIZE,
    totalCount,
    searchTerm,
    sortKey,
    sortDirection,
    isLoading,
    errorMessage,
    actionErrorMessage,
    activeActionKey,
    loadCategories,
    retry,
    setCurrentPage,
    setSearchTerm,
    setSort,
    archive,
    remove,
  }
}
