# Changelog

All notable changes to the "CodeReader" extension are documented in this file.

## [0.1.4] - 2026-02-23

### Changed

- Updated book content generation to use key-based language retrieval for renderer consistency.

## [0.1.3] - 2026-02-23

### Fixed

- Corrected a bad version bump in the release process.

## [0.1.2] - 2026-02-23

### Changed

- Increased renderer-switch timing tolerance to better support language changes.

### Fixed

- Improved auto-wrap handling for Windows editor focus timing.

## [0.1.1] - 2026-02-23

### Fixed

- Improved EPUB parsing robustness with optional chaining and stronger error handling.

### Changed

- Published release metadata updates for version 0.1.1.

## [0.1.0] - 2026-02-23

### Fixed

- Enhanced EPUB path resolution in the content provider for Windows hosts.

## [0.0.1] - 2026-02-23

### Added

- Initial extension implementation to read EPUB content in a code-themed custom editor.
- Added configurable language renderers (including Python, JavaScript, PHP, Go, C/C++, Rust, Ruby, C#, Java, Objective-C, Swift, TypeScript, VB, Bash, Batch, PowerShell, and Clojure).
- Added settings support for renderer language selection and automatic word wrap.
- Added command support for switching renderers while reading.
- Added repository metadata and a release workflow for VSIX packaging.

### Changed

- Reorganized generators and refactored internal structure for readability and maintainability.
- Refined README documentation and screenshots.

### Fixed

- Improved highlight accuracy and ensured highlighting only applies to book text.
- Fixed highlight locations across re-renders.
- Fixed language switching behavior so global defaults update correctly.
- Removed redundant/deprecated highlight behavior and dropped word-wrap column override logic.
