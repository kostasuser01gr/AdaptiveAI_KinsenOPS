import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- path is server-controlled literal, not user input
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Hashed assets get long-lived cache; HTML/SW get revalidation
  app.use(express.static(distPath, {
    maxAge: '1y',
    immutable: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // fall through to index.html if the file doesn't exist (but not for /api routes)
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ message: 'Not found' });
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
