import { useState, useEffect, useCallback } from 'react';
import { api, forkWebSocket } from '../api/client';
import type { Fork, ForkCreateRequest, AgentConfig, WebSocketMessage } from '../types';

export function useForks() {
  const [forks, setForks] = useState<Fork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForks = useCallback(async () => {
    const result = await api.getForks();
    if (result.success && result.data) {
      setForks(result.data);
      setError(null);
    } else {
      setError(result.error || 'Failed to fetch forks');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchForks();

    // Connect WebSocket for real-time updates
    forkWebSocket.connect();

    const unsubUpdate = forkWebSocket.on('fork_update', (data) => {
      const message = data as WebSocketMessage;
      const updatedFork = message.data as Fork;
      setForks((prev) =>
        prev.map((f) => (f.id === updatedFork.id ? updatedFork : f))
      );
    });

    const unsubOutput = forkWebSocket.on('fork_output', (data) => {
      const message = data as WebSocketMessage;
      const { forkId, output } = message.data as { forkId: string; output: string };
      setForks((prev) =>
        prev.map((f) =>
          f.id === forkId ? { ...f, output: [...f.output, { time: new Date(), text: output }] } : f
        )
      );
    });

    const unsubCompleted = forkWebSocket.on('fork_completed', (data) => {
      const message = data as WebSocketMessage;
      const { forkId } = message.data as { forkId: string };
      setForks((prev) =>
        prev.map((f) =>
          f.id === forkId
            ? { ...f, status: 'completed', progress: 100, completedAt: new Date().toISOString() }
            : f
        )
      );
    });

    const unsubFailed = forkWebSocket.on('fork_failed', (data) => {
      const message = data as WebSocketMessage;
      const { forkId, error: forkError } = message.data as { forkId: string; error: string };
      setForks((prev) =>
        prev.map((f) =>
          f.id === forkId
            ? { ...f, status: 'failed', output: [...f.output, { time: new Date(), text: `Error: ${forkError}` }] }
            : f
        )
      );
    });

    return () => {
      unsubUpdate();
      unsubOutput();
      unsubCompleted();
      unsubFailed();
      forkWebSocket.disconnect();
    };
  }, [fetchForks]);

  const createFork = useCallback(async (request: ForkCreateRequest): Promise<Fork | null> => {
    const result = await api.createFork(request);
    if (result.success && result.data) {
      setForks((prev) => [result.data!, ...prev]);
      return result.data;
    }
    setError(result.error || 'Failed to create fork');
    return null;
  }, []);

  const terminateFork = useCallback(async (id: string): Promise<boolean> => {
    const result = await api.terminateFork(id);
    if (result.success) {
      setForks((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status: 'terminated' } : f))
      );
      return true;
    }
    setError(result.error || 'Failed to terminate fork');
    return false;
  }, []);

  return {
    forks,
    loading,
    error,
    createFork,
    terminateFork,
    refresh: fetchForks,
  };
}

export function useAgents() {
  const [agents, setAgents] = useState<Record<string, AgentConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      const result = await api.getAgents();
      if (result.success && result.data) {
        setAgents(result.data);
        setError(null);
      } else {
        setError(result.error || 'Failed to fetch agents');
        // Fallback to default agents if API fails
        setAgents({
          claude: {
            id: 'claude',
            name: 'Claude Code',
            color: '#FF6B35',
            icon: '◈',
            enabled: true,
            models: { fast: 'haiku', default: 'opus', heavy: 'opus' },
            commandTemplate: 'claude --model {model} --dangerously-skip-permissions "{prompt}"',
            flags: ['--dangerously-skip-permissions'],
          },
          codex: {
            id: 'codex',
            name: 'Codex CLI',
            color: '#00D4AA',
            icon: '◆',
            enabled: true,
            models: { fast: 'gpt-5.1-codex-mini', default: 'gpt-5.1-codex-max', heavy: 'gpt-5.1-codex-max' },
            commandTemplate: 'codex -m {model} --dangerously-bypass-approvals-and-sandbox "{prompt}"',
            flags: ['--dangerously-bypass-approvals-and-sandbox'],
          },
          gemini: {
            id: 'gemini',
            name: 'Gemini CLI',
            color: '#8B5CF6',
            icon: '◇',
            enabled: true,
            models: { fast: 'gemini-2.5-flash', default: 'gemini-3-pro-preview', heavy: 'gemini-3-pro' },
            commandTemplate: 'gemini --model {model} -y -i "{prompt}"',
            flags: ['-y', '-i'],
          },
          raw: {
            id: 'raw',
            name: 'Raw CLI',
            color: '#64748B',
            icon: '▢',
            enabled: true,
            models: { fast: 'N/A', default: 'N/A', heavy: 'N/A' },
            commandTemplate: '{prompt}',
            flags: [],
          },
        });
      }
      setLoading(false);
    }

    fetchAgents();
  }, []);

  return { agents, loading, error };
}
