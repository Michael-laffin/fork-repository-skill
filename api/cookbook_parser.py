"""Parse cookbook markdown files to extract agent configurations."""

import re
from pathlib import Path
from typing import Optional
from .models import AgentConfig


COOKBOOK_DIR = Path(__file__).parent.parent / ".claude" / "skills" / "fork-terminal" / "cookbook"
SKILL_FILE = Path(__file__).parent.parent / ".claude" / "skills" / "fork-terminal" / "SKILL.md"


def parse_variables(content: str) -> dict[str, str]:
    """Extract variables from markdown content."""
    variables = {}
    lines = content.split("\n")
    in_variables = False

    for line in lines:
        if line.strip() == "## Variables":
            in_variables = True
            continue
        if in_variables and line.startswith("## "):
            break
        if in_variables and ":" in line:
            key, value = line.split(":", 1)
            variables[key.strip()] = value.strip()

    return variables


def parse_cookbook(filename: str) -> Optional[dict]:
    """Parse a single cookbook markdown file."""
    filepath = COOKBOOK_DIR / filename
    if not filepath.exists():
        return None

    content = filepath.read_text(encoding="utf-8")
    variables = parse_variables(content)

    return {
        "content": content,
        "variables": variables,
    }


def get_skill_settings() -> dict[str, bool]:
    """Get enabled/disabled settings from SKILL.md."""
    if not SKILL_FILE.exists():
        return {
            "ENABLE_RAW_CLI_COMMANDS": True,
            "ENABLE_GEMINI_CLI": True,
            "ENABLE_CODEX_CLI": True,
            "ENABLE_CLAUDE_CODE": True,
        }

    content = SKILL_FILE.read_text(encoding="utf-8")
    settings = {}

    for line in content.split("\n"):
        if ":" in line and "ENABLE_" in line:
            match = re.match(r"(ENABLE_\w+):\s*(true|false)", line.strip(), re.IGNORECASE)
            if match:
                key, value = match.groups()
                settings[key] = value.lower() == "true"

    return settings


def load_agent_configs() -> dict[str, AgentConfig]:
    """Load all agent configurations from cookbook files."""
    settings = get_skill_settings()
    agents = {}

    # Claude Code
    claude_cookbook = parse_cookbook("claude-code.md")
    if claude_cookbook:
        vars = claude_cookbook["variables"]
        agents["claude"] = AgentConfig(
            id="claude",
            name="Claude Code",
            icon="◈",
            color="#FF6B35",
            enabled=settings.get("ENABLE_CLAUDE_CODE", True),
            models={
                "fast": vars.get("FAST_MODEL", "haiku"),
                "default": vars.get("DEFAULT_MODEL", "opus"),
                "heavy": vars.get("HEAVY_MODEL", "opus"),
            },
            command_template='claude --model {model} --dangerously-skip-permissions "{prompt}"',
            flags=["--dangerously-skip-permissions"],
        )

    # Codex CLI
    codex_cookbook = parse_cookbook("codex-cli.md")
    if codex_cookbook:
        vars = codex_cookbook["variables"]
        agents["codex"] = AgentConfig(
            id="codex",
            name="Codex CLI",
            icon="◆",
            color="#00D4AA",
            enabled=settings.get("ENABLE_CODEX_CLI", True),
            models={
                "fast": vars.get("FAST_MODEL", "gpt-5.1-codex-mini"),
                "default": vars.get("DEFAULT_MODEL", "gpt-5.1-codex-max"),
                "heavy": vars.get("HEAVY_MODEL", "gpt-5.1-codex-max"),
            },
            command_template='codex -m {model} --dangerously-bypass-approvals-and-sandbox "{prompt}"',
            flags=["--dangerously-bypass-approvals-and-sandbox"],
        )

    # Gemini CLI
    gemini_cookbook = parse_cookbook("gemini-cli.md")
    if gemini_cookbook:
        vars = gemini_cookbook["variables"]
        agents["gemini"] = AgentConfig(
            id="gemini",
            name="Gemini CLI",
            icon="◇",
            color="#8B5CF6",
            enabled=settings.get("ENABLE_GEMINI_CLI", True),
            models={
                "fast": vars.get("FAST_MODEL", "gemini-2.5-flash"),
                "default": vars.get("DEFAULT_MODEL", "gemini-3-pro-preview"),
                "heavy": vars.get("HEAVY_MODEL", "gemini-3-pro"),
            },
            command_template='gemini --model {model} -y -i "{prompt}"',
            flags=["-y", "-i"],
        )

    # Raw CLI
    if settings.get("ENABLE_RAW_CLI_COMMANDS", True):
        agents["raw"] = AgentConfig(
            id="raw",
            name="Raw CLI",
            icon="▢",
            color="#64748B",
            enabled=True,
            models={
                "fast": "N/A",
                "default": "N/A",
                "heavy": "N/A",
            },
            command_template="{prompt}",
            flags=[],
        )

    return agents


def build_command(agent_config: AgentConfig, model_tier: str, prompt: str) -> str:
    """Build the CLI command for a given agent, model tier, and prompt."""
    model = agent_config.models.get(model_tier, agent_config.models["default"])

    # Escape quotes in prompt for shell
    escaped_prompt = prompt.replace('"', '\\"')

    command = agent_config.command_template.format(
        model=model,
        prompt=escaped_prompt,
    )

    return command


def get_summary_prompt_template() -> str:
    """Load the fork summary prompt template."""
    template_path = Path(__file__).parent.parent / ".claude" / "skills" / "fork-terminal" / "prompts" / "fork_summary_user_prompt.md"
    if template_path.exists():
        return template_path.read_text(encoding="utf-8")
    return ""


def format_summary_prompt(template: str, history: list[dict], next_request: str) -> str:
    """Format the summary prompt with conversation history."""
    history_yaml = "```yaml\n- history:\n"
    for msg in history:
        role = "user_prompt" if msg["role"] == "user" else "agent_response"
        # Truncate long messages
        content = msg["content"][:200] + "..." if len(msg["content"]) > 200 else msg["content"]
        history_yaml += f"    - {role}: {content}\n"
    history_yaml += "```"

    # Replace placeholders
    result = template.replace(
        "<fill_in_conversation_summary_here>\n```yaml\n- history:\n    - user_prompt: <user prompt summary>\n      agent_response: <agent response summary>\n    - user_prompt: <user prompt>\n      agent_response: <agent response>\n    - user_prompt: <user prompt>\n      agent_response: <agent response>\n    - user_prompt: <user prompt>\n```\n</fill_in_conversation_summary_here>",
        history_yaml
    )

    result = result.replace(
        "<fill_in_next_user_request_here>\n  <user prompt here exactly as it was requested>\n</fill_in_next_user_request_here>",
        next_request
    )

    return result
