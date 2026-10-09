"""Scraper monitoring and failure reporting.

Tracks scraper health, logs failures, and creates GitHub issues for broken scrapers
to enable automated repair.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass
class ScraperFailure:
    """Record of a scraper failure."""
    
    source: str
    error_type: str
    error_message: str
    timestamp: str
    match_id: str | None = None
    traceback: str | None = None
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "error_type": self.error_type,
            "error_message": self.error_message,
            "timestamp": self.timestamp,
            "match_id": self.match_id,
            "traceback": self.traceback,
        }


@dataclass
class ScraperRunReport:
    """Report of a scraper run."""
    
    started_at: str
    completed_at: str | None = None
    sources_attempted: list[str] = field(default_factory=list)
    sources_succeeded: list[str] = field(default_factory=list)
    sources_failed: list[str] = field(default_factory=list)
    matches_found: int = 0
    matches_scraped: int = 0
    conflicts_resolved: int = 0
    failures: list[ScraperFailure] = field(default_factory=list)
    
    def add_failure(self, failure: ScraperFailure) -> None:
        """Add a failure to the report."""
        self.failures.append(failure)
        if failure.source not in self.sources_failed:
            self.sources_failed.append(failure.source)
    
    def mark_success(self, source: str, matches: int) -> None:
        """Mark a source as successful."""
        if source not in self.sources_succeeded:
            self.sources_succeeded.append(source)
        self.matches_found += matches
    
    def to_dict(self) -> dict[str, Any]:
        return {
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "sources_attempted": self.sources_attempted,
            "sources_succeeded": self.sources_succeeded,
            "sources_failed": self.sources_failed,
            "matches_found": self.matches_found,
            "matches_scraped": self.matches_scraped,
            "conflicts_resolved": self.conflicts_resolved,
            "failures": [f.to_dict() for f in self.failures],
        }
    
    def summary(self) -> str:
        """Generate a human-readable summary."""
        lines = [
            f"Scraper Run Summary ({self.started_at})",
            "=" * 60,
            f"Sources attempted: {len(self.sources_attempted)}",
            f"Sources succeeded: {len(self.sources_succeeded)} - {', '.join(self.sources_succeeded) if self.sources_succeeded else 'None'}",
            f"Sources failed: {len(self.sources_failed)} - {', '.join(self.sources_failed) if self.sources_failed else 'None'}",
            f"Matches found: {self.matches_found}",
            f"Matches scraped: {self.matches_scraped}",
            f"Conflicts resolved: {self.conflicts_resolved}",
        ]
        
        if self.failures:
            lines.append("")
            lines.append("Failures:")
            for failure in self.failures:
                lines.append(f"  - {failure.source}: {failure.error_type} - {failure.error_message}")
        
        return "\n".join(lines)


def save_report(report: ScraperRunReport, path: Path) -> None:
    """Save report to JSON file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(report.to_dict(), f, indent=2)


def load_report(path: Path) -> ScraperRunReport | None:
    """Load report from JSON file."""
    if not path.exists():
        return None
    
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    
    return ScraperRunReport(
        started_at=data["started_at"],
        completed_at=data.get("completed_at"),
        sources_attempted=data.get("sources_attempted", []),
        sources_succeeded=data.get("sources_succeeded", []),
        sources_failed=data.get("sources_failed", []),
        matches_found=data.get("matches_found", 0),
        matches_scraped=data.get("matches_scraped", 0),
        conflicts_resolved=data.get("conflicts_resolved", 0),
        failures=[
            ScraperFailure(**f) for f in data.get("failures", [])
        ],
    )


def generate_github_issue_body(report: ScraperRunReport, run_url: str | None = None) -> str:
    """Generate GitHub issue body for scraper failures."""
    lines = [
        "## Scraper Failure Report",
        "",
        f"**Run started:** {report.started_at}",
        f"**Sources attempted:** {len(report.sources_attempted)}",
        f"**Sources failed:** {len(report.sources_failed)}",
        "",
    ]
    
    if run_url:
        lines.extend([
            f"**GitHub Actions run:** {run_url}",
            "",
        ])
    
    if report.sources_failed:
        lines.extend([
            "### Failed Sources",
            "",
        ])
        
        for source in report.sources_failed:
            source_failures = [f for f in report.failures if f.source == source]
            lines.append(f"#### {source}")
            lines.append("")
            
            for failure in source_failures:
                lines.append(f"**Error type:** `{failure.error_type}`")
                lines.append(f"**Message:** {failure.error_message}")
                if failure.match_id:
                    lines.append(f"**Match ID:** {failure.match_id}")
                lines.append(f"**Timestamp:** {failure.timestamp}")
                
                if failure.traceback:
                    lines.append("")
                    lines.append("<details>")
                    lines.append("<summary>Traceback</summary>")
                    lines.append("")
                    lines.append("```python")
                    lines.append(failure.traceback)
                    lines.append("```")
                    lines.append("</details>")
                
                lines.append("")
    
    lines.extend([
        "### Summary",
        "",
        "```",
        report.summary(),
        "```",
        "",
        "---",
        "",
        "**Action needed:** Investigate and fix the failing scraper(s).",
        "This issue will be automatically updated if scraper continues to fail.",
    ])
    
    return "\n".join(lines)
