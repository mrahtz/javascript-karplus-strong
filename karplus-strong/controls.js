function getOptions() {
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

    var stereoSpreadSlider =
        document.getElementById("stereoSpread");
    var stereoSpread = stereoSpreadSlider.valueAsNumber;
    
    return {
        stringTension: stringTension,
        characterVariation: characterVariation,
        stringDamping: stringDamping,
        stringDampingVariation: stringDampingVariation,
        stringDampingCalculation: stringDampingCalculation,
        pluckDamping: pluckDamping,
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
