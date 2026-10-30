import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Extra build folders (NEXT_DIST_DIR=.next-<name>, parallel builds and tests).
    ".next-*/**",
    // The API is a separate CommonJS package (backend/package.json), not part of the Next.js app.
    "backend/**",
  ]),
]);

export default eslintConfig;
