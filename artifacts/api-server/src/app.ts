import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Restrict CORS to same-origin, the Replit preview proxy domain, and any
// *.replit.app deployment domain (all protected by Clerk auth regardless).
const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;
const allowedOrigins = new Set<string>(
  REPLIT_DEV_DOMAIN ? [`https://${REPLIT_DEV_DOMAIN}`] : []
);

app.use(cors({
  credentials: true,
  origin: (origin, callback) => {
    // Same-origin requests have no origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    // Allow any Replit deployment domain
    if (origin.endsWith(".replit.app")) return callback(null, true);
    // Allow localhost in development
    if (process.env.NODE_ENV !== "production" && origin.startsWith("http://localhost")) {
      return callback(null, true);
    }
    // Return false (not an Error) so cors sends a proper rejection instead of throwing
    return callback(null, false);
  },
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

app.use("/api", router);

export default app;
