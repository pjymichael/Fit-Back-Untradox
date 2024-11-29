document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("modal-overlay");
  const openButton = document.getElementById("open-modal");
  const closeButton = document.getElementById("close-modal");
  const form = document.getElementById("measurement-form");
  const recommendationContainer = document.getElementById("recommendation-container");
  const recommendedSizeElement = document.getElementById("recommended-size");

  if (!overlay || !openButton || !closeButton || !form || !recommendationContainer || !recommendedSizeElement) {
    console.error("Modal elements not found.");
    return;
  }

  // Hardcoded sizing chart data
  const sizingChart = {
    id: 1,
    unit: "cm",
    sizes: [
      {
        label: "XS/38",
        measurements: {
          Chest: 95,
          Waist: 94,
          Shoulders: 43,
          Sleeve: 62
        }
      },
      {
        label: "S/39",
        measurements: {
          Chest: 99,
          Waist: 98,
          Shoulders: 44,
          Sleeve: 63
        }
      },
      {
        label: "M/40",
        measurements: {
          Chest: 104,
          Waist: 103,
          Shoulders: 45,
          Sleeve: 65
        }
      },
      {
        label: "L/41",
        measurements: {
          Chest: 110,
          Waist: 109,
          Shoulders: 46,
          Sleeve: 66
        }
      },
      {
        label: "XL/42",
        measurements: {
          Chest: 116,
          Waist: 115,
          Shoulders: 47,
          Sleeve: 67
        }
      }
    ]
  };

  console.log("Sizing chart loaded:", sizingChart);

  // Open the modal
  openButton.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    overlay.classList.add("visible");
    recommendationContainer.classList.add("hidden"); // Hide recommendation initially
  });

  // Close the modal
  closeButton.addEventListener("click", () => {
    overlay.classList.remove("visible");
    overlay.classList.add("hidden");
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.classList.remove("visible");
      overlay.classList.add("hidden");
    }
  });

  // Handle form submission
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!sizingChart || !sizingChart.sizes) {
      console.error("Sizing chart is unavailable or not loaded.");
      recommendedSizeElement.textContent = "Sizing chart not available. Please try again later.";
      recommendationContainer.classList.remove("hidden");
      return;
    }

    const chest = parseFloat(document.getElementById("chest").value);
    const height = parseFloat(document.getElementById("height").value);
    const hip = parseFloat(document.getElementById("hip").value);

    console.log("Measurements Submitted:");
    console.log(`Chest: ${chest} cm`);
    console.log(`Height: ${height} cm`);
    console.log(`Hip: ${hip} cm`);

    const recommendedSize = recommendSize(chest, height, hip, sizingChart.sizes);

    if (recommendedSize) {
      recommendedSizeElement.textContent = recommendedSize.label;
    } else {
      recommendedSizeElement.textContent = "No suitable size found for the given measurements.";
    }

    recommendationContainer.classList.remove("hidden"); // Show the recommendation
  });

  function recommendSize(chest, height, hip, sizes) {
    console.log("Finding best size for:", { chest, height, hip });
    console.log("Available sizes:", sizes);

    let bestFit = null;
    let smallestDifference = Infinity;

    sizes.forEach((size) => {
      console.log("Checking size:", size);

      const chestDiff = Math.abs(size.measurements.Chest - chest);
      const hipDiff = Math.abs(size.measurements.Waist - hip); // Waist here is mapped to hip
      const totalDiff = chestDiff + hipDiff;

      console.log(`Size ${size.label}: Chest Diff = ${chestDiff}, Hip Diff = ${hipDiff}, Total Diff = ${totalDiff}`);

      if (totalDiff < smallestDifference) {
        smallestDifference = totalDiff;
        bestFit = size;
      }
    });

    console.log("Best fit:", bestFit);
    return bestFit;
  }
});
