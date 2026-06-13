import {
  getCategoryEditPath,
  getLocationEditPath,
  getOwnerEditPath,
} from '../../app/router/route-paths'
import type { ActivityLogAction, ActivityLogListItem } from './activity-logs.service'

export function formatRelativeCreatedAt(value: string) {
  const createdAt = new Date(value)
  const diffMs = Date.now() - createdAt.getTime()

  if (Number.isNaN(createdAt.getTime()) || diffMs < 0) {
    return 'Hace instantes'
  }

  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.floor(diffMs / minute))
    return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
  }

  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour)
    return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  }

  const days = Math.floor(diffMs / day)
  return `Hace ${days} ${days === 1 ? 'día' : 'días'}`
}

export function formatActivityEntityName(log: Pick<ActivityLogListItem, 'entity_type' | 'entity_name'>) {
  if (log.entity_type === 'location') {
    return log.entity_name.replaceAll('-', ' ')
  }

  return log.entity_name
}

export function getActivityActionLabel(action: ActivityLogAction | string | null) {
  if (action === 'deleted') {
    return 'eliminó'
  }

  if (action === 'created') {
    return 'creó'
  }

  if (action === 'updated') {
    return 'editó'
  }

  return 'actualizó'
}

export function getActivityEntityPath(log: Pick<ActivityLogListItem, 'action' | 'entity_id' | 'entity_type'>) {
  if (log.action === 'deleted' || !log.entity_id) {
    return null
  }

  if (log.entity_type === 'location') {
    return getLocationEditPath(log.entity_id)
  }

  if (log.entity_type === 'owner') {
    return getOwnerEditPath(log.entity_id)
  }

  if (log.entity_type === 'category') {
    return getCategoryEditPath(log.entity_id)
  }

  return null
}
