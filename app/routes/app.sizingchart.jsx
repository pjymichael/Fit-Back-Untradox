import React, { useState } from "react";
import { useNavigate, useSubmit } from "@remix-run/react"; // Import useNavigate and useSubmit
import {
  Page,
  Card,
  Select,
  TextField,
  Button,
  FormLayout,
  ButtonGroup,
  Banner,
} from "@shopify/polaris";

// Define unit options
const unitOptions = [
  { label: "Select unit", value: "", disabled: true },
  { label: "cm", value: "cm" },
  { label: "inches", value: "in" },
];

// Define size label options
const sizeLabelOptions = [
  { label: "Select size", value: "", disabled: true },
  { label: "XS", value: "XS" },
  { label: "S", value: "S" },
  { label: "M", value: "M" },
  { label: "L", value: "L" },
  { label: "XL", value: "XL" },
];

// Define measurement label options
const measurementLabelOptions = [
  { label: "Select measurement", value: "", disabled: true },
  { label: "Chest", value: "chest" },
  { label: "Waist", value: "waist" },
  { label: "Shoulders", value: "shoulders" },
  { label: "Sleeve", value: "sleeve" },
  { label: "Hip", value: "hip" },
  { label: "Inseam", value: "inseam" },
  { label: "Length", value: "length" },
];

export default function SizingChartForm() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const [sizes, setSizes] = useState([
    { label: "", unit: "", measurements: [{ label: "", value: "" }] },
  ]);
  const [error, setError] = useState("");

  const addSize = () => {
    setSizes([
      ...sizes,
      { label: "", unit: "", measurements: [{ label: "", value: "" }] },
    ]);
  };

  const removeSize = (index) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };

  const addMeasurement = (sizeIndex) => {
    const updatedSizes = [...sizes];
    updatedSizes[sizeIndex].measurements.push({ label: "", value: "" });
    setSizes(updatedSizes);
  };

  const removeMeasurement = (sizeIndex, measurementIndex) => {
    const updatedSizes = [...sizes];
    updatedSizes[sizeIndex].measurements = updatedSizes[sizeIndex].measurements.filter(
      (_, i) => i !== measurementIndex
    );
    setSizes(updatedSizes);
  };

  const handleInputChange = (sizeIndex, field, value, measurementIndex = null) => {
    const updatedSizes = [...sizes];
    if (measurementIndex === null) {
      updatedSizes[sizeIndex][field] = value;
    } else {
      updatedSizes[sizeIndex].measurements[measurementIndex][field] = value;
    }
    setSizes(updatedSizes);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log(sizes)
    // Validation to ensure all fields are filled
    for (const size of sizes) {
      if (!size.label || !size.unit) {
        setError("Please fill out all size labels and units.");
        return;
      }
      for (const measurement of size.measurements) {
        if (!measurement.label || !measurement.value) {
          setError("Please fill out all measurement labels and values.");
          return;
        }
      }
    }

    setError(""); // Clear any existing errors
    const formData = new FormData();
    formData.append("sizes", JSON.stringify(sizes));
    submit(formData, { method: "post", action: "/app/sizingchart/new" });
  };

  return (
    <Page title="Add Sizing Chart">
      <ButtonGroup>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </ButtonGroup>

      {/* Error Banner */}
      {error && (
        <Banner status="critical" title="Error">
          <p>{error}</p>
        </Banner>
      )}

      <form onSubmit={handleSubmit}>
        <Card sectioned>
          <FormLayout>
            {sizes.map((size, sizeIndex) => (
              <Card key={sizeIndex} sectioned title={`Size ${sizeIndex + 1}`}>
                <Select
                  label="Size Label"
                  options={sizeLabelOptions}
                  value={size.label}
                  onChange={(value) => handleInputChange(sizeIndex, "label", value)}
                />
                <Select
                  label="Unit"
                  options={unitOptions}
                  value={size.unit}
                  onChange={(value) => handleInputChange(sizeIndex, "unit", value)}
                />
                {size.measurements.map((measurement, measurementIndex) => (
                  <FormLayout.Group key={measurementIndex}>
                    <Select
                      label="Measurement Label"
                      options={measurementLabelOptions}
                      value={measurement.label}
                      onChange={(value) =>
                        handleInputChange(sizeIndex, "label", value, measurementIndex)
                      }
                    />
                    <TextField
                      label="Value"
                      type="number"
                      value={measurement.value}
                      onChange={(value) =>
                        handleInputChange(sizeIndex, "value", value, measurementIndex)
                      }
                      autoComplete="off"
                    />
                    <Button
                      onClick={() => removeMeasurement(sizeIndex, measurementIndex)}
                      destructive
                    >
                      Remove Measurement
                    </Button>
                  </FormLayout.Group>
                ))}
                <Button onClick={() => addMeasurement(sizeIndex)}>Add Measurement</Button>
                <Button onClick={() => removeSize(sizeIndex)} destructive>
                  Remove Size
                </Button>
              </Card>
            ))}
            <Button onClick={addSize}>Add Another Size</Button>
            <Button primary submit>
              Save Sizing Chart
            </Button>
          </FormLayout>
        </Card>
      </form>
    </Page>
  );
}
