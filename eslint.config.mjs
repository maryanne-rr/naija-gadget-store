import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // The Expo app.
  //
  // It is a React Native codebase being linted by a web config, and several rules
  // here are not merely inapplicable but wrong about it:
  //
  //   jsx-a11y/alt-text  wants an `alt` prop on <img>. React Native has no <img>;
  //                      its Image takes accessibilityLabel, and passing alt does
  //                      nothing at all. Every product photo in the app would need
  //                      a meaningless prop to satisfy it.
  //   @next/next/*        assumes a Next.js app with pages and a router. The app
  //                      has neither.
  //
  // It is also why lint was clean before this existed. mobile/ was excluded from
  // tsconfig.json for the Vercel build, and eslint had started picking it up as
  // soon as the folder existed - it just reported nothing until the app grew a
  // real violation to find.
  {
    files: ["mobile/**/*.{ts,tsx}"],
    rules: {
      "jsx-a11y/alt-text": "off",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Generated web builds of the app. `expo export --platform web` writes a
    // 600 kB bundled and minified JavaScript file here, and linting it produces
    // hundreds of warnings about Metro's own __BUNDLE_START_TIME__ and friends.
    // It is build output, not source, and it is regenerated on every export.
    "mobile/.expo/**",
    "mobile/.expo-web-preview/**",
    "mobile/dist/**",
  ]),
]);

export default eslintConfig;
