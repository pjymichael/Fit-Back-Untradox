import db from "../../../db.server"; // Adjust path as needed to access your Prisma client

export async function action({ request }) {
  // Parse form data
  const formData = await request.formData();
  const sizes = JSON.parse(formData.get("sizes")); // Retrieve the sizes JSON data from formData

  // Create the sizing chart and related sizes/measurements in the database
  try {
    const sizingChart = await db.sizingChart.create({
      data: {
        sizes: {
          create: sizes.map((size) => ({
            label: size.label,
            measurements: {
              create: size.measurements.map((measurement) => ({
                label: measurement.label,
                value: parseFloat(measurement.value),
                unit: size.unit,
              })),
            },
          })),
        },
      },
    });

    // Redirect to the page where you want to show the newly created sizing chart
    return redirect(`/app/sizingchart/${sizingChart.id}`);
  } catch (error) {
    console.error("Error creating sizing chart:", error);
    return json({ error: "Failed to create sizing chart." }, { status: 500 });
  }
}

export default function NewSizingChart() {
  return <p>Processing sizing chart creation...</p>;
}