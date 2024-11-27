import { json } from "@remix-run/node";
import db from "../../db.server"; // Adjust the path to your Prisma setup

export async function loader({ request }) {
  const url = new URL(request.url);
  const sizingChartId = url.searchParams.get("id");

  if (!sizingChartId) {
    return json({ error: "Sizing chart ID is required" }, { status: 400 });
  }

  try {
    const sizingChart = await db.sizingChart.findUnique({
      where: { id: parseInt(sizingChartId, 10) },
      include: { sizes: { include: { measurements: true } } }, // Include related data
    });

    if (!sizingChart) {
      return json({ error: "Sizing chart not found" }, { status: 404 });
    }

    return json(sizingChart);
  } catch (error) {
    console.error("Error fetching sizing chart:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
