// app/routes/api/sizingcharts.js
import { json } from "@remix-run/node";
import db from "../../db.server"; // Adjust the path as necessary

export async function loader() {
  try {
    const sizingCharts = await db.sizingChart.findMany({
      include: {
        sizes: {
          include: {
            measurements: true
          }
        }
      }
    });
    return json({ sizingCharts });
  } catch (error) {
    console.error("Error fetching sizing charts:", error);
    return json({ error: "Failed to retrieve sizing charts" }, { status: 500 });
  }
}

export default loader;