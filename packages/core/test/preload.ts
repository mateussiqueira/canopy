import path from "path"

process.env.CANOPY_DB = ":memory:"
process.env.CANOPY_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.CANOPY_DISABLE_MODELS_FETCH = "true"
