import { Router, type IRouter } from "express";
import healthRouter from "./health";
import booksRouter from "./books";
import materialsRouter from "./materials";
import generateRouter from "./generate";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(booksRouter);
router.use(materialsRouter);
router.use(generateRouter);
router.use(storageRouter);

export default router;
