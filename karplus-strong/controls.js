function getControlsValues() {
    var stringTensionSlider =
        document.getElementById("stringTension");
    var stringTension = stringTensionSlider.valueAsNumber;

    var characterVariationSlider =
        document.getElementById("characterVariation");
    var characterVariation = characterVariationSlider.valueAsNumber;

    var stringDampingSlider =
        document.getElementById("stringDamping");
    var stringDamping = stringDampingSlider.valueAsNumber;

    var stringDampingVariationSlider =
        document.getElementById("stringDampingVariation");
    var stringDampingVariation = stringDampingVariationSlider.valueAsNumber;

    var pluckDampingSlider =
        document.getElementById("pluckDamping");
    var pluckDamping = pluckDampingSlider.valueAsNumber;

    var pluckDampingVariationSlider =
        document.getElementById("pluckDampingVariation");
    var pluckDampingVariation = pluckDampingVariationSlider.valueAsNumber;

    var stereoSpreadSlider =
        document.getElementById("stereoSpread");
    var stereoSpread = stereoSpreadSlider.valueAsNumber;

    var magicCalculationRadio =
        document.getElementById("magicCalculation");
    var directCalculationRadio =
        document.getElementById("directCalculation");
    var stringDampingCalculation;
    if (magicCalculationRadio.checked) {
        stringDampingCalculation = "magic";
    } else if (directCalculationRadio.checked) {
        stringDampingCalculation = "direct";
    }

    var noBodyRadio =
        document.getElementById("noBody");
    var simpleBodyRadio =
        document.getElementById("simpleBody");
    var body;
    if (noBodyRadio.checked) {
        body = "none";
    } else if (simpleBodyRadio.checked) {
        body = "simple";
    }

    return {
        stringTension: stringTension,
        characterVariation: characterVariation,
        stringDamping: stringDamping,
        stringDampingVariation: stringDampingVariation,
        stringDampingCalculation: stringDampingCalculation,
        pluckDamping: pluckDamping,
        pluckDampingVariation: pluckDampingVariation,
        body: body,
        stereoSpread: stereoSpread
    };
}

// calculate the constant used for the low-pass filter
// used in the Karplus-Strong loop
function calculateSmoothingFactor(string, tab, options) {
    var smoothingFactor;
    if (options.stringDampingCalculation == "direct") {
        smoothingFactor = options.stringDamping;
    } else if (options.stringDampingCalculation == "magic") {
        // this is copied verbatim from the flash one
        // is magical, don't know how it works
        var noteNumber = (string.semitoneIndex + tab - 19)/44;
        smoothingFactor =
            options.stringDamping +
            Math.pow(noteNumber, 0.5) * (1 - options.stringDamping) * 0.5 +
            (1 - options.stringDamping) *
                Math.random() *
                options.stringDampingVariation;
    }
    return smoothingFactor;
}

function toggleGuitarPlaying(buttonID, mode) {
    var startStopButton = document.getElementById(buttonID);
    var text = startStopButton.innerHTML;
    var playState = document.getElementById("playState");


    if (text == "Start") {
        startStopButton.innerHTML = "Stop";
        playState.value = "playing";
        guitar.setMode(mode);
        startGuitarPlaying();
    } else {
        startStopButton.innerHTML = "Start";
        playState.value = "stopped";
    }
}
function updateStringDamping() {
    var stringDampingInput = document.getElementById("stringDamping");
    var stringDamping = stringDampingInput.valueAsNumber;
    var output = document.getElementById("stringDampingValue");
    output.value = stringDamping.toFixed(1);
}
function updateStringDampingVariation() {
    var stringDampingVariationInput =
        document.getElementById("stringDampingVariation");
    var stringDampingVariation = stringDampingVariationInput.valueAsNumber;
    var output = document.getElementById("stringDampingVariationValue");
    output.value = stringDampingVariation.toFixed(2);
}
function updateStringTension() {
    var stringTensionInput = document.getElementById("stringTension");
    var stringTension = stringTensionInput.valueAsNumber;
    var output = document.getElementById("stringTensionValue");
    output.value = stringTension.toFixed(1);
}
function updateCharacterVariation() {
    var characterVariationInput = document.getElementById("characterVariation");
    var characterVariation = characterVariationInput.valueAsNumber;
    var output = document.getElementById("characterVariationValue");
    output.value = characterVariation.toFixed(1);
}
function updateStereoSpread() {
    var stereoSpreadInput = document.getElementById("stereoSpread");
    var stereoSpread = stereoSpreadInput.valueAsNumber;
    var output = document.getElementById("stereoSpreadValue");
    output.value = stereoSpread.toFixed(1);
}
function updatePluckDamping() {
    var pluckDampingInput = document.getElementById("pluckDamping");
    var pluckDamping = pluckDampingInput.valueAsNumber;
    var output = document.getElementById("pluckDampingValue");
    output.value = pluckDamping.toFixed(1);
}
function updatePluckDampingVariation() {
    var pluckDampingVariationInput = document.getElementById("pluckDampingVariation");
    var pluckDampingVariation = pluckDampingVariationInput.valueAsNumber;
    var output = document.getElementById("pluckDampingVariationValue");
    output.value = pluckDampingVariation.toFixed(2);
}
function updateFilterCutoff() {
    var filterCutoffInput = document.getElementById("filterCutoff");
    var filterCutoff = filterCutoffInput.valueAsNumber;
    var output = document.getElementById("filterCutoffValue");
    output.value = filterCutoff.toFixed(1);
}
