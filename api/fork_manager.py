"""Fork manager - handles spawning and tracking of terminal forks."""

import asyncio
import os
import platform
import subprocess
import uuid
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

from .models import Fork, ForkCreateRequest, ConversationMessage
from .cookbook_parser import (
    load_agent_configs,
    build_command,
    get_summary_prompt_template,
    format_summary_prompt,
)


class ForkManager:
    """Manages fork lifecycle and tracking."""

    def __init__(self):
        self.forks: dict[str, Fork] = {}
        self.processes: dict[str, subprocess.Popen] = {}
        self.agents = load_agent_configs()
        self._update_callbacks: list[Callable[[Fork], None]] = []
        self._output_callbacks: list[Callable[[str, str], None]] = []

    def reload_agents(self):
        """Reload agent configurations from cookbook files."""
        self.agents = load_agent_configs()

    def on_update(self, callback: Callable[[Fork], None]):
        """Register a callback for fork updates."""
        self._update_callbacks.append(callback)

    def on_output(self, callback: Callable[[str, str], None]):
        """Register a callback for fork output."""
        self._output_callbacks.append(callback)

    def _notify_update(self, fork: Fork):
        """Notify all update callbacks."""
        for callback in self._update_callbacks:
            try:
                callback(fork)
            except Exception as e:
                print(f"Error in update callback: {e}")

    def _notify_output(self, fork_id: str, output: str):
        """Notify all output callbacks."""
        for callback in self._output_callbacks:
            try:
                callback(fork_id, output)
            except Exception as e:
                print(f"Error in output callback: {e}")

    def create_fork(self, request: ForkCreateRequest) -> Fork:
        """Create and spawn a new fork."""
        agent_config = self.agents.get(request.agent)
        if not agent_config:
            raise ValueError(f"Unknown agent: {request.agent}")

        if not agent_config.enabled:
            raise ValueError(f"Agent {request.agent} is disabled")

        # Build the prompt
        prompt = request.prompt
        if request.include_summary and request.conversation_history:
            template = get_summary_prompt_template()
            if template:
                history = [{"role": m.role, "content": m.content} for m in request.conversation_history]
                prompt = format_summary_prompt(template, history, request.prompt)

        # Build the command
        command = build_command(agent_config, request.model_tier, prompt)

        # Create fork record
        fork_id = str(uuid.uuid4())[:8]
        model = agent_config.models.get(request.model_tier, agent_config.models["default"])

        fork = Fork(
            id=fork_id,
            agent=request.agent,
            model=model,
            status="spawning",
            task=request.prompt[:50] + ("..." if len(request.prompt) > 50 else ""),
            prompt=request.prompt,
            started_at=datetime.now().isoformat(),
            progress=0,
            output=[f"> Spawning {agent_config.name} with {request.model_tier} model..."],
            include_summary=request.include_summary,
        )

        self.forks[fork_id] = fork

        # Spawn the terminal
        try:
            pid = self._spawn_terminal(command)
            fork.pid = pid
            fork.status = "running"
            fork.progress = 10
            fork.output.append(f"> Task: \"{request.prompt[:60]}...\"")
            fork.output.append("> Opening new terminal window...")
            fork.output.append(f"> Fork #{fork_id} launched successfully")
            self._notify_update(fork)
        except Exception as e:
            fork.status = "failed"
            fork.output.append(f"> Error: {str(e)}")
            self._notify_update(fork)
            raise

        return fork

    def _spawn_terminal(self, command: str) -> Optional[int]:
        """Spawn a new terminal window with the given command."""
        system = platform.system()
        cwd = os.getcwd()

        if system == "Darwin":  # macOS
            shell_command = f"cd '{cwd}' && {command}"
            escaped_shell_command = shell_command.replace("\\", "\\\\").replace('"', '\\"')

            result = subprocess.run(
                ["osascript", "-e", f'tell application "Terminal" to do script "{escaped_shell_command}"'],
                capture_output=True,
                text=True,
            )

            if result.returncode != 0:
                raise RuntimeError(f"Failed to spawn terminal: {result.stderr}")

            return None  # macOS AppleScript doesn't give us a PID easily

        elif system == "Windows":
            import tempfile

            # Replace newlines in command with spaces to avoid multi-line issues
            # (prompts with newlines would break command parsing)
            single_line_command = command.replace('\r\n', ' ').replace('\n', ' ').replace('\r', ' ')

            # Write a PowerShell script that runs the command directly
            with tempfile.NamedTemporaryFile(mode='w', suffix='.ps1', delete=False, encoding='utf-8') as f:
                f.write(f"Set-Location -Path '{cwd}'\n")
                f.write("Write-Host 'Starting fork...' -ForegroundColor Cyan\n")
                f.write("Write-Host ''\n")
                # Escape single quotes in the command for PowerShell
                escaped_command = single_line_command.replace("'", "''")
                f.write(f"$cmd = '{escaped_command}'\n")
                f.write("Write-Host \"Executing: $cmd\" -ForegroundColor DarkGray\n")
                f.write("Write-Host ''\n")
                # Execute using Invoke-Expression
                f.write("Invoke-Expression $cmd\n")
                f.write("Write-Host ''\n")
                f.write("Write-Host 'Fork completed. Press any key to exit...' -ForegroundColor Gray\n")
                f.write("$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')\n")
                script_path = f.name

            # Launch new PowerShell window with the script
            process = subprocess.Popen(
                ["powershell", "-Command", f"Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', '{script_path}'"],
                shell=False,
            )
            return process.pid

        elif system == "Linux":
            # Try common terminal emulators
            terminals = [
                ("gnome-terminal", ["gnome-terminal", "--", "bash", "-c", f"cd '{cwd}' && {command}; exec bash"]),
                ("konsole", ["konsole", "-e", "bash", "-c", f"cd '{cwd}' && {command}; exec bash"]),
                ("xterm", ["xterm", "-e", f"cd '{cwd}' && {command}; exec bash"]),
                ("xfce4-terminal", ["xfce4-terminal", "-e", f"bash -c \"cd '{cwd}' && {command}; exec bash\""]),
            ]

            for name, cmd in terminals:
                try:
                    process = subprocess.Popen(cmd, start_new_session=True)
                    return process.pid
                except FileNotFoundError:
                    continue

            raise RuntimeError("No supported terminal emulator found. Tried: gnome-terminal, konsole, xterm, xfce4-terminal")

        else:
            raise NotImplementedError(f"Platform {system} not supported")

    def get_fork(self, fork_id: str) -> Optional[Fork]:
        """Get a fork by ID."""
        return self.forks.get(fork_id)

    def get_all_forks(self) -> list[Fork]:
        """Get all forks."""
        return list(self.forks.values())

    def terminate_fork(self, fork_id: str) -> bool:
        """Terminate a running fork."""
        fork = self.forks.get(fork_id)
        if not fork:
            return False

        if fork.status in ("completed", "failed", "terminated"):
            return True

        if fork.pid:
            try:
                if platform.system() == "Windows":
                    subprocess.run(["taskkill", "/F", "/PID", str(fork.pid)], capture_output=True)
                else:
                    subprocess.run(["kill", str(fork.pid)], capture_output=True)
            except Exception as e:
                print(f"Error terminating process: {e}")

        fork.status = "terminated"
        fork.completed_at = datetime.now().isoformat()
        fork.output.append("> Fork terminated by user")
        self._notify_update(fork)
        return True

    def update_fork_progress(self, fork_id: str, progress: int):
        """Update fork progress (for external updates)."""
        fork = self.forks.get(fork_id)
        if fork and fork.status == "running":
            fork.progress = min(100, max(0, progress))
            if fork.progress >= 100:
                fork.status = "completed"
                fork.completed_at = datetime.now().isoformat()
            self._notify_update(fork)

    def mark_fork_completed(self, fork_id: str):
        """Mark a fork as completed."""
        fork = self.forks.get(fork_id)
        if fork:
            fork.status = "completed"
            fork.progress = 100
            fork.completed_at = datetime.now().isoformat()
            self._notify_update(fork)

    def mark_fork_failed(self, fork_id: str, error: str):
        """Mark a fork as failed."""
        fork = self.forks.get(fork_id)
        if fork:
            fork.status = "failed"
            fork.output.append(f"> Error: {error}")
            fork.completed_at = datetime.now().isoformat()
            self._notify_update(fork)


# Global fork manager instance
fork_manager = ForkManager()
