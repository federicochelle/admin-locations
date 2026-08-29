import { useMemo, useState } from 'react'
import { useLayoutHeader } from '../../app/layouts/useLayoutHeader'
import { useAdminFeedback } from '../../components/ui/admin-feedback/useAdminFeedback'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import PageContainer from '../../components/ui/PageContainer'
import {
  createProductionCompany,
  deleteProductionCompany,
  updateProductionCompany,
  uploadProductionCompanyLogo,
} from '../production-companies/production-companies.service'
import type {
  ProductionCompanyFormValues,
  ProductionCompanyListItem,
} from '../production-companies/production-companies.types'
import ProductionCompaniesTable from './ProductionCompaniesTable'
import ProductionCompanyModal from './ProductionCompanyModal'
import { useAdminProductionCompanies } from './useAdminProductionCompanies'
import UsersTable from './UsersTable'
import { useUsers } from './useUsers'

type UsersTab = 'users' | 'production-companies'

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl px-4 py-2 text-sm font-medium transition',
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function UsersPage() {
  const { alert, confirm, showError, withLoading } = useAdminFeedback()
  const [activeTab, setActiveTab] = useState<UsersTab>('users')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [selectedCompany, setSelectedCompany] = useState<ProductionCompanyListItem | null>(null)
  const [productionCompanyActionError, setProductionCompanyActionError] = useState<string | null>(null)
  const [isSavingProductionCompany, setIsSavingProductionCompany] = useState(false)
  const {
    errorMessage,
    isLoading,
    users,
    retry,
  } = useUsers()
  const {
    companies,
    errorMessage: productionCompaniesErrorMessage,
    isLoading: isLoadingProductionCompanies,
    reload: reloadProductionCompanies,
    retry: retryProductionCompanies,
  } = useAdminProductionCompanies()

  const headerConfig = useMemo(
    () => ({
      breadcrumbItems: [{ label: 'Usuarios' }],
      title: 'Usuarios',
      description:
        'Vista inicial para revisar las cuentas registradas dentro del panel administrador.',
    }),
    [],
  )

  useLayoutHeader(headerConfig)

  const sectionToggle = (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white/90 p-1 shadow-sm">
      <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
        Usuarios
      </TabButton>
      <TabButton
        active={activeTab === 'production-companies'}
        onClick={() => setActiveTab('production-companies')}
      >
        Productoras
      </TabButton>
    </div>
  )

  function handleOpenCreateCompany() {
    setProductionCompanyActionError(null)
    setSelectedCompany(null)
    setModalMode('create')
    setIsModalOpen(true)
  }

  function handleOpenEditCompany(company: ProductionCompanyListItem) {
    setProductionCompanyActionError(null)
    setSelectedCompany(company)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  function handleCloseModal() {
    if (isSavingProductionCompany) {
      return
    }

    setIsModalOpen(false)
    setSelectedCompany(null)
    setProductionCompanyActionError(null)
  }

  async function handleSubmitCompany(
    values: ProductionCompanyFormValues,
    logoFile: File | null,
  ) {
    try {
      setIsSavingProductionCompany(true)
      setProductionCompanyActionError(null)

      let companyId = selectedCompany?.id ?? null
      let savedCompany = selectedCompany

      if (modalMode === 'create') {
        const createdCompany = await createProductionCompany(values)
        companyId = createdCompany.id
        savedCompany = createdCompany
        setSelectedCompany(createdCompany)
        setModalMode('edit')
      } else {
        if (!companyId) {
          throw new Error('Falta la productora a editar.')
        }

        savedCompany = await updateProductionCompany(companyId, values)
        setSelectedCompany(savedCompany)
      }

      if (!companyId) {
        throw new Error('No pudimos identificar la productora a guardar.')
      }

      if (logoFile) {
        try {
          await uploadProductionCompanyLogo({
            productionCompanyId: companyId,
            file: logoFile,
          })
        } catch (error) {
          if (savedCompany) {
            setSelectedCompany(savedCompany)
            setModalMode('edit')
          }

          throw new Error(
            `La productora se guardo, pero falló la carga del logo: ${
              error instanceof Error
                ? error.message
                : 'No pudimos subir el logo.'
            }`,
            {
              cause: error,
            },
          )
        }
      }

      await reloadProductionCompanies()
      setIsModalOpen(false)
      setSelectedCompany(null)
    } catch (error) {
      setProductionCompanyActionError(
        error instanceof Error
          ? error.message
          : 'No pudimos guardar la productora.',
      )
    } finally {
      setIsSavingProductionCompany(false)
    }
  }

  async function handleDeleteCompany(company: ProductionCompanyListItem) {
    const shouldDelete = await confirm({
      variant: 'danger',
      title: 'Eliminar productora',
      description: `¿Seguro que querés eliminar la productora "${company.name}"?`,
      confirmLabel: 'Eliminar productora',
      cancelLabel: 'Cancelar',
    })

    if (!shouldDelete) {
      return
    }

    try {
      setProductionCompanyActionError(null)

      await withLoading({
        title: 'Eliminar productora',
        description: 'Estamos procesando la eliminación de la productora.',
        progress: {
          enabled: true,
        },
        action: async () => {
          await deleteProductionCompany(company.id)
          await reloadProductionCompanies()
        },
      })

      if (selectedCompany?.id === company.id) {
        setSelectedCompany(null)
        setIsModalOpen(false)
      }

      await alert({
        variant: 'success',
        title: 'Productora eliminada',
        hideProgressBar: true,
        hideProgressPercentage: true,
        iconVariant: 'success',
        progressPercentage: 100,
        closeLabel: 'Entendido',
      })
    } catch (error) {
      await showError({
        title: 'No pudimos eliminar la productora',
        description:
          error instanceof Error && error.message.trim()
            ? error.message
            : 'No pudimos eliminar la productora.',
        closeLabel: 'Entendido',
      })
    }
  }

  return (
    <PageContainer
      title="Usuarios"
      description="Vista inicial para revisar las cuentas registradas dentro del panel administrador."
      hideHeader
    >
      {activeTab === 'users' && isLoading ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando usuarios...</p>
          </div>
        </Card>
      ) : null}

      {activeTab === 'users' && !isLoading && errorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar los usuarios
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {errorMessage}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void retry()}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : null}

      {activeTab === 'users' && !isLoading && !errorMessage && users.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <EmptyState
            title="Todavía no hay usuarios visibles"
            description="Cuando existan perfiles accesibles para este admin, acá aparecerá el listado."
          />
        </Card>
      ) : null}

      {activeTab === 'users' && !isLoading && !errorMessage && users.length > 0 ? (
        <UsersTable headerCenter={sectionToggle} users={users} />
      ) : null}

      {activeTab === 'production-companies' && isLoadingProductionCompanies ? (
        <Card>
          <div className="flex min-h-48 items-center justify-center">
            <p className="text-sm text-slate-600">Cargando productoras...</p>
          </div>
        </Card>
      ) : null}

      {activeTab === 'production-companies' &&
      !isLoadingProductionCompanies &&
      productionCompaniesErrorMessage ? (
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No pudimos cargar las productoras
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {productionCompaniesErrorMessage}
              </p>
            </div>
            <Button variant="secondary" onClick={() => void retryProductionCompanies()}>
              Reintentar
            </Button>
          </div>
        </Card>
      ) : null}

      {activeTab === 'production-companies' &&
      !isLoadingProductionCompanies &&
      !productionCompaniesErrorMessage ? (
        <>
          {productionCompanyActionError ? (
            <Card className="border-red-200 bg-red-50/70">
              <p className="text-sm text-red-700">{productionCompanyActionError}</p>
            </Card>
          ) : null}

          {companies.length === 0 ? (
            <Card className="p-4 sm:p-6">
              <EmptyState
                title="Todavía no hay productoras cargadas"
                description="Podés crear la primera productora desde esta misma sección."
              >
                <Button onClick={handleOpenCreateCompany} disabled={isSavingProductionCompany}>
                  Nueva productora
                </Button>
              </EmptyState>
            </Card>
          ) : (
            <ProductionCompaniesTable
              companies={companies}
              headerCenter={sectionToggle}
              isSaving={isSavingProductionCompany}
              onCreate={handleOpenCreateCompany}
              onDelete={(company) => {
                void handleDeleteCompany(company)
              }}
              onEdit={handleOpenEditCompany}
            />
          )}
        </>
      ) : null}

      <ProductionCompanyModal
        errorMessage={productionCompanyActionError}
        isOpen={isModalOpen}
        isSubmitting={isSavingProductionCompany}
        mode={modalMode}
        company={selectedCompany}
        onClose={handleCloseModal}
        onSubmit={handleSubmitCompany}
      />
    </PageContainer>
  )
}

export default UsersPage
