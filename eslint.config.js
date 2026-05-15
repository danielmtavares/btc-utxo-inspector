import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "separate-type-imports",
          prefer: "type-imports",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "function",
          format: ["camelCase"],
        },
        {
          selector: "variable",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "memberLike",
          modifiers: ["private"],
          format: ["camelCase"],
          leadingUnderscore: "forbid",
        },
        {
          selector: "property",
          format: ["camelCase", "snake_case"],
        },
        {
          selector: "enumMember",
          format: ["PascalCase"],
        },
      ],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@stylistic/arrow-parens": ["error", "as-needed"],
      "@stylistic/brace-style": ["error", "stroustrup", { allowSingleLine: true }],
      "@stylistic/comma-dangle": ["error", "always-multiline"],
      "@stylistic/indent": ["error", 2],
      "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
      "@stylistic/semi": ["error", "always"],
    },
  },
  {
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
