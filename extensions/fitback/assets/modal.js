document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("modal-overlay");
  const openButton = document.getElementById("open-modal");
  const closeButton = document.getElementById("close-modal");

  if (!overlay || !openButton || !closeButton) {
    console.error("Modal elements not found");
    return;
  }

  openButton.addEventListener("click", () => {
    console.log("Opening modal...");
    overlay.classList.add("visible"); // Make the modal visible
    overlay.classList.remove("hidden"); // Remove the hidden class
  });

  closeButton.addEventListener("click", () => {
    console.log("Closing modal...");
    overlay.classList.remove("visible"); // Remove the visible class
    overlay.classList.add("hidden"); // Add the hidden class
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      console.log("Overlay clicked, closing modal...");
      overlay.classList.remove("visible"); // Remove the visible class
      overlay.classList.add("hidden"); // Add the hidden class
    }
  });
});
