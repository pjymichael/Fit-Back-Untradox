//array to store screen id

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

document.addEventListener("DOMContentLoaded", () => {
  const elements = initializeElements();
  const {
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

  /*-------------------SETUPS------------------*/
  // 1. Grab references to all your elements

  // -- NEW: Append overlay to <body> so it's not nested in a limiting container --
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

  const saveProfileMeasurementDetails = (
    measurementInputArray,
    measurementForm,
  ) => {
    if (!Array.isArray(measurementInputArray)) {
      console.error(
        "Invalid measurementInputArray provided. Expected an array.",
      );
      return;
    }

    console.log("Saving Profile Measurements...");

    measurementInputArray.forEach((inputEle) => {
      try {
        // Check if input element exists and has a name attribute
        if (!inputEle || !inputEle.name) {
          throw new Error("Input element missing or has no name attribute");
        }

        // check if input is empty
        const value = inputEle.value;
        if (value === "" || value === undefined) {
          console.warn(`Empty value for input with name "${inputEle.name}"`);
          return; // Skip this input
        }

        // Update the userInfo dictionary based on the input name
        switch (inputEle.name) {
          case "shoulder":
            userInfo.shoulder = inputEle.value;
            break;
          case "chest":
            userInfo.chest = inputEle.value;
            break;
          case "hip":
            userInfo.hip = inputEle.value;
            break;
          case "waist":
            userInfo.waist = inputEle.value;
            break;
          case "torso":
            userInfo.torso = inputEle.value;
            break;
          case "arm":
            userInfo.arm = inputEle.value;
            break;
          case "leg":
            userInfo.leg = inputEle.value;
            break;
          case "thigh":
            userInfo.thigh = inputEle.value;
            break;
          default:
            console.error(`Unknown input name: ${inputEle.name}`);
        }
      } catch (error) {
        console.error("Error processing input element:", error, inputEle);
      }
    });
    console.log("Profile Measurements saved: ", userDetailArray);
  };

  const saveOnboardingUserDetails = (userDetailArray, form) => {
    // Check if the form is valid
    if (!form.checkValidity()) {
      // This will show native validation messages
      form.reportValidity();
      console.error("Form is invalid. Please correct the errors.");
      return; // Stop processing if the form is invalid
    }

    console.log("User details saved:");
    userDetailArray.forEach((ele) => {
      console.log(ele.value);
    });
  };

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

  //store as array
  const onboardScreensArray = [
    onboardWelcome,
    onboardUserInput,
    onboardCameraPrompt,
    onboardCameraGuidelines,
    onboardCameraPosition,
    recommendationContent,
  ];

  //store as array
  const onboardNextBtnsArray = [
    onboardWelcomeNext,
    onboardUserInputNext,
    onboardCameraPromptNext,
    onboardCameraGuidelinesNext,
    onboardCameraPositionNext,
  ];
  //EVENTS

  //onboarding screen navigating
  //setup listeners to hide and show onboard screens
  onboardNextBtnsArray.forEach((btn, index) => {
    if (btn == onboardCameraPositionNext) {
      btn.addEventListener("click", () => {
        onboardScreensArray.forEach((screen) => hideElement(screen));
      });
    }

    if (btn) {
      // Ensure button exists
      if (btn == onboardUserInputNext) {
        // special rule for form validation
        btn.addEventListener("click", () => {
          // Check if the form is valid
          if (userDetailForm.checkValidity()) {
            saveOnboardingUserDetails(userDetailArray, userDetailForm);
            onboardScreensArray.forEach((screen) => hideElement(screen));
            // Show next screen
            showElement(onboardScreensArray[index + 1]);
          } else {
            // Trigger native validation messages
            userDetailForm.reportValidity();
            console.error("Form is invalid. Please correct the errors.");
          }
        });
      } else {
        btn.addEventListener("click", () => {
          // Hide all screens
          onboardScreensArray.forEach((screen) => hideElement(screen));

          // Show next screen
          showElement(onboardScreensArray[index + 1]);
        });
      }
    }

    if (btn == onboardUserInputNext) {
    }
  });

  const userDetailArray = [genderInput, heightInput, weightInput, ageInput];
  //Grab References to pose figure
  //ask tristan and lucas

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

  recommendationScreenBtn.forEach((btn, index) => {
    switch (btn) {
      case tabFitBtn:
        btn.addEventListener("click", () => {
          showElement(screenFit);
          hideElement(screenProfile);
          hideElement(screenProfileMeasurementDetails);
          hideElement(screenProfileMeasurementEdit);

          tabFitBtn.classList.add("active");
          tabProfileBtn.classList.remove("active");
        });

        break;

      case tabProfileBtn:
        btn.addEventListener("click", () => {
          showElement(screenProfile);
          showElement(screenProfileMeasurementDetails);
          hideElement(screenFit);
          hideElement(screenProfileMeasurementEdit);

          tabProfileBtn.classList.add("active");
          tabFitBtn.classList.remove("active");
        });

        break;

      case profileEditMeasurementBtn:
        btn.addEventListener("click", () => {
          showElement(screenProfile);
          hideElement(screenFit);
          hideElement(screenProfileMeasurementDetails);
          showElement(screenProfileMeasurementEdit);
        });
        break;

      case profileMeasurementManualConfirmChangeBtn:
        btn.addEventListener("click", () => {
          // Check if the form is valid
          // Check if the form is valid
          if (userMeasurementForm.checkValidity()) {
            saveProfileMeasurementDetails(
              measurementInputArray,
              userMeasurementForm,
            );
            showElement(screenProfile);
            showElement(screenProfileMeasurementDetails);

            hideElement(screenFit);
            hideElement(screenProfileMeasurementEdit);
          } else {
            // Trigger native validation messages
            userMeasurementForm.reportValidity();
            console.error("Form is invalid. Please correct the errors.");
          }
        });
        break;
    }
  });

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
});

//helper functions
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
