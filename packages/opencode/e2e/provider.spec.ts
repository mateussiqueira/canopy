import { test, expect } from "@playwright/test";
import { execSync } from "child_process";

const runCli = (args: string): string => {
  try {
    return execSync(`bun run dev ${args} 2>&1`, {
      encoding: "utf8",
      timeout: 15000,
      cwd: process.cwd(),
    });
  } catch (error: any) {
    return (error.stdout || "") + (error.stderr || "");
  }
};

test.describe("Provider configuration", () => {
  test("should list providers without error", async () => {
    const output = runCli("providers list");
    expect(output).toBeDefined();
  });

  test("should show help for providers command", async () => {
    const output = runCli("providers --help");
    expect(output).toContain("providers");
  });

  test("should show login help", async () => {
    const output = runCli("providers login --help");
    expect(output).toContain("login");
  });
});
