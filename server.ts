import express from "express";
import { syncKmToBmvAvoidDuplicates } from "./syncKmToBmv";

const app = express();
const PORT = process.env.PORT || 3000;

// Basic auth middleware
const AUTH_TOKEN = process.env.AUTH_TOKEN || "your-secret-token";

function checkAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token || token !== AUTH_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Protected sync endpoint
app.get("/sync", checkAuth, async (req, res) => {
  try {
    console.log("Starting sync process...");
    await syncKmToBmvAvoidDuplicates();
    res.status(200).json({ message: "Sync completed successfully" });
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ error: "Sync failed" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
