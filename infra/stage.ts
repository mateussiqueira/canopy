export const domain = (() => {
  if ($app.stage === "production") return "canopy.dev"
  if ($app.stage === "dev") return "dev.canopy.dev"
  return `${$app.stage}.dev.canopy.dev`
})()

export const zoneID = "430ba34c138cfb5360826c4909f99be8"
export const awsStage = $app.stage === "production" ? "production" : "dev"
export const deployAws = $app.stage === awsStage

new cloudflare.RegionalHostname("RegionalHostname", {
  hostname: domain,
  regionKey: "us",
  zoneId: zoneID,
})

export const shortDomain = (() => {
  if ($app.stage === "production") return "canopy.dev"
  if ($app.stage === "dev") return "dev.canopy.dev"
  return `${$app.stage}.dev.canopy.dev`
})()
