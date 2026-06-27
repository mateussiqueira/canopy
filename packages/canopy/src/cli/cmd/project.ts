import type { CommandModule } from "yargs"
import { createMultiProjectService } from "@canopystack/core/multi-project"

export const project: CommandModule = {
  command: "projects",
  describe: "Manage Canopy projects",
  builder: (yargs) =>
    yargs
      .command({
        command: "list",
        describe: "List all projects",
        handler: () => {
          const mp = createMultiProjectService()
          const projects = mp.listProjects()

          if (projects.length === 0) {
            console.log("No projects found. Create one with: canopy project create")
            return
          }

          console.log("Projects:")
          console.log("─".repeat(60))
          for (const p of projects) {
            const lastAccessed = new Date(p.lastAccessedAt).toLocaleDateString()
            console.log(`  ${p.id}  ${p.name.padEnd(20)}  ${p.path}`)
            console.log(`           Last accessed: ${lastAccessed}`)
            if (p.context && Object.keys(p.context).length > 0) {
              console.log(`           Context keys: ${Object.keys(p.context).join(", ")}`)
            }
            console.log()
          }
        },
      })
      .command({
        command: "create <name> [path]",
        describe: "Create a new project",
        handler: (args) => {
          const mp = createMultiProjectService()
          const projectPath = (args.path as string) || process.cwd()

          const project = mp.createProject({
            name: args.name as string,
            path: projectPath,
          })

          console.log(`Created project: ${project.name}`)
          console.log(`  ID: ${project.id}`)
          console.log(`  Path: ${project.path}`)
        },
      })
      .command({
        command: "switch <id>",
        describe: "Switch to a project",
        handler: (args) => {
          const mp = createMultiProjectService()
          const project = mp.switchProject(args.id as string)

          if (!project) {
            console.log(`Project not found: ${args.id}`)
            return
          }

          console.log(`Switched to project: ${project.name}`)
          console.log(`  ID: ${project.id}`)
          console.log(`  Path: ${project.path}`)
        },
      })
      .command({
        command: "current",
        describe: "Show current project",
        handler: () => {
          const mp = createMultiProjectService()
          const project = mp.getCurrentProject()

          if (!project) {
            console.log("No project selected. Use: canopy project switch <id>")
            return
          }

          console.log(`Current project: ${project.name}`)
          console.log(`  ID: ${project.id}`)
          console.log(`  Path: ${project.path}`)
          console.log(`  Last accessed: ${new Date(project.lastAccessedAt).toLocaleString()}`)
        },
      })
      .command({
        command: "delete <id>",
        describe: "Delete a project",
        handler: (args) => {
          const mp = createMultiProjectService()
          mp.deleteProject(args.id as string)
          console.log(`Deleted project: ${args.id}`)
        },
      })
      .command({
        command: "context",
        describe: "Manage project context",
        builder: (yargs) =>
          yargs
            .command({
              command: "get [id]",
              describe: "Get project context",
              handler: (args) => {
                const mp = createMultiProjectService()
                let projectId = args.id as string | undefined

                if (!projectId) {
                  const current = mp.getCurrentProject()
                  if (!current) {
                    console.log("No project selected. Use: canopy projects switch <id>")
                    return
                  }
                  projectId = current.id
                }

                const context = mp.getProjectContext(projectId)

                if (Object.keys(context).length === 0) {
                  console.log("No context stored for this project.")
                  return
                }

                console.log(`Context for project ${projectId}:`)
                console.log("─".repeat(60))
                for (const [key, value] of Object.entries(context)) {
                  console.log(`  ${key}: ${value}`)
                }
              },
            })
            .command({
              command: "set <key> <value> [id]",
              describe: "Set project context",
              handler: (args) => {
                const mp = createMultiProjectService()
                let projectId = args.id as string | undefined

                if (!projectId) {
                  const current = mp.getCurrentProject()
                  if (!current) {
                    console.log("No project selected. Use: canopy projects switch <id>")
                    return
                  }
                  projectId = current.id
                }

                const success = mp.updateProjectContext(projectId, {
                  [args.key as string]: args.value as string,
                })

                if (success) {
                  console.log(`Set context ${args.key}=${args.value} for project ${projectId}`)
                } else {
                  console.log(`Project not found: ${projectId}`)
                }
              },
            })
            .demandCommand(1, "Specify a command: get or set"),
      })
      .demandCommand(1, "Specify a command: list, create, switch, current, delete, or context"),
  handler: () => {},
}
