document.addEventListener("DOMContentLoaded", () => {
  // 1. Grab references to all your elements
  const overlay = document.getElementById("modal-overlay");
  const mainContent = document.getElementById("modal-content");
  const openButton = document.getElementById("open-modal");

  // -- NEW: Append overlay to <body> so it's not nested in a limiting container --
  document.body.appendChild(overlay);


  //ONBOARDING
  const welcomeNextButton = document.getElementById("onboard-welcome-next")
  const userInputNextButton = document.getElementById("onboard-user-input-next")
  
  const onboardWelcome = document.getElementById("onboard-welcome")
  const onboardUserInput = document.getElementById("onboard-user-input")
  const onboardCameraInstruction = document.getElementById("onboard-camera-prompt")
  welcomeNextButton.addEventListener("click", ()=> {
    onboardWelcome.classList.add("hidden")
    onboardUserInput.classList.remove("hidden")
  })
  userInputNextButton.addEventListener("click",() => {
    onboardUserInput.classList.add("hidden")
    onboardCameraInstruction.classList.remove("hidden")
  })
















  // 4. Event handlers: open/close the modal
  openButton.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    overlay.classList.add("visible");
    // mainContent.classList.remove("hidden");
    // mainContent.classList.add("visible");
  });

  // Close modal if user clicks *outside* modal-content
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.classList.remove("visible");
      overlay.classList.add("hidden");
      // mainContent.classList.remove("visible");
      // mainContent.classList.add("hidden");
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
  const oversizeFit = document.getElementById("fit-oversize");

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
    // Make sure the camera and canvas are visible
    video.style.display = "block";
    canvas.style.display = "block";
  });
  // 4. Event handlers: open/close the modal
  openButton.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    overlay.classList.add("visible");
  });

  // Close modal if user clicks *outside* modal-content
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.classList.remove("visible");
      overlay.classList.add("hidden");
    }
  });

  const video = document.getElementById("camera-preview");
  const canvas = document.getElementById("camera-output");
  const startButton = document.getElementById("start-camera");
  const captureButton = document.getElementById("capture-photo");

  let stream;
  let detector;
  let isDetecting = false;

  // Load TensorFlow and Pose Detector
  async function initializePoseDetector() {
    await tf.ready();
    await tf.setBackend("webgl");
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      },
    );
    console.log("Pose detector initialized:", detector);
  }

  async function startPoseDetection() {
    if (!detector) await initializePoseDetector();
    isDetecting = true;
    detectPose();
  }

  async function detectPose() {
    if (!isDetecting || !video || video.readyState < 2) {
      requestAnimationFrame(detectPose);
      return;
    }

    const poses = await detector.estimatePoses(video, {
      flipHorizontal: false,
    });
    // if (poses.length > 0) console.log("Detected Poses:", poses); // debug statement

    drawPose(poses);
    requestAnimationFrame(detectPose);
  }
  function drawPose(poses) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");

    // Mirror the canvas
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    ctx.restore();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    poses.forEach((pose) => {
      pose.keypoints.forEach((keypoint) => {
        if (keypoint.score > 0.5) {
          const x =
            (canvas.width - keypoint.x) * (canvas.width / video.videoWidth); // Flip X-coordinates
          const y = keypoint.y * (canvas.height / video.videoHeight);

          ctx.beginPath();
          ctx.arc(x, y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "yellow";
          ctx.fill();
        }
      });
    });
  }

  startButton.addEventListener("click", async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.play();

      video.style.display = "block"; // ✅ Ensure video is visible
      video.onloadeddata = () => {
        console.log("Video loaded, starting pose detection...");
        startPoseDetection();
        captureButton.style.display = "";
        startButton.style.display = "none";
      };
    } catch (error) {
      console.error("Camera error:", error);
    }
  });

  captureButton.addEventListener("click", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    const photoData = canvas.toDataURL("image/jpeg");
    console.log("Captured photo:", photoData);
  });

  window.addEventListener("beforeunload", () => {
    if (stream) stream.getTracks().forEach((track) => track.stop());
  });



  const carousel = document.querySelector(".carousel");
  const prevBtn = document.querySelector(".prev-btn");
  const nextBtn = document.querySelector(".next-btn");
  const items = document.querySelectorAll(".carousel-item");
  
  function updateActiveItem(direction) {
      const selected = document.querySelector(".carousel-item.selected");
      let index = Array.from(items).indexOf(selected);
  
      if (direction === "next" && index < items.length - 1) {
          index++;
      } else if (direction === "prev" && index > 0) {
          index--;
      }
  
      selected.classList.remove("selected");
      items[index].classList.add("selected");
  
      console.log("Active Item:", items[index].textContent.trim()); // Get active item
  }
  
  nextBtn.addEventListener("click", () => updateActiveItem("next"));
  prevBtn.addEventListener("click", () => updateActiveItem("prev"));
  
});