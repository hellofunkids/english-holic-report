import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db, booksTable } from "@workspace/db";

const router: IRouter = Router();

/** GET /books */
router.get("/books", async (_req: Request, res: Response) => {
  const rows = await db.select().from(booksTable).orderBy(desc(booksTable.createdAt));
  res.json(rows);
});

/** POST /books */
router.post("/books", async (req: Request, res: Response) => {
  const { title, description, coverImageUrl } = req.body ?? {};
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const [row] = await db
    .insert(booksTable)
    .values({ title, description: description ?? null, coverImageUrl: coverImageUrl ?? null })
    .returning();
  res.status(201).json(row);
});

/** PATCH /books/:bookId */
router.patch("/books/:bookId", async (req: Request, res: Response) => {
  const id = Number(req.params.bookId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid bookId" });
    return;
  }
  const update: Record<string, unknown> = {};
  if (typeof req.body?.title === "string") update.title = req.body.title;
  if (typeof req.body?.description === "string") update.description = req.body.description;
  if (typeof req.body?.coverImageUrl === "string") update.coverImageUrl = req.body.coverImageUrl;
  if (Object.keys(update).length === 0) {
    res.status(400).json({ error: "no fields to update" });
    return;
  }
  const [row] = await db.update(booksTable).set(update).where(eq(booksTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "book not found" });
    return;
  }
  res.json(row);
});

/** DELETE /books/:bookId */
router.delete("/books/:bookId", async (req: Request, res: Response) => {
  const id = Number(req.params.bookId);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid bookId" });
    return;
  }
  await db.delete(booksTable).where(eq(booksTable.id, id));
  res.status(204).end();
});

export default router;
