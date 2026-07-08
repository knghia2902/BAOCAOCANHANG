## Validation Architecture

As required by the Nyquist Validation framework, we must ensure these UI updates integrate smoothly without regressions.

**1. Verification Requirements:**
- **UI-01 Validation:** Verify the tabs correctly switch the context and the correct underlying service methods are prepared (e.g., `useOcr` flags change).
- **UI-02 Validation:** Attempt uploading a >15MB file. Confirm it does not proceed to the service layer and a clear Toast notification appears.
- **UI-03 Validation:** During a mock or real heavy conversion, verify the progress bar updates incrementally and the status string updates dynamically without freezing the DOM.

**2. Manual UAT Scenarios:**
- **Scenario A (File Size Limit):** Drop a 20MB file. Expected: Red Toast error, input cleared.
- **Scenario B (OCR Progress):** Drop an image on the OCR tab. Expected: Progress bar mounts, percentage climbs from 0 to 100, text changes ("Initializing Tesseract..." -> "Recognizing text..."), finally prompts download.
- **Scenario C (Responsiveness):** Shrink browser window to mobile width. Expected: Tabs become scrollable or stack gracefully; dropzone padding scales down.
