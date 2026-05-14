import { Schema } from "effect"
import { Account } from "@/account/account"
import { Installation } from "@/installation"
import { ShareNext } from "@/share/share-next"
import { Discovery } from "@/skill/discovery"
import { SimulationNetwork, type ResponseEntry } from "./network"

function trim(url: string) {
  return url.replace(/\/+$/, "")
}

const GeneratedModel = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  release_date: Schema.String,
  attachment: Schema.Boolean,
  reasoning: Schema.Boolean,
  temperature: Schema.Boolean,
  tool_call: Schema.Boolean,
  limit: Schema.Struct({
    context: Schema.Finite,
    output: Schema.Finite,
  }),
})

const GeneratedProviderCatalog = Schema.Record(
  Schema.String,
  Schema.Struct({
    name: Schema.String,
    env: Schema.Array(Schema.String),
    id: Schema.String,
    models: Schema.Record(Schema.String, GeneratedModel),
  }),
)

export function account(baseUrl: string): ResponseEntry[] {
  const base = trim(baseUrl)
  return [
    SimulationNetwork.jsonSchema({ method: "POST", url: `${base}/auth/device/code` }, Account.DeviceAuth),
    SimulationNetwork.jsonSchema({ method: "POST", url: `${base}/auth/device/token` }, Account.DeviceToken),
    SimulationNetwork.jsonSchema({ method: "GET", url: `${base}/api/orgs` }, Schema.Array(Account.Org)),
    SimulationNetwork.jsonSchema({ method: "GET", url: `${base}/api/user` }, Account.User),
    SimulationNetwork.jsonSchema({ method: "GET", url: `${base}/api/config` }, Account.RemoteConfig),
  ]
}

export function models(baseUrl = "https://models.dev"): ResponseEntry[] {
  return [SimulationNetwork.jsonSchema({ method: "GET", url: `${trim(baseUrl)}/api.json` }, GeneratedProviderCatalog)]
}

export function share(baseUrl = "https://opncd.ai"): ResponseEntry[] {
  const base = trim(baseUrl)
  return [
    SimulationNetwork.jsonSchema({ method: "POST", url: `${base}/api/share` }, ShareNext.ShareSchema),
    SimulationNetwork.status({ method: "POST", url: /\/api\/share\/[^/]+\/sync$/ }, 204),
    SimulationNetwork.status({ method: "DELETE", url: /\/api\/share\/[^/]+$/ }, 204),
    SimulationNetwork.jsonSchema({ method: "POST", url: `${base}/api/shares` }, ShareNext.ShareSchema),
    SimulationNetwork.status({ method: "POST", url: /\/api\/shares\/[^/]+\/sync$/ }, 204),
    SimulationNetwork.status({ method: "DELETE", url: /\/api\/shares\/[^/]+$/ }, 204),
  ]
}

export function skills(baseUrl: string): ResponseEntry[] {
  const base = trim(baseUrl)
  return [
    SimulationNetwork.jsonSchema({ method: "GET", url: `${base}/index.json` }, Discovery.Index),
    SimulationNetwork.text({ method: "GET", url: /\/SKILL\.md$/ }, "# Generated Skill\n"),
  ]
}

export function installation(registryUrl = "https://registry.npmjs.org"): ResponseEntry[] {
  return [
    SimulationNetwork.text({ method: "GET", url: "https://opencode.ai/install" }, "#!/usr/bin/env bash\n"),
    SimulationNetwork.jsonSchema(
      { method: "GET", url: "https://formulae.brew.sh/api/formula/opencode.json" },
      Installation.BrewFormula,
    ),
    SimulationNetwork.jsonSchema(
      { method: "GET", url: `${trim(registryUrl)}/opencode-ai/latest` },
      Installation.NpmPackage,
    ),
    SimulationNetwork.jsonSchema(
      { method: "GET", url: "https://community.chocolatey.org/api/v2/Packages?$filter=Id%20eq%20%27opencode%27%20and%20IsLatestVersion&$select=Version" },
      Installation.ChocoPackage,
    ),
    SimulationNetwork.jsonSchema(
      { method: "GET", url: "https://raw.githubusercontent.com/ScoopInstaller/Main/master/bucket/opencode.json" },
      Installation.ScoopManifest,
    ),
    SimulationNetwork.jsonSchema(
      { method: "GET", url: "https://api.github.com/repos/anomalyco/opencode/releases/latest" },
      Installation.GitHubRelease,
    ),
  ]
}

export function defaults() {
  return [...models(), ...share(), ...installation()]
}

export * as SimulationNetworkRoutes from "./network-routes"
