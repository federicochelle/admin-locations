function getRequiredEnv(name: keyof ImportMetaEnv) {
  const value = import.meta.env[name]

  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}.`)
  }

  return value
}

export function getGoogleMapsApiKey() {
  return getRequiredEnv('VITE_GOOGLE_MAPS_API_KEY')
}
