#!/usr/bin/env python3

from __future__ import annotations

import csv
import json
import subprocess
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

LEDGER_FILES = (
    "ArtifactsLedger.json",
    "ComplianceLedger.json",
    "CostLedger.json",
    "FindingsRegister.json",
    "MetricsLedger.json",
    "ProofLedger.json",
    "RiskRegister.json",
    "ScanLedger.json",
)

SLA_WINDOWS = {
    "P0": timedelta(hours=24),
    "P1": timedelta(days=7),
    "P2": timedelta(days=30),
}

EFFORT_HOURS = {
    "P0": 12.0,
    "P1": 6.0,
    "P2": 2.0,
}

IMPACT_SCORES = {
    "P0": 100.0,
    "P1": 60.0,
    "P2": 20.0,
}

ENTERPRISE_GATE_DESCRIPTIONS = {
    "G1": "Build",
    "G2": "Format and lint",
    "G3": "Type safety",
    "G4": "Unit tests",
    "G5": "Integration tests",
    "G6": "Coverage threshold",
    "G7": "Mutation testing",
    "G8": "Dependency audit",
    "G9": "SAST",
    "G10": "Secrets scan",
    "G11": "Branch protection",
    "G12": "Container scan",
    "G13": "Runtime sanity",
    "G14": "Performance regression",
    "G15": "Supply chain verification",
    "G16": "License compliance",
    "G17": "Dependency automation",
    "G18": "Policy compliance",
    "G19": "SLA tracking",
    "G20": "Cost optimization",
}

FRAMEWORK_GATES = {
    "SOC2": ("G8", "G10", "G11", "G13", "G15", "G18", "G19"),
    "ISO27001": ("G8", "G10", "G11", "G15", "G18", "G19"),
    "GDPR": ("G9", "G10", "G11", "G18", "G19"),
    "HIPAA": ("G9", "G10", "G11", "G13", "G15", "G18", "G19"),
    "PCI-DSS": ("G8", "G9", "G10", "G11", "G13", "G15", "G18", "G19"),
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_state(root: Path) -> None:
    vault_dir = root / ".black-vault"
    vault_dir.mkdir(parents=True, exist_ok=True)

    inventory_path = vault_dir / "Inventory.tsv"
    if not inventory_path.exists():
        inventory_path.write_text(
            "filepath\ttotal_lines\tclassification\texclusion_reason\trisk_level\n",
            encoding="utf-8",
        )

    for filename in LEDGER_FILES:
        path = vault_dir / filename
        if not path.exists():
            path.write_text("[]\n", encoding="utf-8")

    sbom_path = vault_dir / "sbom.json"
    if not sbom_path.exists():
        sbom_path.write_text(
            json.dumps(
                {
                    "format": "black-vault-sbom/v1",
                    "generated_at": "",
                    "package_manager": "npm",
                    "source_lockfile": "package-lock.json",
                    "components": [],
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def relpath(root: Path, path: Path | str | None) -> str:
    if path is None:
        return "n/a"

    candidate = Path(path)
    try:
        return str(candidate.resolve().relative_to(root.resolve()))
    except Exception:
        return str(candidate)


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def read_inventory(root: Path) -> list[dict[str, str]]:
    inventory_path = root / ".black-vault" / "Inventory.tsv"
    if not inventory_path.exists():
        return []
    with inventory_path.open(encoding="utf-8") as handle:
        return list(csv.DictReader(handle, delimiter="\t"))


def read_latest_gate_run(root: Path) -> tuple[str | None, dict[str, dict[str, Any]], str]:
    artifacts_dir = root / "artifacts"
    artifact_runs = sorted(
        [path for path in artifacts_dir.glob("GR-*") if path.is_dir()],
        key=lambda item: item.name,
    )
    latest_run = artifact_runs[-1] if artifact_runs else None
    gates: dict[str, dict[str, Any]] = {}
    evidence = "artifacts/"

    if latest_run:
        evidence = relpath(root, latest_run)
        metadata_path = latest_run / "metadata.json"
        if metadata_path.exists():
            metadata = load_json(metadata_path, {})
            for gate_id, gate_data in metadata.get("gates", {}).items():
                gates[gate_id] = {
                    "status": gate_data.get("status", "UNKNOWN"),
                    "evidence": relpath(root, gate_data.get("log")),
                }
        else:
            for log_path in sorted(latest_run.glob("G*.log")):
                text = log_path.read_text(encoding="utf-8")
                status = "FAIL" if "FAIL (" in text else "PASS" if "PASS" in text else "UNKNOWN"
                gates[log_path.stem] = {
                    "status": status,
                    "evidence": relpath(root, log_path),
                }

    return latest_run.name if latest_run else None, gates, evidence


def read_coverage(root: Path) -> dict[str, Any]:
    summary_path = root / "coverage" / "coverage-summary.json"
    summary = load_json(summary_path, {})
    total = summary.get("total", {})
    return {
        "line": total.get("lines", {}).get("pct"),
        "branch": total.get("branches", {}).get("pct"),
        "evidence": relpath(root, summary_path),
        "present": summary_path.exists(),
    }


def severity_of(finding: dict[str, Any]) -> str:
    severity = str(finding.get("severity") or "P2").upper()
    return severity if severity in SLA_WINDOWS else "P2"


def open_status(finding: dict[str, Any]) -> bool:
    return str(finding.get("status") or "OPEN").upper() != "VERIFIED"


def compute_sla(findings: list[dict[str, Any]]) -> dict[str, Any]:
    now = utc_now()
    overdue: list[dict[str, Any]] = []
    open_findings = [finding for finding in findings if open_status(finding)]
    by_severity = Counter(severity_of(finding) for finding in open_findings)

    for finding in open_findings:
        severity = severity_of(finding)
        created_at = parse_timestamp(finding.get("created_at"))
        if created_at is None:
            continue

        deadline = created_at + SLA_WINDOWS[severity]
        if now <= deadline:
            continue

        overdue_hours = round((now - deadline).total_seconds() / 3600, 2)
        overdue.append(
            {
                "id": finding.get("id") or "untracked",
                "severity": severity,
                "title": finding.get("title") or "",
                "status": finding.get("status") or "OPEN",
                "deadline": deadline.isoformat(),
                "overdue_hours": overdue_hours,
                "github_issue": finding.get("github_issue"),
            }
        )

    overdue.sort(key=lambda item: (-item["overdue_hours"], item["id"]))
    return {
        "summary": {
            "open": len(open_findings),
            "overdue": len(overdue),
            "by_severity": dict(by_severity),
            "policy": {
                "P0": "24h",
                "P1": "7d",
                "P2": "30d",
            },
        },
        "overdue": overdue,
    }


def compute_risk(
    inventory: list[dict[str, str]],
    scan_ledger: list[dict[str, Any]],
    findings: list[dict[str, Any]],
) -> dict[str, Any]:
    completed_scans = {
        item.get("file")
        for item in scan_ledger
        if str(item.get("status")).upper() == "COMPLETE"
    }
    findings_by_file = Counter(
        finding.get("file")
        for finding in findings
        if open_status(finding) and finding.get("file")
    )

    hotspots: list[dict[str, Any]] = []
    by_severity = Counter()
    for row in inventory:
        filepath = row.get("filepath", "")
        severity = (row.get("risk_level") or "P2").upper()
        by_severity[severity] += 1
        total_lines = int(row.get("total_lines") or 0)
        scanned = filepath in completed_scans
        base_score = {"P0": 100, "P1": 60, "P2": 20}.get(severity, 10)
        scan_penalty = 25 if not scanned and severity == "P0" else 10 if not scanned else 0
        size_penalty = min(total_lines // 50, 20)
        findings_penalty = findings_by_file.get(filepath, 0) * 15

        hotspots.append(
            {
                "file": filepath,
                "severity": severity,
                "classification": row.get("classification"),
                "total_lines": total_lines,
                "scanned": scanned,
                "open_findings": findings_by_file.get(filepath, 0),
                "risk_score": base_score + scan_penalty + size_penalty + findings_penalty,
            }
        )

    hotspots.sort(
        key=lambda item: (
            -item["risk_score"],
            item["severity"],
            item["file"],
        )
    )

    high_risk_backlog = [
        item for item in hotspots if item["severity"] in {"P0", "P1"} and not item["scanned"]
    ]

    return {
        "summary": {
            "inventory_total": len(inventory),
            "inventory_by_severity": dict(by_severity),
            "high_risk_backlog": len(high_risk_backlog),
            "top_risk_score": hotspots[0]["risk_score"] if hotspots else 0,
        },
        "hotspots": hotspots[:10],
        "backlog": high_risk_backlog[:10],
    }


def recommendation_for(roi_score: float, impact_score: float) -> str:
    if impact_score >= 90 and roi_score >= 8:
        return "Fix immediately"
    if impact_score >= 60 and roi_score >= 4:
        return "Schedule in current sprint"
    if roi_score >= 3:
        return "Opportunistic hardening"
    return "Accept temporarily and monitor"


def compute_cost(findings: list[dict[str, Any]], risk: dict[str, Any]) -> dict[str, Any]:
    active_findings = [finding for finding in findings if open_status(finding)]
    worklist: list[dict[str, Any]] = []

    for finding in active_findings:
        severity = severity_of(finding)
        effort_hours = EFFORT_HOURS[severity]
        impact_score = IMPACT_SCORES[severity]
        roi_score = round(impact_score / effort_hours, 2)
        worklist.append(
            {
                "finding_id": finding.get("id") or "untracked",
                "severity": severity,
                "title": finding.get("title") or "",
                "estimated_hours": effort_hours,
                "impact_score": impact_score,
                "roi_score": roi_score,
                "recommendation": recommendation_for(roi_score, impact_score),
            }
        )

    backlog = []
    for item in risk.get("backlog", [])[:5]:
        severity = item["severity"]
        effort_hours = round(max(item["total_lines"], 50) / 50, 1)
        impact_score = IMPACT_SCORES.get(severity, 20.0)
        roi_score = round(impact_score / max(effort_hours, 1.0), 2)
        backlog.append(
            {
                "file": item["file"],
                "severity": severity,
                "estimated_hours": effort_hours,
                "impact_score": impact_score,
                "roi_score": roi_score,
                "recommendation": "Scan first and convert into tracked findings",
            }
        )

    worklist.sort(key=lambda item: (-item["roi_score"], -item["impact_score"], item["finding_id"]))
    backlog.sort(key=lambda item: (-item["roi_score"], item["file"]))

    return {
        "summary": {
            "active_findings": len(active_findings),
            "estimated_hours": round(sum(item["estimated_hours"] for item in worklist), 2),
            "backlog_candidates": len(backlog),
            "best_roi": worklist[0]["roi_score"] if worklist else backlog[0]["roi_score"] if backlog else 0.0,
        },
        "worklist": worklist[:10],
        "backlog": backlog,
    }


def find_first_existing(root: Path, candidates: list[str]) -> str | None:
    for candidate in candidates:
        if (root / candidate).exists():
            return candidate
    return None


def package_scripts(root: Path) -> dict[str, str]:
    package = load_json(root / "package.json", {})
    return package.get("scripts", {})


def detect_branch_protection(root: Path) -> dict[str, Any]:
    local_assets = [
        ".github/workflows/gates-on-pr.yml",
        "scripts/github-cli/enforce-branch-protection.sh",
    ]
    if not all((root / asset).exists() for asset in local_assets):
        return {
            "status": "FAIL",
            "evidence": ", ".join(asset for asset in local_assets if (root / asset).exists()) or "missing local assets",
            "note": "Branch protection workflow or enforcement script is missing.",
        }

    gh_repo = None
    if (root / ".git").exists():
        try:
            gh_repo = subprocess.check_output(
                ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
                cwd=root,
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()
        except Exception:
            gh_repo = None

    if gh_repo:
        try:
            subprocess.check_output(
                ["gh", "api", f"repos/{gh_repo}/branches/main/protection"],
                cwd=root,
                stderr=subprocess.DEVNULL,
                text=True,
            )
            return {
                "status": "PASS",
                "evidence": f"{gh_repo}:main protection",
                "note": "Remote branch protection verified through the GitHub API.",
            }
        except Exception:
            return {
                "status": "WARN",
                "evidence": ", ".join(local_assets),
                "note": "Local enforcement assets exist, but remote branch protection could not be verified.",
            }

    return {
        "status": "WARN",
        "evidence": ", ".join(local_assets),
        "note": "Local enforcement assets exist, but GitHub API verification is unavailable.",
    }


def build_enterprise_gates(
    root: Path,
    base_gates: dict[str, dict[str, Any]],
    coverage: dict[str, Any],
    findings: list[dict[str, Any]],
    sla: dict[str, Any],
    cost: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    scripts = package_scripts(root)
    enterprise_gates: dict[str, dict[str, Any]] = {}

    for gate_id in ("G1", "G2", "G3", "G4", "G6", "G8", "G9", "G10"):
        gate_data = base_gates.get(gate_id, {})
        enterprise_gates[gate_id] = {
            "status": gate_data.get("status", "WARN"),
            "description": ENTERPRISE_GATE_DESCRIPTIONS[gate_id],
            "evidence": gate_data.get("evidence", "artifacts/"),
            "note": "Recorded from the latest gate run artifacts.",
        }

    integration_marker = find_first_existing(
        root,
        [
            "tests/integration",
            "tests/e2e",
            "playwright.config.ts",
            "cypress.config.ts",
            "docker-compose.test.yml",
        ],
    )
    enterprise_gates["G5"] = {
        "status": "PASS" if integration_marker else "WARN",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G5"],
        "evidence": integration_marker or "no dedicated integration suite detected",
        "note": "Dedicated integration or end-to-end assets are required for a hard PASS.",
    }

    mutation_config = find_first_existing(
        root,
        [
            "stryker.conf.json",
            "stryker.config.json",
            "mutmut-config.toml",
            "cargo-mutants.toml",
        ],
    )
    mutation_script = next((name for name in scripts if "mutat" in name.lower()), None)
    mutation_report = find_first_existing(
        root,
        [
            "artifacts/mutation-report.json",
            "coverage/mutation-summary.json",
        ],
    )
    enterprise_gates["G7"] = {
        "status": "PASS" if mutation_report else "WARN",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G7"],
        "evidence": mutation_report or mutation_config or mutation_script or "mutation tooling not configured",
        "note": "Mutation testing is advisory until a report artifact is generated.",
    }

    enterprise_gates["G11"] = {
        **detect_branch_protection(root),
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G11"],
    }

    container_marker = find_first_existing(
        root,
        [
            "Dockerfile",
            "docker-compose.yml",
            ".github/workflows/container-scan.yml",
            "trivy.yaml",
        ],
    )
    container_report = find_first_existing(
        root,
        [
            "artifacts/container-scan.json",
            "artifacts/trivy-report.sarif",
        ],
    )
    enterprise_gates["G12"] = {
        "status": "PASS" if container_report else "WARN",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G12"],
        "evidence": container_report or container_marker or "no container target detected",
        "note": "Container scanning is tracked, but this repo does not currently emit a scan report.",
    }

    runtime_sanity = (root / "tests/server/routes.test.ts").exists() and base_gates.get("G4", {}).get("status") == "PASS"
    enterprise_gates["G13"] = {
        "status": "PASS" if runtime_sanity else "WARN",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G13"],
        "evidence": "tests/server/routes.test.ts" if runtime_sanity else "runtime smoke tests not isolated",
        "note": "Route-level tests are used as the current runtime sanity proxy.",
    }

    perf_marker = find_first_existing(
        root,
        [
            "tests/perf",
            "benchmarks",
            "vitest.bench.ts",
        ],
    )
    enterprise_gates["G14"] = {
        "status": "PASS" if perf_marker else "WARN",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G14"],
        "evidence": perf_marker or "no performance benchmark suite detected",
        "note": "Performance regression tracking still needs dedicated benchmark coverage.",
    }

    sbom_present = (root / ".black-vault" / "sbom.json").exists()
    lockfile_present = (root / "package-lock.json").exists()
    enterprise_gates["G15"] = {
        "status": "PASS" if sbom_present and lockfile_present else "FAIL",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G15"],
        "evidence": ".black-vault/sbom.json" if sbom_present else "missing sbom.json",
        "note": "Local SBOM evidence exists when both the SBOM and lockfile are present.",
    }

    package = load_json(root / "package.json", {})
    license_value = package.get("license")
    enterprise_gates["G16"] = {
        "status": "PASS" if license_value else "WARN",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G16"],
        "evidence": f"package.json license={license_value}" if license_value else "package.json has no license field",
        "note": "This checks SPDX declaration presence, not full transitive license review.",
    }

    enterprise_gates["G17"] = {
        "status": "PASS" if (root / ".github" / "dependabot.yml").exists() else "WARN",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G17"],
        "evidence": ".github/dependabot.yml" if (root / ".github" / "dependabot.yml").exists() else "dependabot config missing",
        "note": "Dependency update automation is satisfied by the repo-local Dependabot configuration.",
    }

    policy_assets = [
        ".github/workflows/gates-on-pr.yml",
        ".github/workflows/compliance-audit.yml",
        ".github/ISSUE_TEMPLATE/finding.md",
        ".github/pull_request_template.md",
    ]
    enterprise_gates["G18"] = {
        "status": "PASS" if all((root / asset).exists() for asset in policy_assets) else "FAIL",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G18"],
        "evidence": ", ".join(asset for asset in policy_assets if (root / asset).exists()) or "policy assets missing",
        "note": "Repo-local policy enforcement depends on CI workflows and issue templates being present.",
    }

    overdue = sla["summary"]["overdue"]
    enterprise_gates["G19"] = {
        "status": "PASS" if overdue == 0 and (root / "scripts/github-cli/escalate-stuck.sh").exists() else "FAIL" if overdue else "WARN",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G19"],
        "evidence": "scripts/github-cli/escalate-stuck.sh" if (root / "scripts/github-cli/escalate-stuck.sh").exists() else "missing escalation script",
        "note": f"{overdue} overdue finding(s) detected under the current SLA policy.",
    }

    enterprise_gates["G20"] = {
        "status": "PASS" if cost["summary"]["active_findings"] == 0 or cost["summary"]["best_roi"] > 0 else "WARN",
        "description": ENTERPRISE_GATE_DESCRIPTIONS["G20"],
        "evidence": ".black-vault/CostLedger.json",
        "note": f"{cost['summary']['backlog_candidates']} prioritized backlog candidate(s) available for ROI review.",
    }

    if coverage["line"] is None:
        enterprise_gates["G6"]["status"] = "FAIL"
        enterprise_gates["G6"]["note"] = "Coverage summary is missing."
    elif coverage["line"] < 97:
        enterprise_gates["G6"]["status"] = "FAIL"
        enterprise_gates["G6"]["note"] = f"Current line coverage is {coverage['line']}%, below the 97% gate."
    else:
        enterprise_gates["G6"]["status"] = "PASS"
        enterprise_gates["G6"]["note"] = f"Current line coverage is {coverage['line']}%."
    return enterprise_gates


def gate_score(status: str) -> float:
    if status == "PASS":
        return 1.0
    if status == "WARN":
        return 0.5
    return 0.0


def build_frameworks(
    enterprise_gates: dict[str, dict[str, Any]],
    findings: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    open_p0 = sum(1 for finding in findings if open_status(finding) and severity_of(finding) == "P0")
    frameworks: dict[str, dict[str, Any]] = {}

    for framework, required_gates in FRAMEWORK_GATES.items():
        statuses = [enterprise_gates[gate_id]["status"] for gate_id in required_gates]
        score = round(sum(gate_score(status) for status in statuses) / len(required_gates) * 100, 2)
        if any(status == "FAIL" for status in statuses) or open_p0 > 0:
            state = "NON_COMPLIANT"
        elif any(status == "WARN" for status in statuses):
            state = "IN_PROGRESS"
        else:
            state = "COMPLIANT"
        frameworks[framework] = {
            "status": state,
            "score": score,
            "required_gates": list(required_gates),
        }

    return frameworks


def repository_label(root: Path) -> str:
    try:
        return (
            subprocess.check_output(
                ["git", "config", "--get", "remote.origin.url"],
                cwd=root,
                stderr=subprocess.DEVNULL,
                text=True,
            )
            .strip()
            or "N/A"
        )
    except Exception:
        return "N/A"


def build_snapshot(root: Path) -> dict[str, Any]:
    ensure_state(root)
    inventory = read_inventory(root)
    scan_ledger = load_json(root / ".black-vault" / "ScanLedger.json", [])
    findings = load_json(root / ".black-vault" / "FindingsRegister.json", [])
    gate_run_id, base_gates, gate_evidence = read_latest_gate_run(root)
    coverage = read_coverage(root)
    sla = compute_sla(findings)
    risk = compute_risk(inventory, scan_ledger, findings)
    cost = compute_cost(findings, risk)
    enterprise_gates = build_enterprise_gates(root, base_gates, coverage, findings, sla, cost)
    frameworks = build_frameworks(enterprise_gates, findings)
    scan_complete = sum(1 for item in scan_ledger if str(item.get("status")).upper() == "COMPLETE")
    scan_coverage_pct = round((scan_complete / len(inventory)) * 100, 2) if inventory else 0.0
    open_findings = [finding for finding in findings if open_status(finding)]
    verified_findings = [finding for finding in findings if not open_status(finding)]
    compliance_score = round(
        sum(gate_score(entry["status"]) for entry in enterprise_gates.values()) / len(enterprise_gates) * 100,
        2,
    )

    return {
        "generated_at": utc_now().isoformat(),
        "verification_scope": "repo-local",
        "repository": repository_label(root),
        "gate_run_id": gate_run_id,
        "gate_evidence": gate_evidence,
        "coverage": coverage,
        "scan": {
            "total": len(inventory),
            "complete": scan_complete,
            "coverage_pct": scan_coverage_pct,
        },
        "findings": {
            "total": len(findings),
            "open": len(open_findings),
            "verified": len(verified_findings),
            "open_by_severity": dict(Counter(severity_of(finding) for finding in open_findings)),
        },
        "gates": {
            "base": base_gates,
            "enterprise": enterprise_gates,
        },
        "risk": risk,
        "sla": sla,
        "cost": cost,
        "frameworks": frameworks,
        "compliance_score": compliance_score,
    }


def write_snapshot(root: Path, snapshot: dict[str, Any]) -> None:
    write_json(root / ".black-vault" / "NexusSnapshot.json", snapshot)


def append_ledger(path: Path, entry: dict[str, Any]) -> list[dict[str, Any]]:
    ledger = load_json(path, [])
    ledger.append(entry)
    write_json(path, ledger)
    return ledger


def record(root: Path) -> None:
    snapshot = build_snapshot(root)
    write_snapshot(root, snapshot)

    metrics_path = root / ".black-vault" / "MetricsLedger.json"
    existing_metrics = load_json(metrics_path, [])
    previous = existing_metrics[-1] if existing_metrics else {}
    metrics_entry = {
        "timestamp": snapshot["generated_at"],
        "gate_run_id": snapshot["gate_run_id"],
        "gates": snapshot["gates"]["base"],
        "enterprise_gates": snapshot["gates"]["enterprise"],
        "scan_progress": snapshot["scan"],
        "findings": snapshot["findings"],
        "risk": snapshot["risk"]["summary"],
        "sla": snapshot["sla"]["summary"],
        "cost": snapshot["cost"]["summary"],
        "compliance_score": snapshot["compliance_score"],
    }

    previous_coverage = previous.get("gates", {}).get("G6", {}).get("coverage_line")
    current_coverage = snapshot["coverage"]["line"]
    metrics_entry["gates"].setdefault("G6", {})
    metrics_entry["gates"]["G6"]["coverage_line"] = current_coverage
    metrics_entry["gates"]["G6"]["coverage_branch"] = snapshot["coverage"]["branch"]
    if previous_coverage is not None and current_coverage is not None:
        metrics_entry["trends"] = {
            "coverage_line_delta": round(current_coverage - previous_coverage, 2),
            "open_findings_delta": snapshot["findings"]["open"] - previous.get("findings", {}).get("open", 0),
            "scan_coverage_delta": round(
                snapshot["scan"]["coverage_pct"] - previous.get("scan_progress", {}).get("coverage_pct", 0.0),
                2,
            ),
        }

    append_ledger(metrics_path, metrics_entry)

    risk_entry = {
        "timestamp": snapshot["generated_at"],
        "summary": snapshot["risk"]["summary"],
        "hotspots": snapshot["risk"]["hotspots"],
        "overdue_findings": snapshot["sla"]["overdue"][:10],
    }
    append_ledger(root / ".black-vault" / "RiskRegister.json", risk_entry)

    cost_entry = {
        "timestamp": snapshot["generated_at"],
        "summary": snapshot["cost"]["summary"],
        "worklist": snapshot["cost"]["worklist"],
        "backlog": snapshot["cost"]["backlog"],
    }
    append_ledger(root / ".black-vault" / "CostLedger.json", cost_entry)

    proof_entry = {
        "timestamp": snapshot["generated_at"],
        "gate_run_id": snapshot["gate_run_id"],
        "verification_scope": snapshot["verification_scope"],
        "enterprise_gates": snapshot["gates"]["enterprise"],
        "frameworks": snapshot["frameworks"],
    }
    append_ledger(root / ".black-vault" / "ProofLedger.json", proof_entry)


def report(root: Path) -> None:
    snapshot = build_snapshot(root)
    write_snapshot(root, snapshot)

    entry = {
        "audit_id": f"AUD-{utc_now().strftime('%Y%m%dT%H%M%SZ')}",
        "timestamp": snapshot["generated_at"],
        "repository": snapshot["repository"],
        "verification_scope": snapshot["verification_scope"],
        "gate_run_id": snapshot["gate_run_id"],
        "compliance_gates": [
            {
                "gate": gate_id,
                "description": gate_data["description"],
                "status": gate_data["status"],
                "evidence": gate_data["evidence"],
                "note": gate_data["note"],
            }
            for gate_id, gate_data in sorted(snapshot["gates"]["enterprise"].items())
        ],
        "frameworks": snapshot["frameworks"],
        "scan_coverage_pct": snapshot["scan"]["coverage_pct"],
        "findings": snapshot["findings"],
        "risk": snapshot["risk"]["summary"],
        "sla": snapshot["sla"]["summary"],
        "cost": snapshot["cost"]["summary"],
        "compliance_score": snapshot["compliance_score"],
    }
    append_ledger(root / ".black-vault" / "ComplianceLedger.json", entry)

    report_lines = [
        "# Black Vault NEXUS ULTRA Report",
        "",
        f"Generated: {snapshot['generated_at']}",
        f"Repository: {snapshot['repository']}",
        f"Verification scope: {snapshot['verification_scope']}",
        f"Latest gate run: {snapshot['gate_run_id'] or 'n/a'}",
        "",
        "## Executive Summary",
        "",
        f"- Compliance score: {snapshot['compliance_score']}%",
        f"- Scan coverage: {snapshot['scan']['complete']}/{snapshot['scan']['total']} files ({snapshot['scan']['coverage_pct']}%)",
        f"- Open findings: {snapshot['findings']['open']}",
        f"- SLA breaches: {snapshot['sla']['summary']['overdue']}",
        f"- Coverage line: {snapshot['coverage']['line'] if snapshot['coverage']['line'] is not None else 'n/a'}",
        f"- Coverage branch: {snapshot['coverage']['branch'] if snapshot['coverage']['branch'] is not None else 'n/a'}",
        "",
        "## Gate Matrix",
        "",
        "| Gate | Description | Status | Evidence |",
        "| --- | --- | --- | --- |",
    ]

    for gate_id, gate_data in sorted(snapshot["gates"]["enterprise"].items()):
        report_lines.append(
            f"| {gate_id} | {gate_data['description']} | {gate_data['status']} | {gate_data['evidence']} |"
        )

    report_lines.extend(
        [
            "",
            "## Compliance Frameworks",
            "",
            "| Framework | Status | Score |",
            "| --- | --- | --- |",
        ]
    )

    for framework, details in snapshot["frameworks"].items():
        report_lines.append(f"| {framework} | {details['status']} | {details['score']}% |")

    report_lines.extend(
        [
            "",
            "## Top Risk Hotspots",
            "",
        ]
    )

    if snapshot["risk"]["hotspots"]:
        for hotspot in snapshot["risk"]["hotspots"][:5]:
            report_lines.append(
                f"- {hotspot['file']} ({hotspot['severity']}, risk {hotspot['risk_score']}, scanned={str(hotspot['scanned']).lower()})"
            )
    else:
        report_lines.append("- No inventory data recorded yet.")

    report_lines.extend(
        [
            "",
            "## SLA And Cost",
            "",
            f"- Overdue findings: {snapshot['sla']['summary']['overdue']}",
            f"- Active remediation hours: {snapshot['cost']['summary']['estimated_hours']}",
            f"- ROI backlog candidates: {snapshot['cost']['summary']['backlog_candidates']}",
            "",
            "## Next Actions",
            "",
        ]
    )

    if snapshot["risk"]["backlog"]:
        report_lines.append("- Convert the top unscanned P0 and P1 files into tracked scan tasks.")
    if snapshot["sla"]["summary"]["overdue"] > 0:
        report_lines.append("- Escalate overdue findings through the SLA workflow before the next release.")
    if snapshot["findings"]["open"] == 0:
        report_lines.append("- Keep the findings register empty by syncing future issues into `.black-vault/FindingsRegister.json`.")
    if snapshot["gates"]["enterprise"]["G14"]["status"] != "PASS":
        report_lines.append("- Add a dedicated performance regression suite to move G14 from WARN to PASS.")
    if snapshot["gates"]["enterprise"]["G5"]["status"] != "PASS":
        report_lines.append("- Add an integration or end-to-end suite for G5 hardening coverage.")

    (root / "BLACK_VAULT_HARDENING_REPORT.md").write_text(
        "\n".join(report_lines) + "\n",
        encoding="utf-8",
    )


def main(argv: list[str]) -> int:
    if len(argv) < 2 or argv[1] not in {"snapshot", "record", "report"}:
        print("Usage: nexus_snapshot.py <snapshot|record|report> [root_dir]", file=sys.stderr)
        return 1

    command = argv[1]
    root = Path(argv[2]).resolve() if len(argv) > 2 else Path.cwd().resolve()

    if command == "snapshot":
        snapshot = build_snapshot(root)
        write_snapshot(root, snapshot)
        json.dump(snapshot, sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0

    if command == "record":
        record(root)
        return 0

    report(root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
