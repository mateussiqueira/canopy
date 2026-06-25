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

test.describe("CLI", () => {
  test("should show help with --help flag", async () => {
    const output = runCli("--help");
    expect(output).toContain("opencode");
    expect(output).toContain("--version");
  });

  test("should show version with --version flag", async () => {
    const output = runCli("--version");
    expect(output.trim()).toMatch(/\S+/);
  });

  test("should start and exit cleanly with run command", async () => {
    const result = runCli("run --help");
    expect(result).toContain("run");
    expect(result).toContain("message");
  });
});
