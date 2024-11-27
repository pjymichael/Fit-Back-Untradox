import React, { useState } from "react";
import { useLoaderData } from "@remix-run/react"; // For navigation and data fetching
import {
  Page,
  Card,
  TextField,
  Button,
  Select
} from "@shopify/polaris";


// Loader to fetch product and sizing charts
export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  // Validate ID format
  if (!id || isNaN(id)) {
    throw new Response(
      JSON.stringify({ error: "Invalid product ID format" }),
      { status: 400 }
    );
  }

  const productGlobalId = `gid://shopify/Product/${id}`;

  try {
    // Execute GraphQL query with proper structure
    const response = await admin.graphql(
      `#graphql
      query GetProduct($id: ID!) {
        product(id: $id) {
          id
          title
          metafield(namespace: "custom", key: "sizing_chart") {
            value
          }
        }
      }
      `,
      {
        variables: { id: productGlobalId }
      }
    );

    // Parse response properly
    const responseJson = await response.json();

    // Validate response structure
    if (!responseJson.data?.product) {
      throw new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404 }
      );
    }

    // Fetch sizing charts with error handling
    //const sizingCharts = await db.sizingChart.findMany({
    //  select: {
    //    id: true,
    //    createdAt: true,
    //    updatedAt: true,
    //    sizes: {
    //      select: {
    //        id: true,
    //        label: true,
    //        measurements: true
    //      }
    //    }
    //  }
    //}).catch(error => {
    //  console.error("Database error:", error);
    //  throw new Response(
    //    JSON.stringify({ error: "Failed to fetch sizing charts" }),
    //    { status: 500 }
    //  );
    //});

  const sizingCharts = await db.sizingChart.findMany({
    include: {
      sizes: {
        include: {
          measurements: true, // Fetch nested measurements within each size
        },
      },
    },
  });

    // Return successful response
    return json({
      product: responseJson.data.product,
      sizingCharts
    });

  } catch (error) {
    console.error("Loader error:", error);

    // Handle different types of errors
    if (error instanceof Response) {
      throw error;
    }

    if (error.message?.includes("network")) {
      throw new Response(
        JSON.stringify({
          error: "Network error",
          message: "Please check your connection and try again"
        }),
        { status: 503 }
      );
    }

    throw new Response(
      JSON.stringify({
        error: "Failed to load product or sizing charts",
        message: error.message
      }),
      { status: 500 }
    );
  }
}


export default function SizingMatchForm() {
  const [unit, setUnit] = useState("cm");
  const [error, setError] = useState("");
  const [resultSize, setResultSize] = useState("");
  const [measurements, setMeasurements] = useState({
    Chest: "",
    Waist: "",
    Hips: ""
  });

  const mode = function(arr) {
    return arr.sort((a, b) =>
      arr.filter(v => v === a).length
      - arr.filter(v => v === b).length
    ).pop();
  }


  const inferSize = function(userData, chart) {
    // For each measurement, eg "Chest", "Waist"
    // go through the chart and find the size that best matches it
    const inferredSizes = {};

    for (const [bodyMeasurement, userValue] of Object.entries(userData)) {
      // measurement is the measurement name eg "Chest",
      // userValue is the corresponding size
      let bestFitSize = null;
      let closestDiff = Infinity;
      let diff = 0;

      // Do comparison for each size available
      // (If the measurement is available of course)
      for (const sizeData of chart.sizes) {
        //console.log(sizeData);
        /* example of `sizeData`
      {
        label: "S",
        measurments: [
          {label: "Chest", value: "50"},
          {label: "Waist", value: "20"}
        ],

      },
         * */
        const sizeValue = sizeData.measurements.find((entry) => entry.label === bodyMeasurement);
        // Reject if the specified body size is not these
        if (!sizeValue) break;

        diff = Math.abs(sizeValue.value - userValue);
        if (diff < closestDiff) {
          closestDiff = diff;
          bestFitSize = sizeData.label;
        }
      }
      // Now bestFitSize contains the label (S, M, L) for a specified bodyMeasurement
      // ("Chest", "Waist"). Put this into a table to tally up
      inferredSizes[bodyMeasurement] = bestFitSize
    }

    // Aggregate the sizes to get the best size
    var sizeList = Object.values(inferredSizes).filter(v => v != null);
    var fits = mode(sizeList);
    return fits;
    // End of size matching algorithm
  }
  const { product, sizingCharts } = useLoaderData();

  const unitOptions = [
    { label: "Centimeters", value: "cm" },
    { label: "Inches", value: "in" }
  ];

  // Choose which sizing chart to compare to
  const [selectedSizingChart, setSelectedSizingChart] = useState("");
  const handleSelectChange = (value) => {
    setSelectedSizingChart(value);
    setError(null);
  };

  const handleMeasurementChange = (field, value) => {
    setMeasurements(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // TODO: Implement size recommendation logic
    console.log("Submitted measurements:", measurements);
    const selectedChart = sizingCharts.find((chart) => chart.id.toString() === selectedSizingChart);
    setResultSize(inferSize(measurements, selectedChart))
  };

  const SizingChartTable = () => {
    if (!selectedSizingChart){
      return (<p>Please select a sizing chart</p>)
    }

    const selectedChart = sizingCharts.find((chart) => chart.id.toString() === selectedSizingChart);



    return (
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1em" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: "8px" }}>Size Label</th>
                          {selectedChart.sizes[0]?.measurements.map((measurement, index) => (
                            <th key={index} style={{ border: "1px solid #ccc", padding: "8px" }}>
                              {measurement.label}
                            </th>
                          ))}
              </tr>
            </thead>
                      <tbody>
                        {selectedChart.sizes.map((size) => (
                          <tr key={size.id}>
                            <td style={{ border: "1px solid #ccc", padding: "8px" }}>{size.label}</td>
                            {size.measurements.map((measurement, index) => (
                              <td key={index} style={{ border: "1px solid #ccc", padding: "8px" }}>
                                {measurement.value} {measurement.unit || ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
          </table>
    )
  }


  return (
    <Page title="Find Your Size">
      <Card>
            <Select
              label="Sizing Chart"
              options={[
                { label: "Select a Sizing Chart", value: "" },
                ...sizingCharts.map((chart) => ({
                  label: `Sizing Chart ID: ${chart.id}`,
                  value: chart.id.toString(),
                })),
              ]}
              value={selectedSizingChart}
              onChange={handleSelectChange}
            />
          <SizingChartTable />
      </Card>
      <form onSubmit={handleSubmit}>
        <Card sectioned>
          <Select
            label="Measurement Unit"
            options={unitOptions}
            value={unit}
            onChange={setUnit}
          />

          {Object.entries(measurements).map(([key, value]) => (
            <TextField
              key={key}
              label={key}
              type="number"
              value={value}
              onChange={(newValue) => handleMeasurementChange(key, newValue)}
              suffix={unit}
            />
          ))}

          <Button primary submit>
            Find My Size
          </Button>

        </Card>
      </form>
      <Card>
        {resultSize && <p>Your size is: {resultSize}</p>}
      </Card>



    </Page>
  );
}
