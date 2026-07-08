import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();
const JWT_SECRET = process.env.JWT_SECRET || "default-super-secret-key-for-development";
const TOKEN_EXPIRY = "7d";

// Fixed admin credentials from environment variables (or defaults)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@naalandaapublicschool.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Setup check (not needed since we have a fixed credentials setup)
router.get("/auth/setup-check", async (req, res): Promise<void> => {
  res.json({ requiresSetup: false });
});

// Login
router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  if (normalizedEmail === ADMIN_EMAIL.toLowerCase().trim() && password === ADMIN_PASSWORD) {
    const jwtToken = jwt.sign(
      { id: "static-admin-id", email: ADMIN_EMAIL, role: "admin" },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("auth_token", jwtToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      id: "static-admin-id",
      email: ADMIN_EMAIL,
      role: "admin",
    });
  } else {
    res.status(401).json({ error: "Invalid email or password" });
  }
});

// Logout
router.post("/auth/logout", async (req, res): Promise<void> => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
  res.json({ success: true, message: "Logged out successfully" });
});

// Current User Info
router.get("/auth/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
  });
});

export default router;
