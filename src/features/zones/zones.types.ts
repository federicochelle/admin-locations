export type ZoneCreatePayload = {
  name: string
  slug: string
  department_id: string
  active: boolean
  department?: string | null
  lat?: number | null
  lng?: number | null
}
