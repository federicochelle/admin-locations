import { useEffect, useState } from 'react'
import {
  getAdminProductionCompanies,
} from '../production-companies/production-companies.service'
import type { ProductionCompanyListItem } from '../production-companies/production-companies.types'

type UseAdminProductionCompaniesResult = {
  companies: ProductionCompanyListItem[]
  errorMessage: string | null
  isLoading: boolean
  retry: () => Promise<void>
  reload: () => Promise<void>
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'No pudimos cargar las productoras en este momento.'
}

export function useAdminProductionCompanies(): UseAdminProductionCompaniesResult {
  const [companies, setCompanies] = useState<ProductionCompanyListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function loadCompanies() {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const nextCompanies = await getAdminProductionCompanies()
      setCompanies(nextCompanies)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isActive = true

    void getAdminProductionCompanies()
      .then((nextCompanies) => {
        if (!isActive) {
          return
        }

        setCompanies(nextCompanies)
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
    companies,
    errorMessage,
    isLoading,
    retry: loadCompanies,
    reload: loadCompanies,
  }
}
