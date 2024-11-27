import React, { useState, useCallback } from "react";
import { useNavigate, useSubmit, useActionData } from "@remix-run/react";
import {
  Page,
  Card,
  TextField,
  Button,
  Banner,
  Select,
  ButtonGroup,
  DropZone,
  Thumbnail,
} from "@shopify/polaris";
import { json } from "@remix-run/node";
import db from "../db.server";

function processTextractData(blocks) {
  // Ensure blocks is an array
  if (!Array.isArray(blocks)) {
    console.error("Input is not an array");
    return { tables: [], titles: [] };
  }

  // Map WORD blocks for easy lookup
  const wordMap = blocks
    .filter((block) => block.BlockType === "WORD")
    .reduce((acc, block) => {
      acc[block.Id] = block.Text;
      return acc;
    }, {});

  // Filter out table blocks
  const tableBlocks = blocks.filter(
    (block) =>
      block.BlockType === "TABLE" &&
      block.EntityTypes &&
      block.EntityTypes.includes("STRUCTURED_TABLE")
  );

  // Filter for TABLE_TITLE blocks (assuming these blocks exist in the data)
  const titleBlocks = blocks.filter((block) => block.BlockType === "TABLE_TITLE");

  // Process each table
  const tables = tableBlocks.map((tableBlock) => {
    const tableId = tableBlock.Id;

    // Collect all child IDs for the table (these should be CELL block IDs)
    const childIds = tableBlock.Relationships.flatMap((rel) => rel.Ids);

    // Filter for CELL blocks that are children of this table
    const tableCells = blocks.filter(
      (block) => block.BlockType === "CELL" && childIds.includes(block.Id)
    );

    // Check if tableCells is empty
    if (tableCells.length === 0) {
      console.warn(`No cells found for table ${tableId}`);
      return null;
    }

    // Determine table dimensions
    const rowIndices = tableCells
      .map((cell) => cell.RowIndex)
      .filter((index) => typeof index === "number");
    const colIndices = tableCells
      .map((cell) => cell.ColumnIndex)
      .filter((index) => typeof index === "number");

    if (rowIndices.length === 0 || colIndices.length === 0) {
      console.warn(`Invalid row or column indices for table ${tableId}`);
      return null;
    }

    let rows = Math.max(...rowIndices);
    let cols = Math.max(...colIndices);

    // Initialize 2D array for table data
    let tableData = Array.from({ length: rows }, () =>
      Array(cols).fill("")
    );

    // Fill in table data
    tableCells.forEach((cell) => {
      const rowIndex = cell.RowIndex - 1;
      const colIndex = cell.ColumnIndex - 1;

      if (
        rowIndex < 0 ||
        rowIndex >= rows ||
        colIndex < 0 ||
        colIndex >= cols
      ) {
        console.warn(
          `Invalid cell indices: row=${rowIndex}, col=${colIndex} for table ${tableId}`
        );
        return;
      }

      // Get cell content
      const cellContent = blocks
        .filter(
          (block) =>
            block.BlockType === "WORD" &&
            cell.Relationships &&
            cell.Relationships.some(
              (rel) => rel.Type === "CHILD" && rel.Ids.includes(block.Id)
            )
        )
        .map((word) => word.Text)
        .join(" ");

      tableData[rowIndex][colIndex] = cellContent;
    });

    // --- Orientation Detection and Adjustment ---
    // Define functions to check for size and measurement labels
    const isSizeLabel = (s) => {
      const sizeLabels = [
        "XS", "S", "SM", "M", "MD", "L", "LG", "XL", "2XL", "3XL", "4XL",
        "5XL", "6XL", "7XL", "8XL", "9XL", "10XL", "XXS", "XXL", "XXXL",
        "XXXXL", "XXXXXL", "ONE SIZE", "FREE SIZE", "0", "2", "4", "6",
        "8", "10", "12", "14", "16", "18",
      ];
      return sizeLabels.includes(s.trim().toUpperCase());
    };

    const isMeasurementLabel = (s) => {
      const measurementLabels = [
        "CHEST", "WAIST", "HIP", "SHOULDER", "SLEEVE", "LENGTH",
        "INSEAM", "ARM", "NECK", "BUST", "THIGH", "KNEE", "CALF",
        "ANKLE", "SLEEVE LENGTH", "INSEAM (SHORT)", "INSEAM (REGULAR)",
        "INSEAM (TALL)",
      ];
      return measurementLabels.includes(s.trim().toUpperCase());
    };

    // Extract first row and first column (excluding headers)
    const firstRow = tableData[0].slice(1);
    const firstColumn = tableData.slice(1).map((row) => row[0]);

    // Count size labels in first row and first column
    const sizeCountInFirstRow = firstRow.filter(isSizeLabel).length;
    const sizeCountInFirstColumn = firstColumn.filter(isSizeLabel).length;

    // Decide if table needs to be transposed
    let sizesInFirstRow = sizeCountInFirstRow > sizeCountInFirstColumn;

    if (sizesInFirstRow) {
      // Transpose the table
      tableData = transpose(tableData);

      // Swap rows and cols
      [rows, cols] = [cols, rows];
    }

    // Return processed table
    return {
      rows,
      cols,
      data: tableData,
    };
  });

  // Extract titles if necessary
  const titles = titleBlocks.map((titleBlock) => {
    const titleChildrenIds = titleBlock.Relationships.flatMap((rel) => rel.Ids);
    return titleChildrenIds.map((id) => wordMap[id] || "").join(" ");
  });

  // Filter out null values (tables that couldn't be processed)
  return {
    tables: tables.filter((table) => table !== null),
    titles, // Return table titles
  };
}

// Helper function to transpose a matrix
function transpose(matrix) {
  return matrix[0].map((col, i) => matrix.map((row) => row[i]));
}


function mapTablesToModels(allTablesData) {
  // Initialize an array to hold all sizing charts
  const sizingCharts = [];

  allTablesData.forEach((tableData, index) => {
    const { tables, titles } = tableData;

    // Create a new SizingChart
    const sizingChart = {
      id: index + 1, // You might want to use a more robust ID system
      sizes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    tables.forEach((table, tableIndex) => {
      const { data } = table;

      // Check if the table has enough rows and columns
      if (data.length < 2 || data[0].length < 2) {
        console.warn(`Table at index ${tableIndex} does not have enough data.`);
        return;
      }

      // Assume the first row contains measurement labels
      const headers = data[0];
      const measurementLabels = headers.slice(1); // Skip the first header (Size label)

      // Process each row after the header
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const sizeLabel = row[0]; // The size label (e.g., "S", "M", "L")

        // Create a new Size
        const size = {
          id: sizingChart.sizes.length + 1,
          label: sizeLabel,
          measurements: [],
          sizingChartId: sizingChart.id,
        };

        // Process each measurement in the row
        for (let j = 1; j < row.length; j++) {
          const value = parseFloat(row[j]);
          const label = measurementLabels[j - 1];

          // Skip if value is not a number
          if (isNaN(value)) {
            console.warn(`Invalid measurement value at row ${i}, column ${j}`);
            continue;
          }

          // Create a new Measurement
          const measurement = {
            id: size.measurements.length + 1,
            label: label,
            value: value,
            unit: "cm", // You may need to determine the unit dynamically
            sizeId: size.id,
          };

          size.measurements.push(measurement);
        }

        sizingChart.sizes.push(size);
      }
    });

    sizingCharts.push(sizingChart);
  });

  return sizingCharts;
}

export async function action({ request }) {
  const formData = await request.formData();
  const sizes = JSON.parse(formData.get("sizes"));
  const unit = formData.get("unit"); // Get the unit for the entire sizing chart

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

  const [files, setFiles] = useState([]); // State for DropZone files

  const [unit, setUnit] = useState("cm");
  const [sizes, setSizes] = useState([
    { label: "", measurements: { Chest: "", Waist: "" } },
  ]);
  const [error, setError] = useState("");
  const [getResponse, setGetResponse] = useState(null);
  // New state to store the response from the POST request
  const [postResponse, setPostResponse] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const unitOptions = [
    { label: "cm", value: "cm" },
    { label: "inches", value: "in" },
  ];

  // Editable measurement labels
  const [measurementLabels, setMeasurementLabels] = useState([
    "Chest",
    "Waist",
  ]);

  //TESTING PURPOSE@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  const addRandomMeasurementLabel = () => {
    // Generate a random string (e.g., "Measurement123")
    const randomLabel = `Measurement${Math.floor(Math.random() * 1000)}`;
    setMeasurementLabels((prevLabels) => [...prevLabels, randomLabel]);
  
    // Update the sizes with the new random measurement key
    setSizes((prevSizes) =>
      prevSizes.map((size) => ({
        ...size,
        measurements: { ...size.measurements, [randomLabel]: "" },
      }))
    );
  };
  //-------------------------------------------------------@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
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

  const handleDropZoneDrop = useCallback(
    (_dropFiles, acceptedFiles, _rejectedFiles) => {
      setFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);
    },
    []
  );

  const handlePostRequest = async () => {
    if (files.length === 0) {
      setError("Please select at least one image to upload.");
      return;
    }

    setIsUploading(true);
    setError("");

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });

    try {
      const response = await fetch("http://localhost:1000/api/upload", {
        method: "POST",
        body: formData,
        // If your server requires credentials or has CORS settings, include them here
        // credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      const allTablesData = data.results.map((result) =>
        processTextractData(result.tableData.Blocks)
    );
    
      const sizingCharts = mapTablesToModels(allTablesData);
      console.log("Sizing Charts:", sizingCharts);
      setPostResponse(sizingCharts);
      console.log("POST request successful:", data);

      const populateSizingChartFromData = (data) => {
        if (!data || !data[0]?.sizes) {
          console.error("Invalid data format");
          return;
        }
      
        const chart = data[0]; // Assuming you're using the first chart for now
        const measurementSet = new Set();
      
        // Extract sizes and measurements
        const parsedSizes = chart.sizes.map((size) => {
          const measurements = {};
          size.measurements.forEach((measurement) => {
            measurements[measurement.label] = measurement.value;
            measurementSet.add(measurement.label); // Keep track of all unique measurement labels
          });
      
          return {
            label: size.label,
            measurements,
          };
        });
      
        // Update measurement labels and sizes
        setMeasurementLabels(Array.from(measurementSet)); // Convert Set to Array for unique labels
        setSizes(parsedSizes);
      };

      populateSizingChartFromData(sizingCharts)


    } catch (error) {
      console.error("Error making POST request:", error);
      setError(`Error: ${error.message}`);
      setPostResponse(null);
    } finally {
      setIsUploading(false);
    }
  };


  return (
    <Page title="Add Sizing Chart">
      <ButtonGroup>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </ButtonGroup>
      {/* Display the response from the POST request */}
      {postResponse && (
        <Banner status="success" title="POST Request Response">
          <pre style={{ maxHeight: "200px", overflow: "auto" }}>
            {JSON.stringify(postResponse, null, 2)}
          </pre>
        </Banner>
      )}
      {error && (
        <Banner status="critical" title="Error">
          <p>{error}</p>
        </Banner>
      )}
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
      <Card title="Upload Images for Textract" sectioned>
        <DropZone
          onDrop={handleDropZoneDrop}
          allowMultiple
          accept="image/*" // Accept only image files
        >
          <DropZone.FileUpload />
          {files.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              {files.map((file, index) => (
                <p key={index}>{file.name}</p>
              ))}
            </div>
          )}
        </DropZone>
        {/* Display uploaded images */}
        {files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", marginTop: "20px", gap: "10px" }}>
            {files.map((file, index) => (
              <div key={index} style={{ textAlign: "center", width: "150px" }}>
                <Thumbnail
                  size="large"
                  alt={file.name}
                  source={URL.createObjectURL(file)} // Temporary URL for preview
                />
                <p style={{ marginTop: "8px", wordWrap: "break-word" }}>{file.name}</p>
              </div>
            ))}
          </div>
        )}

        {/* Button to trigger the POST request */}
        <div style={{ marginTop: "1em" }}>
          <Button
            onClick={handlePostRequest}
            primary
            disabled={isUploading || files.length === 0}
            loading={isUploading}
          >
            {isUploading ? "Uploading..." : "Upload and Process Images"}
          </Button>
        </div>
      </Card>
      <div style={{ marginTop: "1em" }}>
        <Button onClick={addSizeRow}>Add Size Row</Button>
        <Button onClick={addMeasurementColumn}>Add Measurement Column</Button>
        <Button onClick={addRandomMeasurementLabel}>Add Random Measurement</Button>
      </div>
    </Page>
  );
}
