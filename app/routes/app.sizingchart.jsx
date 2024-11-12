import React, { useState } from "react";
import { useNavigate } from "@remix-run/react"; // Import useNavigate
import {
  Page,
  Card,
  Select,
  TextField,
  Button,
  FormLayout,
  ButtonGroup,
} from "@shopify/polaris";

// Define unit options
const unitOptions = [
  { label: "cm", value: "cm" },
  { label: "inches", value: "in" },
];

// Define size label options
const sizeLabelOptions = [
  { label: "XS", value: "XS" },
  { label: "S", value: "S" },
  { label: "M", value: "M" },
  { label: "L", value: "L" },
  { label: "XL", value: "XL" },
];

// Define measurement label options
const measurementLabelOptions = [
  { label: "Chest", value: "chest" },
  { label: "Waist", value: "waist" },
  { label: "Shoulders", value: "shoulders" },
  { label: "Sleeve", value: "sleeve" },
  { label: "Hip", value: "hip" },
  { label: "Inseam", value: "inseam" },
  { label: "Length", value: "length" },
];

export default function SizingChartForm() {
  const navigate = useNavigate(); // Initialize navigate for routing
  const [sizes, setSizes] = useState([
    { label: "", unit: "cm", measurements: [{ label: "chest", value: "" }] },
  ]);

  // Handler to add a new size entry
  const addSize = () => {
    setSizes([
      ...sizes,
      { label: "", unit: "cm", measurements: [{ label: "chest", value: "" }] },
    ]);
  };

  // Handler to remove a size entry
  const removeSize = (index) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };

  // Handler to add a measurement to a specific size
  const addMeasurement = (sizeIndex) => {
    const updatedSizes = [...sizes];
    updatedSizes[sizeIndex].measurements.push({ label: "", value: "" });
    setSizes(updatedSizes);
  };

  // Handler to remove a measurement from a specific size
  const removeMeasurement = (sizeIndex, measurementIndex) => {
    const updatedSizes = [...sizes];
    updatedSizes[sizeIndex].measurements = updatedSizes[sizeIndex].measurements.filter(
      (_, i) => i !== measurementIndex
    );
    setSizes(updatedSizes);
  };

  // Handler to update size label, unit, or measurements
  const handleInputChange = (sizeIndex, field, value, measurementIndex = null) => {
    const updatedSizes = [...sizes];
    if (measurementIndex === null) {
      updatedSizes[sizeIndex][field] = value;
    } else {
      updatedSizes[sizeIndex].measurements[measurementIndex][field] = value;
    }
    setSizes(updatedSizes);
  };

  const handleSubmit = () => {
    console.log("Sizes:", sizes);
  };

  return (
    <Page 
      title="Add Sizing Chart"
    >
      <ButtonGroup>
        <Button onClick={() => navigate(-1)}>Back</Button> {/* Custom back button */}
      </ButtonGroup>
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
          <Button primary onClick={handleSubmit}>
            Save Sizing Chart
          </Button>
        </FormLayout>
      </Card>
    </Page>
  );
}
