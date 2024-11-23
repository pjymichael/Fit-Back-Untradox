/*
  Warnings:

  - You are about to drop the column `unit` on the `Size` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Size" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sizingChartId" INTEGER NOT NULL,
    CONSTRAINT "Size_sizingChartId_fkey" FOREIGN KEY ("sizingChartId") REFERENCES "SizingChart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Size" ("id", "sizingChartId") SELECT "id", "sizingChartId" FROM "Size";
DROP TABLE "Size";
ALTER TABLE "new_Size" RENAME TO "Size";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
