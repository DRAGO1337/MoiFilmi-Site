import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog";
import accountRouter from "./account";
import adminRouter from "./admin";
import adminMediaRouter from "./admin-media";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(accountRouter);
router.use(adminRouter);
router.use(adminMediaRouter);

export default router;
