import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Vercel Deployment API
  app.post("/api/deploy", async (req, res) => {
    const { projectName, gitHubRepo, envVars, vercelToken } = req.body;
    const token = vercelToken || process.env.VERCEL_TOKEN;

    if (!token) {
      return res.status(400).json({ success: false, error: "Vercel token is missing" });
    }

    try {
      // 1. Get or Create Project
      // Note: This is a simplified flow. Vercel API usually requires teamId or user context.
      // We'll attempt to create a deployment directly if the repo is already connected, 
      // or use the 'projects' API to configure first.
      
      console.log(`Starting deployment for ${projectName} from ${gitHubRepo}`);

      // Setup project and env vars via Vercel API
      // First, get project ID or create it
      let projectId = "";
      try {
        const projRes = await axios.get(`https://api.vercel.com/v9/projects/${projectName}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        projectId = projRes.data.id;
      } catch (e) {
        // Create project if not exists
        const createRes = await axios.post("https://api.vercel.com/v9/projects", {
          name: projectName,
          framework: "vite",
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        projectId = createRes.data.id;
      }

      // 2. Upsert Environment Variables
      for (const [key, value] of Object.entries(envVars)) {
        await axios.post(`https://api.vercel.com/v9/projects/${projectId}/env`, {
          key,
          value,
          type: "plain",
          target: ["production", "preview", "development"]
        }, {
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: (status) => status < 500 // Ignore if already exists (simplified)
        }).catch(() => {}); // Vercel returns 400 if env exists, we skip for now
      }

      // 3. Trigger Deployment
      // This assumes the GitHub repo is already connected to your Vercel account
      // For a fully automated "new repo" flow, more OAuth steps are needed.
      // We will trigger a deployment using the project's git metadata
      const deployRes = await axios.post("https://api.vercel.com/v13/deployments", {
        name: projectName,
        project: projectId,
        gitSource: {
          type: "github",
          repo: gitHubRepo, // format "username/repo"
          ref: "main"
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      res.json({
        success: true,
        deploymentId: deployRes.data.id,
        url: deployRes.data.url
      });

    } catch (error: any) {
      console.error("Vercel Deploy Error:", error.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: error.response?.data?.error?.message || error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
