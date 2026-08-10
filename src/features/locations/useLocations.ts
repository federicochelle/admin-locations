import { useEffect, useState } from 'react'
import {
  archiveLocation,
  deleteLocation,
  getLocationsPage,
  publishLocation,
} from './locations.service'
import type {
  LocationListItem,
  LocationSortDirection,
  LocationSortKey,
} from './locations.types'

const PAGE_SIZE = 30

type UseLocationsResult = {
  locations: LocationListItem[]
  totalCount: number
  currentPage: number
  pageSize: number
  searchTerm: string
  sortKey: LocationSortKey
  sortDirection: LocationSortDirection
  isLoading: boolean
  errorMessage: string | null
  actionErrorMessage: string | null
  activeActionKey: string | null
  loadLocations: () => Promise<void>
  retry: () => Promise<void>
  setCurrentPage: (page: number) => void
  setSearchTerm: (value: string) => void
  setSort: (key: LocationSortKey) => void
  archive: (id: string) => Promise<void>
  publish: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar las locaciones en este momento.'
}

export function useLocations(): UseLocationsResult {
  const [locations, setLocations] = useState<LocationListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPageState] = useState(1)
  const [searchTerm, setSearchTermState] = useState('')
  const [sortKey, setSortKey] = useState<LocationSortKey>('locationCode')
  const [sortDirection, setSortDirection] = useState<LocationSortDirection>('asc')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)

  function setCurrentPage(page: number) {
    setCurrentPageState(Math.max(1, page))
  }

  async function fetchLocationsPage(page: number) {
    const result = await getLocationsPage({
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

  async function loadLocations() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const result = await fetchLocationsPage(currentPage)

      if (!result) {
        return
      }

      setLocations(result.locations)
      setTotalCount(result.totalCount)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  async function retry() {
    await loadLocations()
  }

  async function runLocationAction(
    actionKey: string,
    action: () => Promise<string>,
  ) {
    try {
      setActiveActionKey(actionKey)
      setActionErrorMessage(null)

      await action()
      await loadLocations()
    } catch (error) {
      setActionErrorMessage(getErrorMessage(error))
    } finally {
      setActiveActionKey(null)
    }
  }

  async function archive(id: string) {
    await runLocationAction(`archive:${id}`, () => archiveLocation(id))
  }

  async function publish(id: string) {
    await runLocationAction(`publish:${id}`, () => publishLocation(id))
  }

  async function remove(id: string) {
    await runLocationAction(`delete:${id}`, () => deleteLocation(id))
  }

  function setSearchTerm(value: string) {
    setSearchTermState(value)
    setCurrentPageState(1)
  }

  function setSort(nextSortKey: LocationSortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === 'asc' ? 'desc' : 'asc',
      )
      return
    }

    setSortKey(nextSortKey)
    setSortDirection('asc')
  }

  useEffect(() => {
    let isActive = true

    void fetchLocationsPage(currentPage)
      .then((result) => {
        if (!isActive || !result) {
          return
        }

        setLocations(result.locations)
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
    locations,
    totalCount,
    currentPage,
    pageSize: PAGE_SIZE,
    searchTerm,
    sortKey,
    sortDirection,
    isLoading,
    errorMessage,
    actionErrorMessage,
    activeActionKey,
    loadLocations,
    retry,
    setCurrentPage,
    setSearchTerm,
    setSort,
    archive,
    publish,
    remove,
  }
}
