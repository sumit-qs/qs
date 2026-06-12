import { context } from "esbuild";

async function buildAndWatch() {
  const ctx = await context({
    entryPoints: {
      scripts: "scripts.js",
      "locale-redirect": "config/locale-redirect.js",
    },
    outdir: ".",
    entryNames: "[name].min",
    minify: true,
    bundle: true,
    sourcemap: false,
    format: "iife",
    target: "es6",
  });

  // Enable watch mode
  await ctx.watch();

  console.log("Watching for changes...");
}

buildAndWatch().catch((err) => {
  console.error(err);
  process.exit(1);
});