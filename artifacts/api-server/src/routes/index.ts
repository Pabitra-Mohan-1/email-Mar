import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import contactsRouter from "./contacts";
import importRouter from "./import";
import groupsRouter from "./groups";
import templatesRouter from "./templates";
import smtpRouter from "./smtp";
import campaignsRouter from "./campaigns";
import logsRouter from "./logs";
import reportsRouter from "./reports";
import inboxRouter from "./inbox";
import aiRouter from "./ai";

import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

// Secure all data endpoints
router.use(requireAuth);

router.use(dashboardRouter);
router.use(importRouter);
router.use(contactsRouter);
router.use(groupsRouter);
router.use(templatesRouter);
router.use(smtpRouter);
router.use(campaignsRouter);
router.use(logsRouter);
router.use(reportsRouter);
router.use(inboxRouter);
router.use(aiRouter);

export default router;
