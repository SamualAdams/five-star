/* ============================================================================
   The design system's public surface.

   This is what gets bundled for claude.ai/design — the parts of the UI that are
   genuinely reusable, as opposed to the page components in ./components, which
   are application screens bound to the API and to auth.

   Most of this design system is CSS, not React: the tokens in theme.css and the
   class vocabulary in styles.css. See .design-sync/conventions.md for how to
   build with it. Only components that carry brand meaning a class can't express
   belong here.
   ============================================================================ */

export { default as BrandName, BrandedText } from "./components/BrandName.jsx";
