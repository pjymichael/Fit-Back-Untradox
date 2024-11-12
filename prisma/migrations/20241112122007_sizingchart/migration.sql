/*
  Warnings:

  - You are about to drop the column `chest` on the `Size` table. All the data in the column will be lost.
  - You are about to drop the column `hip` on the `Size` table. All the data in the column will be lost.
  - You are about to drop the column `inseam` on the `Size` table. All the data in the column will be lost.
  - You are about to drop the column `length` on the `Size` table. All the data in the column will be lost.
  - You are about to drop the column `shoulders` on the `Size` table. All the data in the column will be lost.
  - You are about to drop the column `sleeve` on the `Size` table. All the data in the column will be lost.
  - You are about to drop the column `waist` on the `Size` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `SizingChart` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Measurement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "value" REAL,
    "unit" TEXT NOT NULL,
    "sizeId" INTEGER NOT NULL,
    CONSTRAINT "Measurement_sizeId_fkey" FOREIGN KEY ("sizeId") REFERENCES "Size" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Size" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "sizingChartId" INTEGER NOT NULL,
    CONSTRAINT "Size_sizingChartId_fkey" FOREIGN KEY ("sizingChartId") REFERENCES "SizingChart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Size" ("id", "label", "sizingChartId") SELECT "id", "label", "sizingChartId" FROM "Size";
DROP TABLE "Size";
ALTER TABLE "new_Size" RENAME TO "Size";
CREATE TABLE "new_SizingChart" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SizingChart" ("createdAt", "id", "updatedAt") SELECT "createdAt", "id", "updatedAt" FROM "SizingChart";
DROP TABLE "SizingChart";
ALTER TABLE "new_SizingChart" RENAME TO "SizingChart";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
