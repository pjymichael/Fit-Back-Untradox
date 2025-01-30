document.addEventListener("DOMContentLoaded", () => {
  // 1. Grab references to all your elements
  const overlay = document.getElementById("modal-overlay");
  const mainContent = document.getElementById("modal-content")
  const openButton = document.getElementById("open-modal");
  const closeButton = document.getElementById("close-modal");

  // -- NEW: Append overlay to <body> so it's not nested in a limiting container --
  document.body.appendChild(overlay);

  // 4. Event handlers: open/close the modal
  openButton.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    overlay.classList.add("visible");
    mainContent.classList.remove("hidden");
    mainContent.classList.add("visible");
  });

  // Close modal if user clicks *outside* modal-content
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.classList.remove("visible");
      overlay.classList.add("hidden");
      mainContent.classList.remove("visible");
      mainContent.classList.add("hidden");
    }
  });
   // Grab tab buttons
   const tabFitBtn = document.getElementById("tab-fit");
   const tabProfileBtn = document.getElementById("tab-profile");
 
   // Grab screens
   const screenFit = document.getElementById("screen-fit");
   const screenProfile = document.getElementById("screen-profile");
   
   const slimFit = document.getElementById("fit-slim");
   const regularFit = document.getElementById("fit-regular");
   const oversizeFit = document.getElementById("fit-oversize")
   
 
   // Tab 1: My Fit
   tabFitBtn.addEventListener("click", () => {
     // Switch active tab button
     tabFitBtn.classList.add("active");
     tabProfileBtn.classList.remove("active");
 
     // Switch active screen
     screenFit.classList.add("active");
     screenProfile.classList.remove("active");
   });
   
   //My Fit size recommend
   slimFit.addEventListener("click", () => {
     slimFit.classList.add("active");
     regularFit.classList.remove("active");
     oversizeFit.classList.remove("active");
   });
   regularFit.addEventListener("click", () => {
     slimFit.classList.remove("active");
     regularFit.classList.add("active");
     oversizeFit.classList.remove("active");
   });
   oversizeFit.addEventListener("click", () => {
     slimFit.classList.remove("active");
     regularFit.classList.remove("active");
     oversizeFit.classList.add("active");
   });
 
 
   // Tab 2: My Profile
   tabProfileBtn.addEventListener("click", () => {
     tabProfileBtn.classList.add("active");
     tabFitBtn.classList.remove("active");
 
     screenProfile.classList.add("active");
     screenFit.classList.remove("active");
   });
   // 4. Event handlers: open/close the modal
   openButton.addEventListener("click", () => {
     overlay.classList.remove("hidden");
     overlay.classList.add("visible");
     recommendationContainer.classList.add("hidden"); // Hide recommendation initially
   });
 
   closeButton.addEventListener("click", () => {
     overlay.classList.remove("visible");
     overlay.classList.add("hidden");
   });
 
   // Close modal if user clicks *outside* modal-content
   overlay.addEventListener("click", (event) => {
     if (event.target === overlay) {
       overlay.classList.remove("visible");
       overlay.classList.add("hidden");
     }
   });
 
   // 5. Handle form submission and size recommendation
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
 
     const recommendedSize = recommendSize(chest, height, hip, sizingChart.sizes);
 
     if (recommendedSize) {
       recommendedSizeElement.textContent = recommendedSize.label;
     } else {
       recommendedSizeElement.textContent = "No suitable size found for the given measurements.";
     }
 
     recommendationContainer.classList.remove("hidden"); // Show the recommendation
   });

  function recommendSize(chest, height, hip, sizes) {
    let bestFit = null;
    let smallestDifference = Infinity;

    sizes.forEach((size) => {
      const chestDiff = Math.abs(size.measurements.Chest - chest);
      const hipDiff   = Math.abs(size.measurements.Waist - hip); // Using waist as proxy for hip
      const totalDiff = chestDiff + hipDiff;

      if (totalDiff < smallestDifference) {
        smallestDifference = totalDiff;
        bestFit = size;
      }
    });

    return bestFit;
  }
});
