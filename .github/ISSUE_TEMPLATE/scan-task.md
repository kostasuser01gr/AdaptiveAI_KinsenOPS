---
name: Scan Task
about: Assign a file for Black Vault scanning
labels: ["type:scan-task"]
---

## Scan Task

- File: `path/to/file`
- Risk: P0 / P1 / P2
- Blocks: N

## Checklist

- [ ] Run `bash scripts/hardening/scan-file.sh <file>`
- [ ] Review with the seven-lens checklist
- [ ] Record findings in `.black-vault/FindingsRegister.json`
- [ ] Run `bash scripts/run-all-gates.sh`
- [ ] Link the remediation PR
