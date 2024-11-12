import db from "../db.server.js";

export async function createSizingChart(data) {
  const { sizes } = data;

  return await db.sizingChart.create({
    data: {
      sizes: {
        create: sizes.map((size) => ({
          label: size.label,
          unit: size.unit,
          measurements: {
            create: size.measurements.map((measurement) => ({
              label: measurement.label,
              value: parseFloat(measurement.value),
            })),
          },
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

