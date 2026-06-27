declare global {
  const CANOPY_VERSION: string
  const CANOPY_CHANNEL: string
}

export const InstallationVersion = typeof CANOPY_VERSION === "string" ? CANOPY_VERSION : "local"
export const InstallationChannel = typeof CANOPY_CHANNEL === "string" ? CANOPY_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
