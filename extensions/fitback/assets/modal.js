document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("modal-overlay");
  const openButton = document.getElementById("open-modal");
  const closeButton = document.getElementById("close-modal");
  const sizingChartContainer = document.getElementById("sizing-chart-container");
  const sizingChartId = window.sizingChartId;

  if (!overlay || !openButton || !closeButton || !sizingChartContainer) {
    console.error("Modal elements not found");
    return;
  }

  openButton.addEventListener("click", async () => {
    console.log("Opening modal...");
    overlay.classList.add("visible");

    if (sizingChartId === "null") {
      sizingChartContainer.innerHTML = "<p>No sizing chart linked to this product.</p>";
      return;
    }

    try {
      const response = await fetch(`/api/sizing-chart/${sizingChartId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch sizing chart: ${response.statusText}`);
      }

      const data = await response.json();
      renderSizingChart(data);
    } catch (error) {
      console.error("Error fetching sizing chart:", error);
      sizingChartContainer.innerHTML = "<p>Failed to load sizing chart. Please try again later.</p>";
    }
  });

  closeButton.addEventListener("click", () => {
    console.log("Closing modal...");
    overlay.classList.remove("visible");
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      console.log("Overlay clicked, closing modal...");
      overlay.classList.remove("visible");
    }
  });

  function renderSizingChart(data) {
    if (!data || !data.sizes) {
      sizingChartContainer.innerHTML = "<p>Invalid sizing chart data.</p>";
      return;
    }

    let tableHTML = `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="border: 1px solid #ccc; padding: 8px;">Size</th>
    `;

    // Render measurement headers
    if (data.sizes[0]?.measurements) {
      Object.keys(data.sizes[0].measurements).forEach((measurement) => {
        tableHTML += `<th style="border: 1px solid #ccc; padding: 8px;">${measurement}</th>`;
      });
    }

    tableHTML += `
          </tr>
        </thead>
        <tbody>
    `;

    // Render rows of data
    data.sizes.forEach((size) => {
      tableHTML += `<tr><td style="border: 1px solid #ccc; padding: 8px;">${size.label}</td>`;
      Object.values(size.measurements).forEach((value) => {
        tableHTML += `<td style="border: 1px solid #ccc; padding: 8px;">${value}</td>`;
      });
      tableHTML += `</tr>`;
    });

    tableHTML += `
        </tbody>
      </table>
    `;

    sizingChartContainer.innerHTML = tableHTML;
  }
});
