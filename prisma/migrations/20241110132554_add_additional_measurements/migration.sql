-- CreateTable
CREATE TABLE "SizingChart" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Size" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT NOT NULL,
    "chest" REAL,
    "waist" REAL,
    "shoulders" REAL,
    "sleeve" REAL,
    "hip" REAL,
    "inseam" REAL,
    "length" REAL,
    "sizingChartId" INTEGER NOT NULL,
    CONSTRAINT "Size_sizingChartId_fkey" FOREIGN KEY ("sizingChartId") REFERENCES "SizingChart" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
