import yargs from "yargs"
import { TuiThreadCommand } from "./cli/cmd/tui/thread"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { hideBin } from "yargs/helpers"

const args = hideBin(process.argv)
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR"

function flag(name: string) {
  const index = args.indexOf(name)
  if (index >= 0) return args[index + 1]
  const value = args.find((arg) => arg.startsWith(name + "="))
  return value?.slice(name.length + 1)
}

function parseLogLevel(value: string | undefined): LogLevel | undefined {
  if (value === "DEBUG" || value === "INFO" || value === "WARN" || value === "ERROR") return value
  return undefined
}

if (args.includes("--print-logs")) process.env.OPENCODE_PRINT_LOGS = "1"
const logFile = flag("--log-file")
if (logFile) process.env.OPENCODE_LOG_FILE = logFile
const logLevel = parseLogLevel(flag("--log-level"))
if (logLevel) process.env.OPENCODE_LOG_LEVEL = logLevel

const cli = yargs(args)
  .parserConfiguration({ "populate--": true })
  .scriptName("opencode")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-file", {
    describe: "path to JSONL log file",
    type: "string",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("pure", {
    describe: "run without external plugins",
    type: "boolean",
  })
  .command(TuiThreadCommand)
  .parse()
