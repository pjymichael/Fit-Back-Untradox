//array to store screen id
import { drawSkeleton } from "./drawUtils.js";
import { initFirebase, uploadToFirebase } from "./firebaseUtils.js";
import { firebaseConfig, TM_URL } from "./env.js";
// import { loadModel, classifyFrame, collapsePose } from "./workerManager.js";
import {
  setWorkerInstance,
  requestVersion,
  loadModel,
  classifyFrame,
} from "./workerFunctionsHelper.js";
import { initializePoseDetector, estimatePoses } from "./poseDetector.js";
// Declare variables at the top of your script
let gender = "";
let height = 0;
let weight = 0;
let age = 0;
let shoulder = 0;
let hip = 0;
let arm = 0;
let leg = 0;
let chest = 0;
let waist = 0;
let torso = 0;
let thigh = 0;

const workerCode = `
  // Load external scripts inside a try/catch.
  try {
    importScripts("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js");
    importScripts("https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8/dist/teachablemachine-pose.min.js");
    console.log("TF1 Worker: External scripts loaded. TFJS version:", tf.version.tfjs);
  } catch(e) {
    console.error("Error loading external scripts:", e);
    self.postMessage("Failed to load external scripts.");
  }

  // Confirm worker loaded.
  self.postMessage("TF1 Worker: Loaded successfully with external scripts!");

  // Variable to store the loaded model.
  let tmModel = null;

  // Listen for messages from the main thread.
  self.onmessage = async (e) => {
    const { command, data } = e.data;

    // Command: "version" – Return the TFJS version.
    if (command === "version") {
      self.postMessage({ type: "version", version: tf.version.tfjs });
    }

    // Command: "LOAD_MODEL" – Load the Teachable Machine pose model.
    if (command === "LOAD_MODEL") {
      try {
        tmModel = await tmPose.load(data.modelURL, data.metadataURL);
        self.postMessage({ type: "model_loaded", success: true });
      } catch (err) {
        self.postMessage({ type: "model_loaded", success: false, error: err.toString() });
      }
    }

    // Command: "CLASSIFY_FRAME" – Classify a single frame.
    if (command === "CLASSIFY_FRAME") {
      if (!tmModel) {
        self.postMessage({ type: "classification", error: "No model loaded" });
        return;
      }
      try {
        const { width, height, buffer } = data; // from main thread
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // Create an ImageData from the buffer.
        const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);
        ctx.putImageData(imageData, 0, 0);

        // Estimate pose and classify.
        const { pose: tmPoseOutput, posenetOutput } = await tmModel.estimatePose(canvas);
        const predictions = await tmModel.predict(posenetOutput);
        // Find the best prediction.
        let best = predictions.reduce((a, b) => a.probability > b.probability ? a : b);

        self.postMessage({
          type: "classification",
          bestClass: best.className,
          probability: best.probability,
        });
      } catch (err) {
        self.postMessage({ type: "classification", error: err.toString() });
      }
    }
  };
`;
// Create a Blob from the worker code.
const blob = new Blob([workerCode], { type: "application/javascript" });
const workerUrl = URL.createObjectURL(blob);
const tf1Worker = new Worker(workerUrl);

tf1Worker.onmessage = (event) => {
  // console.log("Main thread received:", event.data);
};

// Optionally, listen for errors.
tf1Worker.onerror = (error) => {
  console.error("Worker error:", error);
};

setWorkerInstance(tf1Worker);

requestVersion();

async function collapsePose(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const result = await classifyFrame(width, height, imageData.data.buffer);
  if (!result || !result.bestClass) {
    console.error("Worker classification failed, or no result");
    return { poseName: null, poseConfidence: 0 };
  }
  return {
    poseName: result.bestClass,
    poseConfidence: result.probability,
  };
}

requestVersion();

loadModel(TM_URL + "model.json", TM_URL + "metadata.json");

document.addEventListener("DOMContentLoaded", () => {
  const elements = initializeElements();
  const {
    canvas,
    video,
    overlay,
    mainContent,
    openButton,
    onboardWelcome,
    onboardUserInput,
    onboardCameraPrompt,
    onboardCameraGuidelines,
    onboardCameraPosition,
    recommendationContent,
    CameraScan,
    userDetailForm,
    onboardWelcomeNext,
    onboardUserInputNext,
    onboardCameraPromptNext,
    onboardCameraPromptManual,
    onboardCameraGuidelinesNext,
    onboardCameraPositionNext,
    CameraScanNext,
    genderInput,
    heightInput,
    weightInput,
    ageInput,
    sizingCardContainer,
    screenFit,
    screenProfile,
    screenProfileMeasurementDetails,
    screenProfileMeasurementEdit,
    userMeasurementForm,
    tabFitBtn,
    tabProfileBtn,
    profileEditMeasurementBtn,
    profileMeasurementManualConfirmChangeBtn,
    shoulderInput,
    chestInput,
    hipInput,
    waistInput,
    torsoInput,
    armInput,
    legInput,
    thighInput,
  } = elements;
  document.body.appendChild(overlay);
  //dictionary storage of user information
  let userInfo = {
    gender,
    height,
    weight,
    age,
    shoulder,
    hip,
    arm,
    leg,
    chest,
    waist,
    torso,
    thigh,
  };

  setupModalOpenClose(openButton, overlay);

  const onboardScreensArray = [
    onboardWelcome,
    onboardUserInput,
    onboardCameraPrompt,
    onboardCameraGuidelines,
    onboardCameraPosition,
    CameraScan,
    recommendationContent,
  ];

  //store as array
  const onboardNextBtnsArray = [
    onboardWelcomeNext,
    onboardUserInputNext,
    onboardCameraPromptNext,
    onboardCameraGuidelinesNext,
    onboardCameraPositionNext,
    CameraScanNext,
  ];

  const userDetailArray = [genderInput, heightInput, weightInput, ageInput];

  const cameraController = {
    isActive: false,
    stream: null,
    async startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        isDetecting = true;
        video.srcObject = stream;
        video.play();
        video.style.display = "block";
        video.onloadeddata = () => {
          console.log("Video loaded, starting pose detection...");
          // TODO : convert this to a function to initialize the silhoutte
          const silhouette = document.getElementById("expected-silhouette");
          console.log("Silhouette element:", silhouette.src);
          silhouette.style.height = video.offsetHeight * 0.95 + "px";
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          startPoseDetection();
        };
      } catch (error) {
        console.error("Error starting camera:", error);
      }
    },
    deactivateCamera() {
      console.log("Deactivating camera... outer loop");

      if (video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
      isDetecting = false;
      isReady = false;
    },
    DisplayFeedback(message) {
      userFeedback.innerHTML = message;
    },
    getVideoElement() {
      return video;
    },
  };
  setupOnboardingNavigation(
    onboardScreensArray,
    onboardNextBtnsArray,
    userDetailForm,
    userDetailArray,
    cameraController,
  );

  const recommendationScreenArray = [
    screenFit,
    screenProfile,
    screenProfileMeasurementDetails,
    screenProfileMeasurementEdit,
  ];

  const recommendationScreenBtn = [
    tabFitBtn,
    tabProfileBtn,
    profileEditMeasurementBtn,
    profileMeasurementManualConfirmChangeBtn,
  ];

  // Package the extra elements into an object for clarity
  const extraElements = {
    tabFitBtn,
    tabProfileBtn,
    profileEditMeasurementBtn,
    profileMeasurementManualConfirmChangeBtn,
    screenFit,
    screenProfile,
    screenProfileMeasurementDetails,
    screenProfileMeasurementEdit,
  };
  const measurementInputArray = [
    shoulderInput,
    chestInput,
    hipInput,
    waistInput,
    torsoInput,
    armInput,
    legInput,
    thighInput,
  ];

  setupRecommendationNavigation(
    recommendationScreenBtn,
    extraElements,
    userMeasurementForm,
    measurementInputArray,
    userInfo, // only to pass values to saveProfileMeasurementDetails
    userDetailArray, // only to pass values to saveProfileMeasurementDetails
  );

  document.querySelectorAll(".measurement-card").forEach((card) => {
    card.addEventListener("mouseover", () => {
      const targetId = card.getAttribute("data-target");
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        // Select all common SVG shape elements within the target group
        const shapeElements = targetElement.querySelectorAll(
          "path, ellipse, line, circle, polygon, rect",
        );
        shapeElements.forEach((shape) => shape.classList.add("highlight"));
      }
    });

    card.addEventListener("mouseout", () => {
      const targetId = card.getAttribute("data-target");
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        const shapeElements = targetElement.querySelectorAll(
          "path, ellipse, line, circle, polygon, rect",
        );
        shapeElements.forEach((shape) => shape.classList.remove("highlight"));
      }
    });
  });
  //

  let gliderElement = document.querySelector(".glider");
  let slides = document.querySelectorAll(".slide");

  let glider = new Glider(gliderElement, {
    slidesToShow: 1,
    dots: "#dots",
    draggable: true,
    arrows: {
      prev: ".glider-prev",
      next: ".glider-next",
    },
  });

  glider.scrollItem(1, true);

  function updateActiveSlide() {
    let gliderRect = gliderElement.getBoundingClientRect();
    let centerX = gliderRect.left + gliderRect.width / 2;

    let closestSlide = null;
    let closestDistance = Infinity;
    let closestIndex = 0;

    slides.forEach((slide, index) => {
      let slideRect = slide.getBoundingClientRect();
      let slideCenter = slideRect.left + slideRect.width / 2;
      let distance = Math.abs(centerX - slideCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestSlide = slide;
        closestIndex = index;
      }
    });

    // Apply active style to the closest slide
    slides.forEach((slide) => slide.classList.remove("active-slide"));
    if (closestSlide) closestSlide.classList.add("active-slide");

    // Snap to the closest slide
    glider.scrollItem(closestIndex, true);
    let size = document
      .getElementsByClassName("sizing-card")[0]
      .getElementsByTagName("p")[0]; // Get the first <p>
    size.textContent = closestIndex;
  }

  // Detect active slide on scroll or button click
  gliderElement.addEventListener("scroll", () => {
    clearTimeout(window.gliderScrollTimeout);
    window.gliderScrollTimeout = setTimeout(updateActiveSlide, 200);
  });

  updateActiveSlide();
  // CameraScan code
  initFirebase(firebaseConfig);

  loadModel(TM_URL + "model.json", TM_URL + "metadata.json");
  let stream;
  let detector;
  let isDetecting = false;
  let isReady = false;

  async function startPoseDetection() {
    if (!detector) {
      detector = await initializePoseDetector();
    }
    isReady = true;
    requestAnimationFrame(detectPose);
  }

  const THROTTLE_DELAY = 120; // ms
  let lastTime = 0;

  async function detectPose(timestamp) {
    if (!isDetecting) return;

    // Wait for video readiness
    if (!isReady || !video || video.readyState < 2) {
      requestAnimationFrame(detectPose);
      return;
    }

    // Throttle
    if (timestamp - lastTime < THROTTLE_DELAY) {
      requestAnimationFrame(detectPose);
      return;
    }
    lastTime = timestamp;

    try {
      const poses = await estimatePoses(detector, video);
      drawPose(canvas, video, poses);
    } catch (error) {
      console.error("Error in pose estimation:", error);
    }

    requestAnimationFrame(detectPose);
  }

  function drawPose(canvas, video, poses) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Mirror the canvas so it looks more natural
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // ctx.clearRect(0, 0, canvas.width, canvas.height); // ← Problem is here!
    ctx.restore();
    video.display = "none";
    poses.forEach((pose) => {
      drawSkeleton(pose, ctx, video);
      analysePose(pose, ctx);
    });
  }

  const analysisState = {
    state: "start",
    validSince: null,
    lastFeedback: "",
    imageBlobArray: [],
    photosTaken: 0,
    uploadInProgress: false,
  };
  const REQUIRED_TIME = 3000;
  let isClassifying = false;

  async function analysePose(pose, ctx) {
    const importantPoints = ["left_shoulder", "right_shoulder"];
    const filteredKeypoints = pose.keypoints.filter((kp) =>
      importantPoints.includes(kp.name),
    );

    const horizontalPadding = 5;
    const verticalPadding = 5;
    const left = horizontalPadding;
    const right = ctx.canvas.width - horizontalPadding;
    const top = verticalPadding;
    const bottom = ctx.canvas.height - verticalPadding;

    // Because the canvas is mirrored, x = ctx.canvas.width - kp.x
    const pointsOutsidePadding = filteredKeypoints.filter((kp) => {
      const x = ctx.canvas.width - kp.x;
      const y = kp.y;
      return x < left || x > right || y < top || y > bottom;
    });
    const isInsideFrame = pointsOutsidePadding.length === 0;
    const now = Date.now();

    // If we are in “upload_photo” state, just upload to firebase
    if (analysisState.state === "upload_photo") {
      DisplayFeedback("Uploading photos to firebase...");
      updateSilhouette("disable");
      uploadToFirebase(analysisState, (err, results) => {
        if (err) {
          console.error("Upload failed:", err);
        } else {
          console.log("Upload completed, download URLs:", results);
          analysisState.state = "final_state";
          DisplayFeedback("Photo upload completed successfully.");
        }
      });
      return;
    } else if (analysisState.state === "final_state") {
      // Completed
      DisplayFeedback("Measurement Process completed!");
      // Example: auto-switch to Fit tab
      setTimeout(() => {
        tabFitBtn.click();
        console.log("Switched to Fit tab after detection completed");
      }, 1000);
      return;
    }

    // If user is out of frame and we are mid-flow
    if (!isInsideFrame && analysisState.state !== "start") {
      if (analysisState.imageBlobArray.length === 0) {
        analysisState.state = "detecting_one";
      } else if (analysisState.imageBlobArray.length === 1) {
        analysisState.state = "detecting_two";
      }
      analysisState.validSince = null;
      const msg = "Please stand inside the frame";
      if (analysisState.lastFeedback !== msg) {
        DisplayFeedback(msg);
        analysisState.lastFeedback = msg;
      }
      return;
    }

    // Show the silhouette (30% opacity, front or side)
    updateSilhouette("start");

    // If inside the frame, increment time. Once we’re steady for REQUIRED_TIME, do a new state action
    if (isInsideFrame) {
      if (!analysisState.validSince) {
        analysisState.validSince = now;
      }

      if (now - analysisState.validSince >= REQUIRED_TIME) {
        switch (analysisState.state) {
          case "start":
            console.log("Transitioning to detecting_one");
            analysisState.state = "detecting_one";
            analysisState.validSince = now;
            DisplayFeedback("Detecting your pose...");
            break;

          case "detecting_one":
            if (isClassifying) break;
            isClassifying = true;
            const result1 = await collapsePose(canvas);
            if (
              result1.poseName === "Front-view" &&
              result1.poseConfidence > 0.7
            ) {
              DisplayFeedback("Pose Detected, taking photo");
              analysisState.state = "ready_one";
              analysisState.validSince = now;
            } else {
              DisplayFeedback("Please match the silhouette with your body");
              isClassifying = false;
              return;
            }
            isClassifying = false;
            break;

          case "ready_one":
            DisplayFeedback("Taking front photo...");
            returnPhotoRef("front", (err, result) => {
              if (err) {
                console.error("Capture Photo method failed", err);
              } else {
                console.log("Saved front image:", result);
                analysisState.imageBlobArray.push(result);
                analysisState.state = "start_2";
                analysisState.validSince = now;
                DisplayFeedback("Please rotate 90° to the right");
              }
            });
            break;

          case "start_2":
            analysisState.state = "detecting_two";
            analysisState.validSince = now;
            updateSilhouette("start_2");
            // We'll rely on the user physically rotating
            break;

          case "detecting_two":
            if (isClassifying) break;
            isClassifying = true;
            const result2 = await collapsePose(canvas);
            if (
              result2.poseName === "side-view" &&
              result2.poseConfidence > 0.7
            ) {
              DisplayFeedback("Pose Detected, taking photo");
              analysisState.state = "ready_two";
              analysisState.validSince = now;
            } else {
              DisplayFeedback("Please match the silhouette with your body");
              isClassifying = false;
              return;
            }
            isClassifying = false;
            break;

          case "ready_two":
            DisplayFeedback("Taking side photo...");
            returnPhotoRef("side", (err, result) => {
              if (err) {
                console.error("Capture Photo method failed", err);
              } else {
                console.log("Saved side image:", result);
                analysisState.imageBlobArray.push(result);
                analysisState.state = "upload_photo";
                analysisState.validSince = now;
                DisplayFeedback("Ready to upload photos...");
              }
            });
            break;

          default:
            // If state is unrecognized, reset to “start”
            analysisState.state = "start";
            analysisState.validSince = now;
            DisplayFeedback("Resetting detection. Please stand still.");
            break;
        }
      } else {
        // Not enough consecutive frames yet
        const msg = "Detection in progress, remain still...";
        if (analysisState.lastFeedback !== msg) {
          DisplayFeedback(msg);
          analysisState.lastFeedback = msg;
        }
      }
    } else {
      // If we are in “start” but not inside the frame
      if (analysisState.state === "start") {
        const msg = "Please match the silhouette with your body";
        if (analysisState.lastFeedback !== msg) {
          DisplayFeedback(msg);
          analysisState.lastFeedback = msg;
        }
      }
    }
  }
  function returnPhotoRef(url_modifier, callback) {
    console.log("Capturing photo for", url_modifier);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    const ctx = tempCanvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const filename = `${url_modifier}_${timestamp}.jpg`;

    tempCanvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error("Failed to capture image as Blob.");
          if (callback) callback(new Error("Failed to create Blob"), null);
          return;
        }
        console.log("Photo captured:", filename);
        if (callback) {
          callback(null, { filename, blob });
        }
      },
      "image/jpeg",
      0.99,
    );
  }
});

//helper functions
const showElement = (ele) => {
  ele.classList.add("visible");
  ele.classList.remove("hidden");
};

const hideElement = (ele) => {
  ele?.classList.add("hidden");
  ele?.classList.remove("visible");
};

function initializeElements() {
  return {
    canvas: document.getElementById("camera-output"),
    video: document.getElementById("camera-preview"),
    overlay: document.getElementById("modal-overlay"),
    mainContent: document.getElementById("modal-content"),
    openButton: document.getElementById("open-modal"),
    onboardWelcome: document.getElementById("onboard-welcome"),
    onboardUserInput: document.getElementById("onboard-user-input"),
    onboardCameraPrompt: document.getElementById("onboard-camera-prompt"),
    onboardCameraGuidelines: document.getElementById(
      "onboard-camera-guidelines",
    ),
    onboardCameraPosition: document.getElementById("onboard-camera-position"),
    recommendationContent: document.getElementById("recommendation-content"),
    CameraScan: document.getElementById("CameraScan"),
    userDetailForm: document.getElementById("user-detail-form"),
    onboardWelcomeNext: document.getElementById("onboard-welcome-next"),
    onboardUserInputNext: document.getElementById("onboard-user-input-next"),
    onboardCameraPromptNext: document.getElementById(
      "onboard-camera-prompt-next",
    ),
    onboardCameraPromptManual: document.getElementById(
      "onboard-camera-prompt-manual",
    ),
    onboardCameraGuidelinesNext: document.getElementById(
      "onboard-camera-guidelines-next",
    ),
    onboardCameraPositionNext: document.getElementById(
      "onboard-camera-position-next",
    ),
    CameraScanNext: document.getElementById("CameraScan-next"),
    genderInput: document.getElementById("gender-input"),
    heightInput: document.getElementById("height-input"),
    weightInput: document.getElementById("weight-input"),
    ageInput: document.getElementById("age-input"),
    sizingCardContainer: document.getElementById("sizing-cards-container"),
    screenFit: document.getElementById("screen-fit"),
    screenProfile: document.getElementById("screen-profile"),
    screenProfileMeasurementDetails: document.getElementById(
      "screen-profile-measurement-details",
    ),
    screenProfileMeasurementEdit: document.getElementById(
      "screen-profile-measurement-edit",
    ),
    userMeasurementForm: document.getElementById("user-measurement-form"),
    tabFitBtn: document.getElementById("tab-fit-btn"),
    tabProfileBtn: document.getElementById("tab-profile-btn"),
    profileEditMeasurementBtn: document.getElementById(
      "profile-edit-measurement-btn",
    ),
    profileMeasurementManualConfirmChangeBtn: document.getElementById(
      "profile-measurement-manual-confirm-change-btn",
    ),
    shoulderInput: document.getElementById("shoulder-input"),
    chestInput: document.getElementById("chest-input"),
    hipInput: document.getElementById("hip-input"),
    waistInput: document.getElementById("waist-input"),
    torsoInput: document.getElementById("torso-input"),
    armInput: document.getElementById("arm-input"),
    legInput: document.getElementById("leg-input"),
    thighInput: document.getElementById("thigh-input"),
  };
}
function setupModalOpenClose(openButton, overlay) {
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
}

function setupOnboardingNavigation(
  screens,
  nextBtns,
  userDetailForm,
  userDetailArray,
  cameraController,
) {
  nextBtns.forEach((btn, index) => {
    if (!btn) return;
    // Special handling for the user input screen with validation
    if (
      btn === nextBtns[1]
      // onboardUserInputNext
    ) {
      btn.addEventListener("click", () => {
        if (userDetailForm.checkValidity()) {
          saveOnboardingUserDetails(userDetailArray, userDetailForm);
          screens.forEach((screen) => hideElement(screen));
          showElement(screens[index + 1]);
        } else {
          userDetailForm.reportValidity();
          console.error("Form is invalid. Please correct the errors.");
        }
      });
    } else if (btn === nextBtns[4]) {
      btn.addEventListener("click", () => {
        screens.forEach((screen) => hideElement(screen));
        showElement(screens[index + 1]);
        cameraController.startCamera();
      });
    } else if (btn === nextBtns[5]) {
      btn.addEventListener("click", () => {
        screens.forEach((screen) => hideElement(screen));
        showElement(screens[index + 1]);
      });
    } else {
      btn.addEventListener("click", () => {
        screens.forEach((screen) => hideElement(screen));
        showElement(screens[index + 1]);
      });
    }
  });
}

function saveOnboardingUserDetails(userDetailArray, form) {
  if (!form.checkValidity()) {
    form.reportValidity();
    console.error("Form is invalid. Please correct the errors.");
    return;
  }
  // console.log("User details saved:");
  // userDetailArray.forEach((ele) => {
  //   console.log(ele.value);
  // });
}

function setupRecommendationNavigation(
  buttons,
  extraElements,
  userMeasurementForm,
  measurementInputArray,
  userInfo,
  userDetailArray,
) {
  const {
    tabFitBtn,
    tabProfileBtn,
    profileEditMeasurementBtn,
    profileMeasurementManualConfirmChangeBtn,
    screenFit,
    screenProfile,
    screenProfileMeasurementDetails,
    screenProfileMeasurementEdit,
  } = extraElements;

  buttons.forEach((btn) => {
    if (btn === tabFitBtn) {
      btn.addEventListener("click", () => {
        showElement(screenFit);
        hideElement(screenProfile);
        hideElement(screenProfileMeasurementDetails);
        hideElement(screenProfileMeasurementEdit);
        tabFitBtn.classList.add("active");
        tabProfileBtn.classList.remove("active");
      });
    } else if (btn === tabProfileBtn) {
      btn.addEventListener("click", () => {
        showElement(screenProfile);
        showElement(screenProfileMeasurementDetails);
        hideElement(screenFit);
        hideElement(screenProfileMeasurementEdit);
        tabProfileBtn.classList.add("active");
        tabFitBtn.classList.remove("active");
      });
    } else if (btn === profileEditMeasurementBtn) {
      btn.addEventListener("click", () => {
        showElement(screenProfile);
        hideElement(screenFit);
        hideElement(screenProfileMeasurementDetails);
        showElement(screenProfileMeasurementEdit);
      });
    } else if (btn === profileMeasurementManualConfirmChangeBtn) {
      btn.addEventListener("click", () => {
        // Check if the form is valid before proceeding
        if (userMeasurementForm.checkValidity()) {
          saveProfileMeasurementDetails(
            measurementInputArray,
            userMeasurementForm,
            userInfo,
            userDetailArray,
          );
          showElement(screenProfile);
          showElement(screenProfileMeasurementDetails);
          hideElement(screenFit);
          hideElement(screenProfileMeasurementEdit);
        } else {
          userMeasurementForm.reportValidity();
          console.error("Form is invalid. Please correct the errors.");
        }
      });
    }
  });
}

const saveProfileMeasurementDetails = (
  measurementInputArray,
  measurementForm,
  userInfo,
  userDetailArray,
) => {
  if (!Array.isArray(measurementInputArray)) {
    console.error("Invalid measurementInputArray provided. Expected an array.");
    return;
  }

  console.log("Saving Profile Measurements...");

  measurementInputArray.forEach((inputEle) => {
    try {
      if (!inputEle || !inputEle.name) {
        throw new Error("Input element missing or has no name attribute");
      }

      const value = inputEle.value;
      if (value === "" || value === undefined) {
        console.warn(`Empty value for input with name "${inputEle.name}"`);
        return;
      }

      // If the key exists in userInfo, assign the value.
      if (inputEle.name in userInfo) {
        userInfo[inputEle.name] = inputEle.value;
      } else {
        console.error(`Unknown input name: ${inputEle.name}`);
      }
    } catch (error) {
      console.error("Error processing input element:", error, inputEle);
    }
  });
  console.log("Profile Measurements saved: ", userDetailArray);
};

//global DisplayFeedback function
function DisplayFeedback(message) {
  const userFeedback = document.getElementById("user-feedback");
  userFeedback.innerHTML = message;
}

function updateSilhouette(mode) {
  const silhouette = document.getElementById("expected-silhouette");
  if (!silhouette) return;

  switch (mode) {
    case "start":
      // console.log("silhouette start");
      silhouette.style.opacity = "0.3";
      break;
    case "start_2":
      // “detecting_one” or “ready_one” => silhouette 30%
      silhouette.src = "./images/side.png";
      silhouette.style.opacity = "0.3";

      break;
    case "disable":
      silhouette.style.opacity = "0";
      break;
    default:
      console.error("Invalid mode");
      break;
  }
}
