import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import {
  db,
  genresTable,
  titleGenresTable,
  titlesTable,
} from "@workspace/db";
import {
  GetCatalogQueryParams,
  GetCatalogResponse,
  GetCatalogTitleParams,
  GetCatalogTitleResponse,
  GetGenresResponse,
} from "@workspace/api-zod";
import { getSeriesSeasons, toCatalogTitle } from "../lib/catalog";

const router: IRouter = Router();

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

router.get("/catalog", async (req, res): Promise<void> => {
  const query = GetCatalogQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions: SQL[] = [eq(titlesTable.status, "published")];
  if (query.data.kind) conditions.push(eq(titlesTable.kind, query.data.kind));
  if (query.data.search?.trim()) {
    const needle = `%${escapeLike(query.data.search.trim())}%`;
    conditions.push(
      or(
        ilike(titlesTable.title, needle),
        ilike(titlesTable.description, needle),
      )!,
    );
  }

  if (query.data.genre?.trim()) {
    const matchingGenres = await db
      .select({ titleId: titleGenresTable.titleId })
      .from(titleGenresTable)
      .innerJoin(genresTable, eq(titleGenresTable.genreId, genresTable.id))
      .where(ilike(genresTable.name, `%${escapeLike(query.data.genre.trim())}%`));

    if (matchingGenres.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(
      inArray(
        titlesTable.id,
        matchingGenres.map((row) => row.titleId),
      ),
    );
  }

  const rows = await db
    .select()
    .from(titlesTable)
    .where(and(...conditions))
    .orderBy(desc(titlesTable.releaseDate), desc(titlesTable.createdAt))
    .limit(200);

  res.json(GetCatalogResponse.parse(await Promise.all(rows.map(toCatalogTitle))));
});

router.get("/catalog/:titleId", async (req, res): Promise<void> => {
  const params = GetCatalogTitleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [title] = await db
    .select()
    .from(titlesTable)
    .where(
      and(
        eq(titlesTable.id, params.data.titleId),
        eq(titlesTable.status, "published"),
      ),
    )
    .limit(1);

  if (!title) {
    res.status(404).json({ error: "Title not found." });
    return;
  }

  const summary = await toCatalogTitle(title);
  const seasons =
    title.kind === "series" ? await getSeriesSeasons(title.id) : [];
  res.json(GetCatalogTitleResponse.parse({ ...summary, seasons }));
});

router.get("/genres", async (_req, res): Promise<void> => {
  const genres = await db
    .select({
      id: genresTable.id,
      name: genresTable.name,
      slug: genresTable.slug,
    })
    .from(genresTable)
    .orderBy(genresTable.name);
  res.json(GetGenresResponse.parse(genres));
});

export default router;
