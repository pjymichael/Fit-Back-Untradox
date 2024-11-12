import db from "../db.server";

// Function to create a new sizing chart
export async function createSizingChart(productId, sizes) {
  return await db.sizingChart.create({
    data: {
      productId,
      sizes: {
        create: sizes.map((size) => ({
          label: size.label,
          chest: size.chest,
          waist: size.waist,
          shoulders: size.shoulders,
          sleeve: size.sleeve,
          hip: size.hip,
          inseam: size.inseam,
          length: size.length,
        })),
      },
    },
  });
}

// Function to get all sizing charts, including sizes and measurements
export async function getSizingCharts() {
  return await db.sizingChart.findMany({
    include: {
      sizes: {
        include: {
          measurements: true,
        },
      },
    },
  });
}

