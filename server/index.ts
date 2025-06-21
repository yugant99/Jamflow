import express from "express";
import { config } from "dotenv";
import cors from "cors";
import { router } from "./src/routes";
import { router as privateRouter } from "./src/routes/private";
import rateLimit from "./src/controllers/middleware";

config();
export const app = express();
const port = process.env.PORT || 3000;
const url = `http://localhost:${port}`;
// @ts-ignore
app.use(rateLimit);
// CORS is not supported in native apps but needed for web app if we deploy it with expo.
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:8000",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(router);
app.use(privateRouter);

app.listen(port, () => {
  console.log(`Server running on ${url}`);
});
