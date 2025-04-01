//array to store screen id
import { drawSkeleton } from "./drawUtils.js";
import { initFirebase, uploadToFirebase } from "./firebaseUtils.js";
import { firebaseConfig, TM_URL } from "./env.js";
import {
  setWorkerInstance,
  requestVersion,
  loadModel,
  classifyFrame,
} from "./workerFunctionsHelper.js";
import { initializePoseDetector, estimatePoses } from "./poseDetector.js";
//variable storage for user
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

let currentSize;
let sizingData;
let glider;

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

let userInfo = {
  gender: null,
  height: null,
  weight: null,
  age: null,
  shoulder: null,
  hip: null,
  arm: null,
  leg: null,
  chest: null,
  waist: null,
  torso: null,
  thigh: null,
};

document.addEventListener("DOMContentLoaded", () => {
  const elements = initializeElements();
  const {
    camerascanclass1,
    camerascanclass2,
    productInfo,
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

  // -- NEW: Append overlay to <body> so it's not nested in a limiting container --
  document.body.appendChild(overlay);

  setupModalOpenClose(openButton, overlay);

  //sizes: keys of the sizes object (eg s,m,l etc...) (used to generate carousel)
  let sizes;
  //categories: category of sizing (chest, shoulder, leg, waist etc...) (use to generate recommender card, with )
  let categories;
  //ensure product info exist
  if (productInfo) {
    try {
      let scriptTag = document.getElementById("sizing-data");
      sizingData = JSON.parse(scriptTag.textContent);
      const sizeObj = sizingData.sizes;
      console.log(sizingData);
      sizes = Object.keys(sizingData.sizes);
      categories = Object.keys(sizeObj[sizes[0]]); // ["torso", "shoulder", "chest", "sleeve"]

      console.log("Sizes:", sizes);
      console.log("Categories:", categories);
    } catch (error) {
      console.error("Failed to parse sizing JSON", error);
    }
  }

  //dictionary storage of user information

  //////////////////RECOMMENDER CAROUSEL PORTION///////////////////////////////

  // if (sizes && sizes.length > 0) {
  //   const gliderElement = document.querySelector('.glider');
  //   gliderElement.innerHTML = ""; // Clear any existing slides

  //   sizes.forEach((size, index) => {
  //     const slide = document.createElement('div');
  //     slide.classList.add('slide');
  //     slide.setAttribute('data-slide', index + 1);
  //     slide.setAttribute('tabindex', '0');
  //     slide.innerHTML = `<h1>${size.toUpperCase()}</h1>`;
  //     gliderElement.appendChild(slide);
  //   });
  // }
  // var glider = new Glider(document.querySelector('.glider'), {
  //   slidesToShow: 1,
  //   dots: '.dots',
  //   draggable: true,
  //   scrollLock: true,
  //   rewind: true,
  //   arrows: {
  //     prev: '.glider-prev',
  //     next: '.glider-next'
  //   }
  // });

  // // console.log(glider)
  // var numberOfSliders = document.querySelectorAll('.glider-slide').length

  // function getPreviousSlide(currentSlide) {
  //   if (currentSlide === 1) {
  //     return numberOfSliders;
  //   } else {
  //     return currentSlide - 1;
  //   }
  // }

  // function goToPreviousSlide(currentSlide) {
  //     var previousSlide = getPreviousSlide(currentSlide);
  //     var imageContent = document.querySelector(`.glider-slide:nth-of-type(${previousSlide})`);
  //     document.querySelector('#hidden-image').innerHTML = imageContent.innerHTML;
  // }

  // function getNextSlide(currentSlide) {
  //   if (currentSlide === numberOfSliders) {
  //     return 1;
  //   } else {
  //     return currentSlide + 1;
  //   }
  // }

  // function goToNextSlide(currentSlide) {
  //     var previousSlide = getNextSlide(currentSlide);
  //     var imageContent = document.querySelector(`.glider-slide:nth-of-type(${previousSlide})`);
  //     document.querySelector('#hidden-image').innerHTML = imageContent.innerHTML;
  // }

  // document.querySelector('.glider-prev').addEventListener("click", function() {
  //   var currentSlide = parseInt(document.querySelector('.glider-slide.active').getAttribute('data-slide'));
  //   goToPreviousSlide(currentSlide)
  // });

  // document.querySelector('.glider-next').addEventListener("click", function() {
  //   var currentSlide = parseInt(document.querySelector('.glider-slide.active').getAttribute('data-slide'));
  //   goToNextSlide(currentSlide)
  // });

  // // Listen for the 'glider-slide-visible' event to know when the slide changes
  // document.querySelector('.glider').addEventListener('glider-slide-visible', function(event) {
  //   // event.detail.slide gives the index of the new active slide.
  //   // This index might start at 0 or 1 based on Glider.js configuration.
  //   console.log('New active slide is:', event.detail.slide);
  //   // event.detail.slide is the new active slide's index (assuming 0-based)
  //   let activeIndex = event.detail.slide;
  //   let activeSize = sizes[activeIndex];  // For example, "M"

  //   // Retrieve the size range data for the active size
  //   let currentSizeData = sizingData.sizes[activeSize];

  //   // For each category (e.g., chest, torso, etc.)
  //   categories.forEach(category => {
  //     // Get the user's measurement for this category (assumes userInfo is kept updated)
  //     let userMeasurement = userInfo[category];

  //     // Get the measurement range for the current size and category
  //     let range = currentSizeData[category];

  //     if (range && userMeasurement) {
  //       // Evaluate the fit (e.g., "Too Small", "Just Right", or "Too Big")
  //       let fitResult = evaluateFit(userMeasurement, range);

  //       // Update the corresponding recommendation card's text
  //       // Assuming each recommender card has a data attribute matching the category in lowercase.
  //       let card = document.querySelector(`.sizing-card[data-category="${category.toLowerCase()}"] p`);
  //       if (card) {
  //         card.textContent = fitResult;
  //       }
  //     }
  //   });

  // });
  //////////////////////////////////////////////////////////////////////////helper functions

  function evaluateFit(userMeasurement, range) {
    console.log(range);
    // Ensure both values are numbers (if needed, parseFloat)
    userMeasurement = parseFloat(userMeasurement);
    if (userMeasurement < range.min) {
      return "Too Big";
    } else if (userMeasurement > range.max) {
      return "Too Small";
    } else {
      return "Just Right";
    }
  }

  const constructRecommenderCard = (productSizeCategory) => {
    //product size category will be an array of categories (e.g) [chest, torso, shoulder]
    //loop through and create a sizing card like the following (with h5 using category, set p text content as NA first )
    // <div class="sizing-card">
    // <h5>Shoulder</h5>
    // <p>Just Right</p>
    // </div>
    //construct the sizing card with the title based on category
    //and then append in to <div id="sizing-cards-container" class="sizing-cards-container">
    //afterwards, any information update will be handled by another function
    console.log("running construct recommender card function");
    const container = document.getElementById("sizing-cards-container");

    // Make sure the container exists
    if (!container) {
      console.warn("sizing-cards-container not found");
      return;
    }

    // Clear previous cards (optional, depending on behavior you want)
    container.innerHTML = "";

    productSizeCategory.forEach((category) => {
      // Create the card wrapper
      const card = document.createElement("div");
      card.classList.add("sizing-card");
      card.setAttribute("data-category", category.toLowerCase());

      // Create the title element
      const title = document.createElement("h5");
      title.textContent = category.charAt(0).toUpperCase() + category.slice(1); // Capitalize

      // Create the placeholder text
      const valueText = document.createElement("p");
      valueText.textContent = "N/A"; // Placeholder to update later

      // Append title + text to card, then card to container
      card.appendChild(title);
      card.appendChild(valueText);
      container.appendChild(card);
    });
  };

  // const saveOnboardingUserDetails = (userDetailArray, form) => {
  //   if (!Array.isArray(userDetailArray)) {
  //     console.error("Invalid userDetailArray provided. Expected an array.");
  //     return;
  //   }

  //   console.log("Saving Onboarding User Details...");

  //   const updates = {};

  //   userDetailArray.forEach((inputEle) => {
  //     try {
  //       if (!inputEle || !inputEle.name) {
  //         throw new Error("Input element missing or has no name attribute");
  //       }

  //       const value = inputEle.value;
  //       if (value === "" || value === undefined) {
  //         console.warn(`Empty value for input with name "${inputEle.name}"`);
  //         return;
  //       }

  //       updates[inputEle.name] = value;
  //     } catch (error) {
  //       console.error(
  //         "Error processing onboarding input element:",
  //         error,
  //         inputEle,
  //       );
  //     }
  //   });

  //   updateUserInfo(updates);
  //   console.log("Onboarding Details saved:", userInfo);
  // };

  //store as array

  const onboardScreensArray = [
    onboardWelcome,
    onboardUserInput,
    onboardCameraPrompt,
    onboardCameraGuidelines,
    onboardCameraPosition,
    CameraScan,
    recommendationContent,
  ];

  //Grab reference to buttons
  //store as array
  const onboardNextBtnsArray = [
    onboardWelcomeNext,
    onboardUserInputNext,
    onboardCameraPromptNext,
    onboardCameraGuidelinesNext,
    onboardCameraPositionNext,
    CameraScanNext,
  ];
  //EVENTS

  // const userDetailArray = [genderInput, heightInput, weightInput, ageInput];

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
  const userDetailArray = [genderInput, heightInput, weightInput, ageInput];

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

  //onboarding screen navigating
  //setup listeners to hide and show onboard screens
  // onboardNextBtnsArray.forEach((btn, index) => {
  //   if (btn == onboardCameraPositionNext) {
  //     btn.addEventListener("click", () => {
  //       onboardScreensArray.forEach((screen) => hideElement(screen));
  //     });
  //   }

  //   if (btn) {
  //     // Ensure button exists
  //     if (btn == onboardUserInputNext) {
  //       // special rule for form validation
  //       btn.addEventListener("click", () => {
  //         // Check if the form is valid
  //         if (userDetailForm.checkValidity()) {
  //           saveOnboardingUserDetails(userDetailArray, userDetailForm);
  //           onboardScreensArray.forEach((screen) => hideElement(screen));
  //           // Show next screen
  //           showElement(onboardScreensArray[index + 1]);
  //         } else {
  //           // Trigger native validation messages
  //           userDetailForm.reportValidity();
  //           console.error("Form is invalid. Please correct the errors.");
  //         }
  //       });
  //     } else {
  //       btn.addEventListener("click", () => {
  //         // Hide all screens
  //         onboardScreensArray.forEach((screen) => hideElement(screen));

  //         // Show next screen
  //         showElement(onboardScreensArray[index + 1]);

  //         //init glider here
  //         if (index + 1 == 5) {
  //           console.log("initing glider");
  //           const gliderElement = document.querySelector(".glider");
  //           gliderElement.innerHTML = ""; // Clear any existing slides

  //           sizes.forEach((size, index) => {
  //             const slide = document.createElement("div");
  //             slide.classList.add("slide");
  //             slide.setAttribute("data-slide", index + 1);
  //             slide.setAttribute("tabindex", "0");
  //             slide.innerHTML = `<h1>${size.toUpperCase()}</h1>`;
  //             gliderElement.appendChild(slide);
  //           });

  //           glider = new Glider(document.querySelector(".glider"), {
  //             slidesToShow: 1,
  //             dots: ".dots",
  //             draggable: true,
  //             scrollLock: true,
  //             rewind: true,
  //             arrows: {
  //               prev: ".glider-prev",
  //               next: ".glider-next",
  //             },
  //           });

  //           // console.log(glider)
  //           var numberOfSliders =
  //             document.querySelectorAll(".glider-slide").length;

  //           glider.refresh();

  //           function getPreviousSlide(currentSlide) {
  //             if (currentSlide === 1) {
  //               return numberOfSliders;
  //             } else {
  //               return currentSlide - 1;
  //             }
  //           }

  //           function goToPreviousSlide(currentSlide) {
  //             var previousSlide = getPreviousSlide(currentSlide);
  //             var imageContent = document.querySelector(
  //               `.glider-slide:nth-of-type(${previousSlide})`,
  //             );
  //           }

  //           function getNextSlide(currentSlide) {
  //             if (currentSlide === numberOfSliders) {
  //               return 1;
  //             } else {
  //               return currentSlide + 1;
  //             }
  //           }

  //           function goToNextSlide(currentSlide) {
  //             var previousSlide = getNextSlide(currentSlide);
  //             var imageContent = document.querySelector(
  //               `.glider-slide:nth-of-type(${previousSlide})`,
  //             );
  //           }

  //           document
  //             .querySelector(".glider-prev")
  //             .addEventListener("click", function () {
  //               var currentSlide = parseInt(
  //                 document
  //                   .querySelector(".glider-slide.active")
  //                   .getAttribute("data-slide"),
  //               );
  //               goToPreviousSlide(currentSlide);
  //             });

  //           document
  //             .querySelector(".glider-next")
  //             .addEventListener("click", function () {
  //               var currentSlide = parseInt(
  //                 document
  //                   .querySelector(".glider-slide.active")
  //                   .getAttribute("data-slide"),
  //               );
  //               goToNextSlide(currentSlide);
  //             });

  //           // Listen for the 'glider-slide-visible' event to know when the slide changes
  //           document
  //             .querySelector(".glider")
  //             .addEventListener("glider-slide-visible", function (event) {
  //               // event.detail.slide gives the index of the new active slide.
  //               // This index might start at 0 or 1 based on Glider.js configuration.
  //               console.log("New active slide is:", event.detail.slide);
  //               // event.detail.slide is the new active slide's index (assuming 0-based)
  //               let activeIndex = event.detail.slide;
  //               let activeSize = sizes[activeIndex]; // For example, "M"

  //               // Retrieve the size range data for the active size
  //               let currentSizeData = sizingData.sizes[activeSize];

  //               // For each category (e.g., chest, torso, etc.)
  //               categories.forEach((category) => {
  //                 // Get the user's measurement for this category (assumes userInfo is kept updated)
  //                 let userMeasurement = userInfo[category];

  //                 // Get the measurement range for the current size and category
  //                 let range = currentSizeData[category];

  //                 if (range && userMeasurement) {
  //                   // Evaluate the fit (e.g., "Too Small", "Just Right", or "Too Big")
  //                   let fitResult = evaluateFit(userMeasurement, range);

  //                   // Update the corresponding recommendation card's text
  //                   // Assuming each recommender card has a data attribute matching the category in lowercase.
  //                   let card = document.querySelector(
  //                     `.sizing-card[data-category="${category.toLowerCase()}"] p`,
  //                   );
  //                   if (card) {
  //                     card.textContent = fitResult;
  //                   }
  //                 }
  //               });
  //             });
  //         }
  //       });
  //     }
  //   }

  //   if (btn == onboardUserInputNext) {
  //   }
  // });

  //////////////////////////NAVIGATIONS//////////////////////////
  // recommendationScreenBtn.forEach((btn, index) => {
  //   switch (btn) {
  //     case tabFitBtn:
  //       btn.addEventListener("click", () => {
  //         showElement(screenFit);
  //         hideElement(screenProfile);
  //         hideElement(screenProfileMeasurementDetails);
  //         hideElement(screenProfileMeasurementEdit);

  //         tabFitBtn.classList.add("active");
  //         tabProfileBtn.classList.remove("active");
  //         glider.refresh();
  //       });

  //       break;

  //     case tabProfileBtn:
  //       btn.addEventListener("click", () => {
  //         showElement(screenProfile);
  //         showElement(screenProfileMeasurementDetails);
  //         hideElement(screenFit);
  //         hideElement(screenProfileMeasurementEdit);

  //         tabProfileBtn.classList.add("active");
  //         tabFitBtn.classList.remove("active");
  //       });

  //       break;

  //     case profileEditMeasurementBtn:
  //       btn.addEventListener("click", () => {
  //         showElement(screenProfile);
  //         hideElement(screenFit);
  //         hideElement(screenProfileMeasurementDetails);
  //         showElement(screenProfileMeasurementEdit);
  //       });
  //       break;

  //     case profileMeasurementManualConfirmChangeBtn:
  //       btn.addEventListener("click", () => {
  //         // Check if the form is valid
  //         // Check if the form is valid
  //         if (userMeasurementForm.checkValidity()) {
  //           saveProfileMeasurementDetails(
  //             measurementInputArray,
  //             userMeasurementForm,
  //           );
  //           showElement(screenProfile);
  //           showElement(screenProfileMeasurementDetails);

  //           hideElement(screenFit);
  //           hideElement(screenProfileMeasurementEdit);
  //         } else {
  //           // Trigger native validation messages
  //           userMeasurementForm.reportValidity();
  //           console.error("Form is invalid. Please correct the errors.");
  //         }
  //       });
  //       break;
  //   }
  // });
  ////////////////////////////////////////////////////

  //////////////////////////Recommender section//////////////////////////

  //initially, run the recommender card constructor function

  constructRecommenderCard(categories);
  //Interactivity of recommender card and svg
  const cards = document.querySelectorAll(".sizing-card");
  cards.forEach((card) => {
    const category = card.getAttribute("data-category");
    const targetSvg = document.getElementById(`${category}-recommendation-svg`);

    if (targetSvg) {
      card.addEventListener("mouseover", () => {
        const shapeElements = targetSvg.querySelectorAll(
          "path, ellipse, line, circle, polygon, rect",
        );
        shapeElements.forEach((shape) => shape.classList.add("fill-black"));
      });

      card.addEventListener("mouseout", () => {
        const shapeElements = targetSvg.querySelectorAll(
          "path, ellipse, line, circle, polygon, rect",
        );
        shapeElements.forEach((shape) => shape.classList.remove("fill-black"));
      });
    }

    //special Cases (sleeve, leg)
    //Special case:"sleeve" = forearm + bicep + shoulder
    if (category === "sleeve") {
      const relatedIds = [
        "forearm-recommendation-svg",
        "bicep-recommendation-svg",
        "shoulder-recommendation-svg",
      ];

      card.addEventListener("mouseover", () => {
        relatedIds.forEach((id) => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll(
              "path, ellipse, line, circle, polygon, rect",
            );
            shapes.forEach((shape) => shape.classList.add("fill-black"));
          }
        });
      });

      card.addEventListener("mouseout", () => {
        relatedIds.forEach((id) => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll(
              "path, ellipse, line, circle, polygon, rect",
            );
            shapes.forEach((shape) => shape.classList.remove("fill-black"));
          }
        });
      });
    }

    //Special case: "leg" = thigh + calf
    if (category === "leg") {
      const relatedIds = [
        "thigh-recommendation-svg",
        "calf-recommendation-svg",
      ];

      card.addEventListener("mouseover", () => {
        relatedIds.forEach((id) => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll(
              "path, ellipse, line, circle, polygon, rect",
            );
            shapes.forEach((shape) => shape.classList.add("fill-black"));
          }
        });
      });

      card.addEventListener("mouseout", () => {
        relatedIds.forEach((id) => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll(
              "path, ellipse, line, circle, polygon, rect",
            );
            shapes.forEach((shape) => shape.classList.remove("fill-black"));
          }
        });
      });
    }
  });

  //update the recommendation card values (loose, justright, tight) based on user data and size chosen
  /*updateRecommmenderCardValues(userData)

  */
  //My Profile
  //Interactivity of svg and measurement card in myprofile tab
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

  // Assuming sizes is an array like ["s", "m", "l"]
  // if (sizes && sizes.length > 0) {
  //   const gliderElement = document.querySelector('.glider');
  //   gliderElement.innerHTML = ""; // Clear any existing slides

  //   sizes.forEach((size, index) => {
  //     const slide = document.createElement('div');
  //     slide.classList.add('slide');
  //     slide.setAttribute('data-slide', index + 1);
  //     slide.setAttribute('tabindex', '0');
  //     slide.innerHTML = `<h1>${size.toUpperCase()}</h1>`;
  //     gliderElement.appendChild(slide);
  //   });
  // } else {
  //     // Otherwise, initialize it
  //     glider = new Glider(gliderElement, {
  //       slidesToShow: 1,
  //       dots: '.dots',
  //       draggable: true,
  //       scrollLock: true,
  //       rewind: true,
  //       arrows: {
  //         prev: '.glider-prev',
  //         next: '.glider-next'
  //       }
  //     });
  // }

  // let numberOfSliders = document.querySelectorAll('.glider-slide').length

  // function getPreviousSlide(currentSlide) {
  //   if (currentSlide === 1) {
  //     return numberOfSliders;
  //   } else {
  //     return currentSlide - 1;
  //   }
  // }

  // function goToPreviousSlide(currentSlide) {
  //     var previousSlide = getPreviousSlide(currentSlide);
  //     var imageContent = document.querySelector(`.glider-slide:nth-of-type(${previousSlide})`);
  //     document.querySelector('#hidden-image').innerHTML = imageContent.innerHTML;
  // }

  // function getNextSlide(currentSlide) {
  //   if (currentSlide === numberOfSliders) {
  //     return 1;
  //   } else {
  //     return currentSlide + 1;
  //   }
  // }

  // function goToNextSlide(currentSlide) {
  //     var previousSlide = getNextSlide(currentSlide);
  //     var imageContent = document.querySelector(`.glider-slide:nth-of-type(${previousSlide})`);
  //     document.querySelector('#hidden-image').innerHTML = imageContent.innerHTML;
  // }

  // document.querySelector('.glider-prev').addEventListener("click", function() {
  //   var currentSlide = parseInt(document.querySelector('.glider-slide.active').getAttribute('data-slide'));
  //   goToPreviousSlide(currentSlide)
  // });

  // document.querySelector('.glider-next').addEventListener("click", function() {
  //   var currentSlide = parseInt(document.querySelector('.glider-slide.active').getAttribute('data-slide'));
  //   goToNextSlide(currentSlide)
  // });

  // // Listen for the 'glider-slide-visible' event to know when the slide changes
  // document.querySelector('.glider').addEventListener('glider-slide-visible', function(event) {
  //   // event.detail.slide gives the index of the new active slide.
  //   // This index might start at 0 or 1 based on Glider.js configuration.
  //   console.log('New active slide is:', event.detail.slide);
  // });

  //Camera Scan code

  initFirebase(firebaseConfig);

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

    // analysisState.state = "final_state"; // debugging statement
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
        // tabFitBtn.click();
        console.log("Switched to Fit tab after detection completed");
        camerascanclass1.style.display = "none";
        console.log(camerascanclass2);
        camerascanclass2.classList.remove("hidden");
        console.log(camerascanclass2);
        cameraController.deactivateCamera();
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

const showElement = (ele) => {
  ele.classList.add("visible");
  ele.classList.remove("hidden");
};

const hideElement = (ele) => {
  ele.classList.add("hidden");
  ele.classList.remove("visible");
};

function initializeElements() {
  return {
    camerascanclass2: document.getElementById("CameraScan-class2"),
    camerascanclass1: document.getElementById("CameraScan-class1"),
    productInfo: document.getElementById("sizing-data"),
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

const saveOnboardingUserDetails = (userDetailArray, form) => {
  if (!Array.isArray(userDetailArray)) {
    console.error("Invalid userDetailArray provided. Expected an array.");
    return;
  }

  console.log("Saving Onboarding User Details...");

  const updates = {};

  userDetailArray.forEach((inputEle) => {
    try {
      if (!inputEle || !inputEle.name) {
        throw new Error("Input element missing or has no name attribute");
      }

      const value = inputEle.value;
      if (value === "" || value === undefined) {
        console.warn(`Empty value for input with name "${inputEle.name}"`);
        return;
      }

      updates[inputEle.name] = value;
    } catch (error) {
      console.error(
        "Error processing onboarding input element:",
        error,
        inputEle,
      );
    }
  });

  updateUserInfo(updates);
  console.log("Onboarding Details saved:", userInfo);
};

function updateUserInfo(updates) {
  //takes in object, can handle partial objects
  Object.keys(updates).forEach((key) => {
    if (userInfo.hasOwnProperty(key)) {
      userInfo[key] = updates[key];
    }
  });
}

function updateMeasurementCards() {
  const cards = document.querySelectorAll(".measurement-card");

  cards.forEach((card) => {
    const cardId = card.id; // e.g. "arm-measurement-card"
    const parts = cardId.split("-"); // ["arm", "measurement", "card"]
    const key = parts[0]; // "arm"

    if (userInfo.hasOwnProperty(key)) {
      const value = userInfo[key];

      // Find the <p> element that holds the value (assume it's the second <p>)
      const valueElement = card.querySelectorAll("p")[1];

      if (valueElement) {
        valueElement.textContent = value ? `${value}cm` : "N/A";
      }
    }
  });
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
        console.log("Fit tab clicked");
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

const saveProfileMeasurementDetails = (measurementInputArray) => {
  if (!Array.isArray(measurementInputArray)) {
    console.error("Invalid measurementInputArray provided. Expected an array.");
    return;
  }

  console.log("Saving Profile Measurements...");

  const updates = {};

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

      updates[inputEle.name] = value;
    } catch (error) {
      console.error("Error processing input element:", error, inputEle);
    }
  });

  updateUserInfo(updates);
  console.log("Profile Measurements saved:", userInfo);

  updateMeasurementCards();
};

function DisplayFeedback(message) {
  const userFeedback = document.getElementById("user-feedback");
  if (userFeedback.innerHTML === message) return;
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
      silhouette.style.opacity = "0.3";
      silhouette.src = silhouette.dataset.side;
      break;
    case "disable":
      silhouette.style.opacity = "0";
      break;
    default:
      console.error("Invalid mode");
      break;
  }
}
