import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import submissionsRouter from "./submissions";
import statsRouter from "./stats";
import pdfRouter from "./pdf";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(submissionsRouter);
router.use(statsRouter);
router.use(pdfRouter);
router.use(storageRouter);

export default router;
