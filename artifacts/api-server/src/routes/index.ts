import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import materialsRouter from "./materials";
import generateRouter from "./generate";
import storageRouter from "./storage";
import assessmentsRouter from "./assessments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(materialsRouter);
router.use(generateRouter);
router.use(storageRouter);
router.use(assessmentsRouter);

export default router;
