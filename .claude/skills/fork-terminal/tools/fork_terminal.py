#!/usr/bin/env -S uv run
"""Fork a new terminal window with a command."""

import os
import platform
import shutil
import subprocess
from typing import Optional, Tuple


def find_linux_terminal() -> Optional[Tuple[str, list]]:
    """Find an available terminal emulator on Linux."""
    terminals = [
        # GNOME Terminal
        ("gnome-terminal", lambda cmd, cwd: ["gnome-terminal", "--", "bash", "-c", f"cd '{cwd}' && {cmd}; exec bash"]),
        # Konsole (KDE)
        ("konsole", lambda cmd, cwd: ["konsole", "-e", "bash", "-c", f"cd '{cwd}' && {cmd}; exec bash"]),
        # XFCE Terminal
        ("xfce4-terminal", lambda cmd, cwd: ["xfce4-terminal", "-e", f"bash -c \"cd '{cwd}' && {cmd}; exec bash\""]),
        # LXTerminal
        ("lxterminal", lambda cmd, cwd: ["lxterminal", "-e", f"bash -c 'cd \"{cwd}\" && {cmd}; exec bash'"]),
        # Mate Terminal
        ("mate-terminal", lambda cmd, cwd: ["mate-terminal", "-e", f"bash -c 'cd \"{cwd}\" && {cmd}; exec bash'"]),
        # Tilix
        ("tilix", lambda cmd, cwd: ["tilix", "-e", f"bash -c 'cd \"{cwd}\" && {cmd}; exec bash'"]),
        # Terminator
        ("terminator", lambda cmd, cwd: ["terminator", "-e", f"bash -c 'cd \"{cwd}\" && {cmd}; exec bash'"]),
        # Alacritty
        ("alacritty", lambda cmd, cwd: ["alacritty", "-e", "bash", "-c", f"cd '{cwd}' && {cmd}; exec bash"]),
        # Kitty
        ("kitty", lambda cmd, cwd: ["kitty", "bash", "-c", f"cd '{cwd}' && {cmd}; exec bash"]),
        # WezTerm
        ("wezterm", lambda cmd, cwd: ["wezterm", "start", "--", "bash", "-c", f"cd '{cwd}' && {cmd}; exec bash"]),
        # URxvt
        ("urxvt", lambda cmd, cwd: ["urxvt", "-e", "bash", "-c", f"cd '{cwd}' && {cmd}; exec bash"]),
        # XTerm (fallback)
        ("xterm", lambda cmd, cwd: ["xterm", "-e", f"cd '{cwd}' && {cmd}; exec bash"]),
    ]

    for name, builder in terminals:
        if shutil.which(name):
            return (name, builder)

    return None


def fork_terminal(command: str) -> str:
    """Open a new Terminal window and run the specified command."""
    system = platform.system()
    cwd = os.getcwd()

    if system == "Darwin":  # macOS
        # Build shell command - use single quotes for cd to avoid escaping issues
        # Then escape everything for AppleScript
        shell_command = f"cd '{cwd}' && {command}"
        # Escape for AppleScript: backslashes first, then quotes
        escaped_shell_command = shell_command.replace("\\", "\\\\").replace('"', '\\"')

        try:
            result = subprocess.run(
                ["osascript", "-e", f'tell application "Terminal" to do script "{escaped_shell_command}"'],
                capture_output=True,
                text=True,
            )
            output = f"stdout: {result.stdout.strip()}\nstderr: {result.stderr.strip()}\nreturn_code: {result.returncode}"
            return output
        except Exception as e:
            return f"Error: {str(e)}"

    elif system == "Windows":
        # Use PowerShell to spawn a new PowerShell window
        # Escape the command for PowerShell
        escaped_command = command.replace('"', '`"').replace("'", "''")
        full_command = f'cd /d "{cwd}"; {escaped_command}'

        try:
            # Use Start-Process to open a new PowerShell window
            ps_command = f'Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "{full_command}"'
            result = subprocess.run(
                ["PowerShell", "-Command", ps_command],
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                return "Windows PowerShell terminal launched successfully"
            else:
                return f"Windows terminal launched (stderr: {result.stderr.strip()})"
        except Exception as e:
            return f"Error: {str(e)}"

    elif system == "Linux":
        terminal_info = find_linux_terminal()

        if not terminal_info:
            return "Error: No supported terminal emulator found. Tried: gnome-terminal, konsole, xfce4-terminal, lxterminal, mate-terminal, tilix, terminator, alacritty, kitty, wezterm, urxvt, xterm"

        terminal_name, builder = terminal_info
        cmd_args = builder(command, cwd)

        try:
            process = subprocess.Popen(
                cmd_args,
                start_new_session=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            return f"Linux terminal ({terminal_name}) launched with PID {process.pid}"
        except Exception as e:
            return f"Error launching {terminal_name}: {str(e)}"

    else:
        return f"Error: Platform {system} not supported"


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        output = fork_terminal(" ".join(sys.argv[1:]))
        print(output)
