/*
  Warnings:

  - Added the required column `label` to the `Size` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Size" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "sizingChartId" INTEGER NOT NULL,
    CONSTRAINT "Size_sizingChartId_fkey" FOREIGN KEY ("sizingChartId") REFERENCES "SizingChart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Size" ("id", "sizingChartId") SELECT "id", "sizingChartId" FROM "Size";
DROP TABLE "Size";
ALTER TABLE "new_Size" RENAME TO "Size";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
