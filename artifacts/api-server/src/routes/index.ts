import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import roomsRouter from "./rooms";
import filesRouter from "./files";
import eventsRouter from "./events";
import executeRouter from "./execute";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(roomsRouter);
router.use(filesRouter);
router.use(eventsRouter);
router.use(executeRouter);
router.use(aiRouter);

export default router;
