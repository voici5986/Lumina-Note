# Doc Engine Change Log

## 2026-02-02
- Change: Add baseline docx sample set and generator script for repeatable fixtures.
- Scope: `scripts/generate_docx_samples.py`, `tests/typesetting/samples/*`.
- Impact: Establishes 10 baseline docx fixtures for render comparison and future OpenOffice diffing.
- Rollback: Remove `tests/typesetting/samples/` fixtures and delete `scripts/generate_docx_samples.py`.
