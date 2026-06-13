# Changelog

## v1.0.3 - 2026-06-13

### Overview

v1.0.3 focuses on three areas:

- immersive voice interaction
- stronger local runtime and tool capabilities
- stability fixes for models, proxying, and skills

### Added

- Added immersive voice mode with a dedicated entry and updated interaction flow
- Switched dialog speech recognition to ASR real-time recognition
- Added user emotion recognition during voice interaction
- Added role-based assistant persona setup
- Added bundled Python runtime for local execution
- Added online download support for tool packages in Settings
- Added bundled commonly used skills and built-in weather query skill

### Improved

- Improved immersive voice entry styling and in-session feedback
- Improved assistant identity and workspace bootstrap content generation
- Expanded the built-in model/channel options in model configuration
- Tuned ASR VAD threshold and sentence segmentation to reduce noise-triggered recognition

### Fixed

- Fixed proxy settings not taking effect for main-process requests
- Fixed HTTPS model list requests failing when routed through a proxy
- Fixed model configuration failing to fetch provider model lists
- Fixed installed built-in skills not being written to and enabled in config
- Fixed chat markdown file rendering issues
