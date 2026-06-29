const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://canopy.dev" : `https://${stage}.canopy.dev`,
  console: stage === "production" ? "https://canopy.dev/auth" : `https://${stage}.canopy.dev/auth`,
  email: "hello@canopy.dev",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/mateussiqueira/canopy",
  discord: "https://canopy.dev/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
