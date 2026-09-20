# Security and data handling

This library sends supplied text to the hosted TypeSafe API when classification is requested. Keep API keys in server-side environment variables or a secret manager. Never include a key in browser code, URLs, fixtures or issue reports. The endpoint is fixed to the documented TypeSafe host and redirects are rejected.

Production callers should validate upload type and size, keep Poppler updated, and run document parsing in an isolated process appropriate to their threat model. The library caps PDF file size, page count, extraction duration and buffers. OCR, antivirus scanning and document authenticity checks are not bundled.

Provider exceptions are replaced with sanitized errors; responses are validated against the requested option set. Retries are bounded. A high-confidence model output is not a trust boundary: source documents can contain adversarial text, and prompts do not guarantee resistance to it. Do not authorize payments, filings or irreversible writes from a classification result alone.

For a vulnerability, contact the repository maintainers through an available private channel. Do not post credentials or personal tax data in a public issue. For ordinary bugs, reproduce with synthetic data.
