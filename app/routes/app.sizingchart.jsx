import React, { useState } from "react";
import { useNavigate, useSubmit, useActionData } from "@remix-run/react";
import {
  Page,
  Card,
  TextField,
  Button,
  Banner,
  Select,
  ButtonGroup,
} from "@shopify/polaris";
import { json } from "@remix-run/node";
import db from "../db.server";
export async function action({ request }) {
  const formData = await request.formData();
  const sizes = JSON.parse(formData.get("sizes"));
  const unit = formData.get("unit"); // Get the unit for the entire sizing chart
  console.log("HIHIHI")
  console.log(sizes, unit)
  try {

    const newSizingChart = await db.SizingChart.create({
      data: {
        unit: unit, // Now that `unit` is defined in the schema, this should work
        sizes: {
          create: sizes.map((size) => ({
            label: size.label,
            measurements: {
              create: Object.entries(size.measurements).map(([label, value]) => ({
                label: label,
                value: parseFloat(value),
              })),
            },
          })),
        },
      },
    });

    console.log("Sizing chart created successfully:", newSizingChart);
    return json({ success: true, id: newSizingChart.id });

  } catch (error) {
    console.error("Error creating sizing chart:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}


export default function SizingChartForm() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const actionData = useActionData();

  const [unit, setUnit] = useState("cm");
  const [sizes, setSizes] = useState([
    { label: "", measurements: { Chest: "", Waist: "" } },
  ]);
  const [error, setError] = useState("");

  const unitOptions = [
    { label: "cm", value: "cm" },
    { label: "inches", value: "in" },
  ];

  // Editable measurement labels
  const [measurementLabels, setMeasurementLabels] = useState([
    "Chest",
    "Waist",
  ]);

  // Add a new size row
  const addSizeRow = () => {
    const newMeasurements = {};
    measurementLabels.forEach((label) => {
      newMeasurements[label] = "";
    });

    setSizes([...sizes, { label: "", measurements: newMeasurements }]);
  };

  // Add a new measurement column
  const addMeasurementColumn = () => {
    const newMeasurement = prompt("Enter the new measurement name:");
    if (!newMeasurement) return;

    setMeasurementLabels([...measurementLabels, newMeasurement]);
    setSizes((prevSizes) =>
      prevSizes.map((size) => ({
        ...size,
        measurements: { ...size.measurements, [newMeasurement]: "" },
      }))
    );
  };

  // Handle editable label changes
  const handleMeasurementLabelChange = (index, value) => {
    const updatedLabels = [...measurementLabels];
    updatedLabels[index] = value;

    const updatedSizes = sizes.map((size) => {
      const updatedMeasurements = {};
      updatedLabels.forEach((label, i) => {
        updatedMeasurements[label] =
          size.measurements[measurementLabels[i]] || "";
      });
      return { ...size, measurements: updatedMeasurements };
    });

    setMeasurementLabels(updatedLabels);
    setSizes(updatedSizes);
  };

  // Delete a size row
  const deleteSizeRow = (sizeIndex) => {
    const updatedSizes = sizes.filter((_, index) => index !== sizeIndex);
    setSizes(updatedSizes);
  };

  // Delete a measurement column
  const deleteMeasurementColumn = (measurementKey) => {
    const updatedLabels = measurementLabels.filter(
      (label) => label !== measurementKey
    );
    setMeasurementLabels(updatedLabels);

    const updatedSizes = sizes.map((size) => {
      const updatedMeasurements = { ...size.measurements };
      delete updatedMeasurements[measurementKey];
      return { ...size, measurements: updatedMeasurements };
    });
    setSizes(updatedSizes);
  };

  // Handle input changes for size labels or measurements
  const handleInputChange = (sizeIndex, field, value) => {
    const updatedSizes = [...sizes];
    updatedSizes[sizeIndex].measurements[field] = value;
    setSizes(updatedSizes);
  };

  const handleLabelChange = (sizeIndex, value) => {
    const updatedSizes = [...sizes];
    updatedSizes[sizeIndex].label = value;
    setSizes(updatedSizes);
  };

  // Handle form submission
  const handleSubmit = (event) => {
    event.preventDefault();

    for (const size of sizes) {
      if (!size.label) {
        setError("Please fill out all size labels.");
        return;
      }
      for (const key in size.measurements) {
        if (size.measurements[key] === "") {
          setError(`Please fill out all values for measurement "${key}".`);
          return;
        }
      }
    }

    setError("");
    const formData = new FormData();
    formData.append("sizes", JSON.stringify(sizes));
    formData.append("unit", unit);
    submit(formData, { method: "post" });
  };

  return (
    <Page title="Add Sizing Chart">
      <ButtonGroup>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </ButtonGroup>

      {actionData?.success && (
        <Banner status="success" title="Success">
          <p>Sizing chart created successfully! ID: {actionData.id}</p>
        </Banner>
      )}
      {actionData?.error && (
        <Banner status="critical" title="Error">
          <p>{actionData.error}</p>
        </Banner>
      )}
      {error && (
        <Banner status="critical" title="Error">
          <p>{error}</p>
        </Banner>
      )}

      <form onSubmit={handleSubmit}>
        <Card sectioned>
          <Select
            label="Unit"
            options={unitOptions}
            value={unit}
            onChange={(value) => setUnit(value)}
          />
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1em" }}>
          <thead>
            <tr>
              <th style={{ border: "1px solid #ccc", padding: "8px" }}>Size Label</th>
              {measurementLabels.map((measurement, index) => (
                <th key={measurement} style={{ border: "1px solid #ccc", padding: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <TextField
                      value={measurement}
                      onChange={(value) => handleMeasurementLabelChange(index, value)}
                      autoComplete="off"
                      style={{ flex: 1, marginRight: "8px" }}
                    />
                    <Button
                      plain
                      destructive
                      onClick={() => deleteMeasurementColumn(measurement)}
                    >
                      X
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((size, sizeIndex) => (
              <tr key={sizeIndex}>
                <td style={{ border: "1px solid #ccc", padding: "8px", position: "relative" }}>
                  <div style={{ position: "relative", display: "flex", alignItems: "end", justifyContent:"space-between" }}>
                    <Button
                      plain
                      destructive
                      onClick={() => deleteSizeRow(sizeIndex)}
                      style={{
                        position: "absolute",
                        bottom:"0"

                      }}
                    >
                      X
                    </Button>
                    <TextField
                      label="Size Label"
                      value={size.label}
                      onChange={(value) => handleLabelChange(sizeIndex, value)}
                      autoComplete="off"
                      style={{ width: "100%" }}
                    />

                  </div>
                </td>
                {Object.keys(size.measurements).map((measurement) => (
                  <td key={measurement} style={{ border: "1px solid #ccc", padding: "8px" }}>
                    <TextField
                      label={measurement}
                      value={size.measurements[measurement]}
                      onChange={(value) => handleInputChange(sizeIndex, measurement, value)}
                      autoComplete="off"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          </table>
          <div style={{ marginTop: "1em" }}>
            <Button onClick={addSizeRow}>Add Size Row</Button>
            <Button onClick={addMeasurementColumn}>Add Measurement Column</Button>
          </div>
          <div style={{ marginTop: "1em" }}>
            <Button primary submit>
              Save Sizing Chart
            </Button>
          </div>
        </Card>
      </form>
    </Page>
  );
}
