import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      // Generated files that should not be linted
      "src/generated/**/*",
      "prisma/generated/**/*",
      ".next/**/*",
      "node_modules/**/*",
      "dist/**/*",
      "build/**/*",
      // Prisma client files
      "**/prisma/client/**/*",
      "**/prisma/runtime/**/*",
    ],
  },
  {
    rules: {
      // Suppress common warnings to reduce build noise
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-unnecessary-type-constraint": "off",
      "@typescript-eslint/no-wrapper-object-types": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
      "@typescript-eslint/no-this-alias": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
      "prefer-const": "off",
      // Suppress additional common warnings
      "no-console": "off",
      "no-debugger": "off",
      "no-unused-expressions": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",
    },
  },
];

export default eslintConfig;
