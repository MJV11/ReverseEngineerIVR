import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const OUTPUTS_DIR = resolve(__dirname, "..", "outputs");

function outputsApiPlugin(): Plugin {
  return {
    name: "outputs-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/outputs")) {
          next();
          return;
        }

        try {
          if (req.url === "/api/outputs" || req.url === "/api/outputs/") {
            const files = await readdir(OUTPUTS_DIR);
            const jsonFiles = files
              .filter((name) => name.endsWith(".json"))
              .sort()
              .reverse();
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(jsonFiles));
            return;
          }

          const match = req.url.match(/^\/api\/outputs\/([^?]+)/);
          if (!match) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }

          const fileName = decodeURIComponent(match[1]);
          if (!fileName.endsWith(".json") || fileName.includes("..")) {
            res.statusCode = 400;
            res.end("Invalid file name");
            return;
          }

          const body = await readFile(join(OUTPUTS_DIR, fileName), "utf8");
          res.setHeader("Content-Type", "application/json");
          res.end(body);
        } catch (error) {
          res.statusCode = 500;
          res.end(String(error));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), outputsApiPlugin()],
  server: {
    port: 5173,
  },
});
