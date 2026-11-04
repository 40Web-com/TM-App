# TM AI Studio — Private Local Engine

## Current state

The AI Studio UI currently supports local file selection and previews only. It does not send media to a backend or run inference. Keep this distinction visible until a real processor is connected.

## Personal-use architecture

- TM-App remains the frontend.
- FaceFusion runs on the user's own computer, not GitHub Pages or Supabase Edge Functions.
- Keep the FaceFusion service bound to loopback (`127.0.0.1`) by default.
- Do not create a public Gradio share link, public tunnel, or exposed GPU endpoint.
- Do not add paid API keys, cloud GPU, hosted inference, or billing integrations without explicit approval.
- Uploads should stay on the user's machine unless they explicitly choose otherwise.

## FaceFusion local install

Use the official installation guide: https://docs.facefusion.io/installation

The official docs describe a Python 3.12 environment, cloning the FaceFusion repository, installing the selected ONNX Runtime backend, and launching with `python facefusion.py run --open-browser`. The exact install command depends on OS and hardware (CPU, CUDA/NVIDIA, DirectML/Windows, CoreML/macOS, etc.).

FaceFusion's default Gradio UI commonly listens on `http://127.0.0.1:7860`. Confirm the actual URL printed by FaceFusion before opening it. Its standalone UI is the safe initial local integration; this is not yet a direct TM-App API connection.

## Licensing and model caveat

FaceFusion source code is OpenRAIL-AS licensed. Model weights have their own terms and must be checked individually. Do not bundle model weights into TM-App or assume model licenses allow commercial redistribution. Personal use still needs to follow the relevant model terms.

## Integration safety checklist

Before implementing direct browser-to-engine processing:

1. Verify the installed FaceFusion version and supported API/job interface.
2. Confirm browser CORS and local-network/loopback restrictions for the actual deployed TM-App origin.
3. Use a local-only service with authentication or an explicit local pairing step if a bridge is required.
4. Validate image/video MIME type, size, and extension; never accept arbitrary paths or shell commands from the browser.
5. Keep outputs in a user-selected local folder and clean temporary files.
6. Add clear progress, cancellation, failure, and download states.
7. Never expose the local engine to the internet by default.

## Next step

Confirm the user's computer OS and GPU before writing a hardware-specific installer or launcher. No paid service or cloud GPU is required or authorized.