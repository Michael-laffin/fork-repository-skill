import { useState, useEffect, useCallback, useRef } from 'react';
import { useForks, useAgents } from '../hooks/useForks';
import type {
  Fork,
  AgentConfig,
  QueueItem,
  WorkflowTemplate,
  AppSettings,
  TerminalLine,
  ForkStats,
  ForkStatus
} from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'code-review-all',
    name: 'Multi-Agent Code Review',
    description: 'All 3 agents review code from different perspectives',
    icon: '🔍',
    forks: [
      { agent: 'claude', modelTier: 'default', prompt: 'Review the codebase for architecture patterns and suggest improvements' },
      { agent: 'codex', modelTier: 'default', prompt: 'Analyze code for potential bugs, edge cases, and error handling' },
      { agent: 'gemini', modelTier: 'default', prompt: 'Review documentation completeness and suggest improvements' },
    ]
  },
  {
    id: 'test-generation',
    name: 'Parallel Test Generation',
    description: 'Generate unit, integration, and e2e tests simultaneously',
    icon: '🧪',
    forks: [
      { agent: 'claude', modelTier: 'default', prompt: 'Generate comprehensive unit tests for all modules' },
      { agent: 'codex', modelTier: 'default', prompt: 'Generate integration tests for API endpoints' },
      { agent: 'gemini', modelTier: 'fast', prompt: 'Generate end-to-end test scenarios' },
    ]
  },
  {
    id: 'refactor-race',
    name: 'Refactor Race',
    description: 'Compare refactoring approaches from different agents',
    icon: '🏎️',
    forks: [
      { agent: 'claude', modelTier: 'heavy', prompt: 'Refactor the main module for better performance and readability' },
      { agent: 'codex', modelTier: 'heavy', prompt: 'Refactor the main module for better performance and readability' },
      { agent: 'gemini', modelTier: 'heavy', prompt: 'Refactor the main module for better performance and readability' },
    ]
  },
  {
    id: 'full-docs',
    name: 'Documentation Blitz',
    description: 'Generate all project documentation in parallel',
    icon: '📚',
    forks: [
      { agent: 'claude', modelTier: 'default', prompt: 'Generate comprehensive API documentation in markdown' },
      { agent: 'gemini', modelTier: 'default', prompt: 'Create a getting started guide and tutorials' },
      { agent: 'codex', modelTier: 'fast', prompt: 'Generate inline code comments and docstrings' },
    ]
  },
];

const STATUS_COLORS: Record<ForkStatus, { bg: string; border: string; text: string }> = {
  queued: { bg: 'rgba(100,116,139,0.2)', border: '#64748B', text: '#94A3B8' },
  spawning: { bg: 'rgba(255,193,7,0.2)', border: '#FFC107', text: '#FFC107' },
  running: { bg: 'rgba(0,212,170,0.2)', border: '#00D4AA', text: '#00D4AA' },
  completed: { bg: 'rgba(34,197,94,0.2)', border: '#22C55E', text: '#22C55E' },
  failed: { bg: 'rgba(239,68,68,0.2)', border: '#EF4444', text: '#EF4444' },
  cancelled: { bg: 'rgba(107,114,128,0.2)', border: '#6B7280', text: '#6B7280' },
  terminated: { bg: 'rgba(107,114,128,0.2)', border: '#6B7280', text: '#6B7280' },
};

// ============================================================================
// THEME DEFINITIONS
// ============================================================================

const THEMES = {
  cyberpunk: {
    primary: '#FF6B35',
    primaryLight: '#FF8F6B',
    secondary: '#8B5CF6',
    success: '#00D4AA',
    warning: '#FFC107',
    error: '#EF4444',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0d0d12 100%)',
    panelBg: 'rgba(0,0,0,0.4)',
    gridColor: 'rgba(255,107,53,0.03)',
    glowColor: 'rgba(255,107,53,0.12)',
  },
  minimal: {
    primary: '#3B82F6',
    primaryLight: '#60A5FA',
    secondary: '#6366F1',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    background: 'linear-gradient(135deg, #111827 0%, #1F2937 50%, #111827 100%)',
    panelBg: 'rgba(31,41,55,0.6)',
    gridColor: 'rgba(59,130,246,0.02)',
    glowColor: 'rgba(59,130,246,0.08)',
  },
  matrix: {
    primary: '#22C55E',
    primaryLight: '#4ADE80',
    secondary: '#14B8A6',
    success: '#22C55E',
    warning: '#84CC16',
    error: '#F87171',
    background: 'linear-gradient(135deg, #000000 0%, #0a1f0a 50%, #000000 100%)',
    panelBg: 'rgba(0,20,0,0.5)',
    gridColor: 'rgba(34,197,94,0.04)',
    glowColor: 'rgba(34,197,94,0.15)',
  },
};

const DEFAULT_AGENTS: Record<string, AgentConfig> = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    color: '#FF6B35',
    icon: '◈',
    enabled: true,
    models: { fast: 'haiku', default: 'opus', heavy: 'opus' },
    commandTemplate: '',
    flags: []
  },
  codex: {
    id: 'codex',
    name: 'Codex CLI',
    color: '#00D4AA',
    icon: '◆',
    enabled: true,
    models: { fast: 'gpt-5.1-codex-mini', default: 'gpt-5.1-codex-max', heavy: 'gpt-5.1-codex-max' },
    commandTemplate: '',
    flags: []
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini CLI',
    color: '#8B5CF6',
    icon: '◇',
    enabled: true,
    models: { fast: 'gemini-2.5-flash', default: 'gemini-3-pro-preview', heavy: 'gemini-3-pro' },
    commandTemplate: '',
    flags: []
  },
  raw: {
    id: 'raw',
    name: 'Raw CLI',
    color: '#64748B',
    icon: '▢',
    enabled: true,
    models: { fast: 'N/A', default: 'N/A', heavy: 'N/A' },
    commandTemplate: '',
    flags: []
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatTime = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatTimeShort = (date: Date | string | null | undefined): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const getRandomOutput = (agent: string): string => {
  const outputs: Record<string, string[]> = {
    claude: [
      'Analyzing code structure...',
      'Identifying patterns...',
      'Generating suggestions...',
      'Running static analysis...',
      'Checking dependencies...',
    ],
    codex: [
      'Parsing AST...',
      'Evaluating complexity...',
      'Generating tests...',
      'Optimizing logic...',
      'Validating syntax...',
    ],
    gemini: [
      'Processing request...',
      'Analyzing context...',
      'Generating documentation...',
      'Reviewing structure...',
      'Compiling results...',
    ],
    raw: [
      'Executing command...',
      'Processing output...',
      'Waiting for response...',
    ],
  };
  const list = outputs[agent] || outputs.raw;
  return list[Math.floor(Math.random() * list.length)];
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ForkTerminalUI() {
  // Navigation & View State
  const [activeView, setActiveView] = useState<'launch' | 'monitor' | 'workflows' | 'settings'>('launch');

  // Settings State (load early so we can use defaultModel)
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('fork-terminal-settings');
    return saved ? JSON.parse(saved) : {
      autoFocus: true,
      soundEnabled: true,
      maxConcurrent: 5,
      defaultModel: 'default',
      theme: 'cyberpunk',
    };
  });

  // Launch Panel State
  const [selectedAgent, setSelectedAgent] = useState('claude');
  const [modelTier, setModelTier] = useState<'fast' | 'default' | 'heavy'>(settings.defaultModel);
  const [prompt, setPrompt] = useState('');
  const [includeSummary, setIncludeSummary] = useState(false);
  const [showLaunchAnimation, setShowLaunchAnimation] = useState(false);

  // Multi-Fork Mode State
  const [multiForkMode, setMultiForkMode] = useState(false);
  const [multiForkQueue, setMultiForkQueue] = useState<QueueItem[]>([]);

  // Fork Inspector State
  const [selectedFork, setSelectedFork] = useState<Fork | null>(null);
  const [showInspector, setShowInspector] = useState(false);

  // Keyboard Shortcuts Modal
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // Terminal Output
  const [terminalOutput, setTerminalOutput] = useState<TerminalLine[]>([
    { type: 'system', text: '> Fork Terminal v2.0.0 initialized', time: new Date() },
    { type: 'system', text: '> Agent orchestration layer online', time: new Date() },
    { type: 'info', text: '> Ready to spawn parallel agents...', time: new Date() },
  ]);

  // Stats
  const [stats, setStats] = useState<ForkStats>({
    totalForks: 0,
    completedForks: 0,
    avgDuration: 0,
    agentUsage: { claude: 0, codex: 0, gemini: 0, raw: 0 },
  });

  // Local fork management for UI (extends API forks)
  const [localForks, setLocalForks] = useState<Fork[]>([]);
  const forkIdCounter = useRef(1);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Hooks
  const { forks: apiForks, createFork: apiCreateFork, terminateFork } = useForks();
  const { agents: fetchedAgents } = useAgents();

  // Use fetched agents or fallback
  const agents = Object.keys(fetchedAgents).length > 0 ? fetchedAgents : DEFAULT_AGENTS;

  // ============================================================================
  // TERMINAL OUTPUT HELPERS
  // ============================================================================

  const addTerminalLine = useCallback((type: TerminalLine['type'], text: string) => {
    setTerminalOutput(prev => [...prev.slice(-100), { type, text: `> ${text}`, time: new Date() }]);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // ============================================================================
  // SETTINGS PERSISTENCE
  // ============================================================================

  useEffect(() => {
    localStorage.setItem('fork-terminal-settings', JSON.stringify(settings));
  }, [settings]);

  // Sync modelTier when defaultModel setting changes
  useEffect(() => {
    setModelTier(settings.defaultModel);
  }, [settings.defaultModel]);

  // ============================================================================
  // SOUND EFFECTS
  // ============================================================================

  const playSound = useCallback((type: 'launch' | 'success' | 'error' | 'cancel') => {
    if (!settings.soundEnabled) return;

    // Create audio context for generating tones
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different sounds for different events
      switch (type) {
        case 'launch':
          oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
          oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.1); // A5
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.15);
          break;
        case 'success':
          oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
          oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
          oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
          break;
        case 'error':
          oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.2);
          break;
        case 'cancel':
          oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
      }
    } catch {
      // Audio not supported or blocked
    }
  }, [settings.soundEnabled]);

  // ============================================================================
  // FORK MANAGEMENT
  // ============================================================================

  // Check if we can launch more forks based on maxConcurrent setting
  const canLaunchFork = useCallback((): boolean => {
    const runningCount = localForks.filter(f =>
      ['running', 'spawning', 'queued'].includes(f.status)
    ).length;
    return runningCount < settings.maxConcurrent;
  }, [localForks, settings.maxConcurrent]);

  const createLocalFork = useCallback((agent: string, tier: 'fast' | 'default' | 'heavy', taskPrompt: string, options: { includeSummary?: boolean; workflowId?: string } = {}): Fork => {
    const id = `local-${forkIdCounter.current++}`;
    const agentConfig = agents[agent];
    const fork: Fork = {
      id,
      agent,
      model: agentConfig?.models[tier] || 'N/A',
      modelTier: tier,
      status: 'queued',
      task: taskPrompt,
      prompt: taskPrompt,
      startedAt: new Date().toISOString(),
      progress: 0,
      output: [],
      includeSummary: options.includeSummary || false,
      workflowId: options.workflowId,
    };
    return fork;
  }, [agents]);

  const launchFork = useCallback(async (fork: Fork) => {
    // Check if we can launch more forks
    if (!canLaunchFork()) {
      addTerminalLine('warning', `Max concurrent forks (${settings.maxConcurrent}) reached. Waiting...`);
      // Keep fork in queued state until slot opens
      return;
    }

    // Update to spawning status
    setLocalForks(prev => prev.map(f =>
      f.id === fork.id ? { ...f, status: 'spawning' as ForkStatus, startedAt: new Date().toISOString() } : f
    ));

    const agentConfig = agents[fork.agent];
    addTerminalLine('spawn', `Spawning ${agentConfig?.name || fork.agent} [${fork.model}]...`);
    addTerminalLine('info', `Task: "${fork.task.slice(0, 60)}${fork.task.length > 60 ? '...' : ''}"`);
    playSound('launch');

    // Call API to create fork (pass autoFocus setting)
    const result = await apiCreateFork({
      agent: fork.agent,
      modelTier: fork.modelTier,
      prompt: fork.prompt,
      includeSummary: fork.includeSummary,
      autoFocus: settings.autoFocus,
    });

    if (result) {
      // Update local fork with API result
      setLocalForks(prev => prev.map(f =>
        f.id === fork.id ? {
          ...f,
          id: result.id,
          status: 'running' as ForkStatus,
          progress: 5,
          pid: result.pid || Math.floor(Math.random() * 90000) + 10000
        } : f
      ));
      addTerminalLine('success', `✓ Fork #${result.id} launched [PID: ${result.pid || 'N/A'}]`);
    } else {
      setLocalForks(prev => prev.map(f =>
        f.id === fork.id ? { ...f, status: 'failed' as ForkStatus } : f
      ));
      addTerminalLine('error', `✗ Failed to launch fork`);
      playSound('error');
    }
  }, [agents, apiCreateFork, addTerminalLine, canLaunchFork, settings.maxConcurrent, settings.autoFocus, playSound]);

  const launchSingleFork = useCallback(async () => {
    if (!prompt.trim()) return;

    setShowLaunchAnimation(true);
    const fork = createLocalFork(selectedAgent, modelTier, prompt, { includeSummary });
    setLocalForks(prev => [fork, ...prev]);

    setTimeout(async () => {
      await launchFork(fork);
      setShowLaunchAnimation(false);
      setPrompt('');
    }, 300);
  }, [prompt, selectedAgent, modelTier, includeSummary, createLocalFork, launchFork]);

  const launchMultiFork = useCallback(async () => {
    if (multiForkQueue.length === 0) return;

    setShowLaunchAnimation(true);
    addTerminalLine('workflow', `Launching ${multiForkQueue.length} forks in sequence...`);

    const newForks = multiForkQueue.map(item =>
      createLocalFork(item.agent, item.modelTier, item.prompt, { includeSummary: item.includeSummary })
    );

    setLocalForks(prev => [...newForks, ...prev]);

    // Stagger launches
    for (let i = 0; i < newForks.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      await launchFork(newForks[i]);
    }

    setShowLaunchAnimation(false);
    setMultiForkQueue([]);
  }, [multiForkQueue, createLocalFork, launchFork, addTerminalLine]);

  const launchWorkflow = useCallback(async (workflow: WorkflowTemplate) => {
    setShowLaunchAnimation(true);
    addTerminalLine('workflow', `Launching workflow: ${workflow.name}`);

    const newForks = workflow.forks.map(item =>
      createLocalFork(item.agent, item.modelTier, item.prompt, { workflowId: workflow.id })
    );

    setLocalForks(prev => [...newForks, ...prev]);

    // Stagger launches
    for (let i = 0; i < newForks.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 600));
      await launchFork(newForks[i]);
    }

    setShowLaunchAnimation(false);
  }, [createLocalFork, launchFork, addTerminalLine]);

  const cancelFork = useCallback(async (forkId: string) => {
    await terminateFork(forkId);
    setLocalForks(prev => prev.map(f =>
      f.id === forkId && ['running', 'queued', 'spawning'].includes(f.status)
        ? { ...f, status: 'cancelled' as ForkStatus, completedAt: new Date().toISOString() }
        : f
    ));
    addTerminalLine('warning', `Fork #${forkId} cancelled`);
    playSound('cancel');
  }, [terminateFork, addTerminalLine, playSound]);

  const retryFork = useCallback(async (fork: Fork) => {
    const newFork = createLocalFork(fork.agent, fork.modelTier, fork.task, {
      includeSummary: fork.includeSummary,
      workflowId: fork.workflowId
    });
    setLocalForks(prev => [newFork, ...prev]);
    setTimeout(() => launchFork(newFork), 300);
  }, [createLocalFork, launchFork]);

  const clearHistory = useCallback(() => {
    setLocalForks(prev => prev.filter(f => ['running', 'spawning', 'queued'].includes(f.status)));
    addTerminalLine('system', 'Fork history cleared');
  }, [addTerminalLine]);

  // ============================================================================
  // MULTI-FORK QUEUE MANAGEMENT
  // ============================================================================

  const addToQueue = useCallback(() => {
    if (!prompt.trim()) return;
    setMultiForkQueue(prev => [...prev, {
      id: Date.now(),
      agent: selectedAgent,
      modelTier,
      prompt,
      includeSummary,
    }]);
    setPrompt('');
  }, [prompt, selectedAgent, modelTier, includeSummary]);

  const removeFromQueue = useCallback((id: number) => {
    setMultiForkQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setMultiForkQueue([]);
  }, []);

  // ============================================================================
  // MERGE API FORKS WITH LOCAL FORKS
  // ============================================================================

  const allForks = [...localForks];
  // Add API forks that aren't in local forks
  apiForks.forEach(apiFork => {
    if (!localForks.find(lf => lf.id === apiFork.id)) {
      allForks.push({
        ...apiFork,
        output: Array.isArray(apiFork.output)
          ? apiFork.output.map(o => typeof o === 'string' ? { time: new Date(), text: o } : o)
          : [],
      } as Fork);
    }
  });

  // ============================================================================
  // PROGRESS SIMULATION (for demo purposes)
  // ============================================================================

  useEffect(() => {
    const interval = setInterval(() => {
      setLocalForks(prev => prev.map(fork => {
        if (fork.status === 'running' && fork.progress < 100) {
          const increment = Math.random() * 8 + 2;
          const newProgress = Math.min(100, fork.progress + increment);

          // Random output simulation
          const newOutput = Math.random() > 0.7
            ? [...fork.output, { time: new Date(), text: getRandomOutput(fork.agent) }]
            : fork.output;

          if (newProgress >= 100) {
            return {
              ...fork,
              progress: 100,
              status: (Math.random() > 0.1 ? 'completed' : 'failed') as ForkStatus,
              completedAt: new Date().toISOString(),
              duration: Date.now() - new Date(fork.startedAt).getTime(),
              output: newOutput,
            };
          }
          return { ...fork, progress: newProgress, output: newOutput };
        }
        return fork;
      }));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // ============================================================================
  // SOUND EFFECTS ON FORK COMPLETION
  // ============================================================================

  const prevForksRef = useRef<Fork[]>([]);

  useEffect(() => {
    // Check for newly completed or failed forks
    localForks.forEach(fork => {
      const prevFork = prevForksRef.current.find(f => f.id === fork.id);
      if (prevFork) {
        // Fork existed before - check if status changed to completed/failed
        if (prevFork.status === 'running' && fork.status === 'completed') {
          playSound('success');
          addTerminalLine('success', `✓ Fork #${fork.id} completed`);
        } else if (prevFork.status === 'running' && fork.status === 'failed') {
          playSound('error');
          addTerminalLine('error', `✗ Fork #${fork.id} failed`);
        }
      }
    });
    prevForksRef.current = localForks;
  }, [localForks, playSound, addTerminalLine]);

  // ============================================================================
  // UPDATE STATS
  // ============================================================================

  useEffect(() => {
    const completed = allForks.filter(f => f.status === 'completed');
    const durations = completed.filter(f => f.duration).map(f => f.duration!);

    setStats({
      totalForks: allForks.length,
      completedForks: completed.length,
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      agentUsage: {
        claude: allForks.filter(f => f.agent === 'claude').length,
        codex: allForks.filter(f => f.agent === 'codex').length,
        gemini: allForks.filter(f => f.agent === 'gemini').length,
        raw: allForks.filter(f => f.agent === 'raw').length,
      },
    });
  }, [allForks]);

  // ============================================================================
  // KEYBOARD SHORTCUTS
  // ============================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === '?' && e.shiftKey) {
        setShowKeyboardShortcuts(prev => !prev);
      } else if (e.key === '1') {
        setActiveView('launch');
      } else if (e.key === '2') {
        setActiveView('monitor');
      } else if (e.key === '3') {
        setActiveView('workflows');
      } else if (e.key === '4') {
        setActiveView('settings');
      } else if (e.key === 'Escape') {
        setShowInspector(false);
        setShowKeyboardShortcuts(false);
      } else if (e.key === 'm' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setMultiForkMode(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ============================================================================
  // RENDER
  // ============================================================================

  const activeForks = allForks.filter(f => ['queued', 'spawning', 'running'].includes(f.status));
  const completedForks = allForks.filter(f => ['completed', 'failed', 'cancelled', 'terminated'].includes(f.status));
  const runningCount = allForks.filter(f => f.status === 'running').length;

  // Get current theme
  const theme = THEMES[settings.theme] || THEMES.cyberpunk;

  return (
    <div style={{
      ...styles.container,
      background: theme.background,
    }}>
      <style>{globalStyles}</style>

      {/* Background Effects */}
      <div style={{
        ...styles.gridBackground,
        backgroundImage: `
          linear-gradient(${theme.gridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${theme.gridColor} 1px, transparent 1px)
        `,
      }} />
      <div style={{
        ...styles.glowOrb1,
        background: `radial-gradient(circle, ${theme.glowColor} 0%, transparent 70%)`,
      }} />
      <div style={{
        ...styles.glowOrb2,
        background: `radial-gradient(circle, ${theme.secondary}15 0%, transparent 70%)`,
      }} />
      <div style={{
        ...styles.glowOrb3,
        background: `radial-gradient(circle, ${theme.success}12 0%, transparent 70%)`,
      }} />
      <div style={{
        ...styles.scanline,
        background: `linear-gradient(transparent, ${theme.primary}15, transparent)`,
      }} />

      {/* Keyboard Shortcuts Modal */}
      {showKeyboardShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowKeyboardShortcuts(false)} />
      )}

      {/* Fork Inspector Sidebar */}
      {showInspector && selectedFork && (
        <ForkInspector
          fork={selectedFork}
          agents={agents}
          onClose={() => setShowInspector(false)}
          onCancel={cancelFork}
          onRetry={retryFork}
        />
      )}

      {/* Main Container */}
      <div style={styles.mainContainer}>
        {/* Header */}
        <Header
          runningCount={runningCount}
          onShowShortcuts={() => setShowKeyboardShortcuts(true)}
        />

        {/* Navigation */}
        <Navigation
          activeView={activeView}
          onChangeView={setActiveView}
          queueCount={multiForkQueue.length}
        />

        {/* Main Content Grid */}
        <div style={styles.contentGrid}>
          {/* Left Panel */}
          <div style={styles.leftPanel}>
            {activeView === 'launch' && (
              <LaunchPanel
                agents={agents}
                selectedAgent={selectedAgent}
                setSelectedAgent={setSelectedAgent}
                modelTier={modelTier}
                setModelTier={setModelTier}
                prompt={prompt}
                setPrompt={setPrompt}
                includeSummary={includeSummary}
                setIncludeSummary={setIncludeSummary}
                multiForkMode={multiForkMode}
                setMultiForkMode={setMultiForkMode}
                multiForkQueue={multiForkQueue}
                addToQueue={addToQueue}
                removeFromQueue={removeFromQueue}
                clearQueue={clearQueue}
                launchSingleFork={launchSingleFork}
                launchMultiFork={launchMultiFork}
                showLaunchAnimation={showLaunchAnimation}
              />
            )}

            {activeView === 'monitor' && (
              <MonitorPanel
                forks={allForks}
                activeForks={activeForks}
                completedForks={completedForks}
                agents={agents}
                onSelectFork={(fork) => { setSelectedFork(fork); setShowInspector(true); }}
                onCancelFork={cancelFork}
                onClearHistory={clearHistory}
              />
            )}

            {activeView === 'workflows' && (
              <WorkflowsPanel
                workflows={WORKFLOW_TEMPLATES}
                agents={agents}
                onLaunchWorkflow={launchWorkflow}
              />
            )}

            {activeView === 'settings' && (
              <SettingsPanel
                settings={settings}
                setSettings={setSettings}
              />
            )}
          </div>

          {/* Right Panel - Terminal & Stats */}
          <div style={styles.rightPanel}>
            <TerminalPanel
              output={terminalOutput}
              terminalRef={terminalRef}
            />
            <StatsPanel stats={stats} agents={agents} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface HeaderProps {
  runningCount: number;
  onShowShortcuts: () => void;
}

function Header({ runningCount, onShowShortcuts }: HeaderProps) {
  return (
    <header style={styles.header}>
      <div style={styles.headerLeft}>
        <div style={styles.logo}>⑂</div>
        <div>
          <h1 style={styles.title}>FORK TERMINAL</h1>
          <p style={styles.subtitle}>Agent Orchestration Command Center v2.0</p>
        </div>
      </div>

      <div style={styles.headerRight}>
        <button
          onClick={onShowShortcuts}
          style={styles.shortcutsButton}
          title="Keyboard shortcuts"
        >
          <span style={{ opacity: 0.7 }}>⌘</span> ?
        </button>

        <div style={{
          ...styles.statusBadge,
          background: runningCount > 0 ? 'rgba(0,212,170,0.1)' : 'rgba(100,116,139,0.1)',
          borderColor: runningCount > 0 ? 'rgba(0,212,170,0.3)' : 'rgba(100,116,139,0.3)',
        }}>
          <div style={{
            ...styles.statusDot,
            background: runningCount > 0 ? '#00D4AA' : '#64748B',
            animation: runningCount > 0 ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ color: runningCount > 0 ? '#00D4AA' : '#64748B' }}>
            {runningCount} ACTIVE
          </span>
        </div>

        <div style={styles.sessionBadge}>
          SESSION #{Math.floor(Math.random() * 9000 + 1000)}
        </div>
      </div>
    </header>
  );
}

interface NavigationProps {
  activeView: string;
  onChangeView: (view: 'launch' | 'monitor' | 'workflows' | 'settings') => void;
  queueCount: number;
}

function Navigation({ activeView, onChangeView, queueCount }: NavigationProps) {
  const tabs = [
    { id: 'launch' as const, label: 'LAUNCH', icon: '◈', shortcut: '1' },
    { id: 'monitor' as const, label: 'MONITOR', icon: '◉', shortcut: '2' },
    { id: 'workflows' as const, label: 'WORKFLOWS', icon: '◎', shortcut: '3' },
    { id: 'settings' as const, label: 'SETTINGS', icon: '⚙', shortcut: '4' },
  ];

  return (
    <nav style={styles.nav}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChangeView(tab.id)}
          style={{
            ...styles.navButton,
            ...(activeView === tab.id ? styles.navButtonActive : {}),
          }}
        >
          <span>{tab.icon}</span>
          {tab.label}
          {tab.id === 'launch' && queueCount > 0 && (
            <span style={styles.queueBadge}>{queueCount}</span>
          )}
          <span style={styles.shortcutHint}>{tab.shortcut}</span>
        </button>
      ))}
    </nav>
  );
}

interface LaunchPanelProps {
  agents: Record<string, AgentConfig>;
  selectedAgent: string;
  setSelectedAgent: (agent: string) => void;
  modelTier: 'fast' | 'default' | 'heavy';
  setModelTier: (tier: 'fast' | 'default' | 'heavy') => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  includeSummary: boolean;
  setIncludeSummary: (include: boolean) => void;
  multiForkMode: boolean;
  setMultiForkMode: (mode: boolean) => void;
  multiForkQueue: QueueItem[];
  addToQueue: () => void;
  removeFromQueue: (id: number) => void;
  clearQueue: () => void;
  launchSingleFork: () => void;
  launchMultiFork: () => void;
  showLaunchAnimation: boolean;
}

function LaunchPanel({
  agents, selectedAgent, setSelectedAgent, modelTier, setModelTier,
  prompt, setPrompt, includeSummary, setIncludeSummary,
  multiForkMode, setMultiForkMode, multiForkQueue,
  addToQueue, removeFromQueue, clearQueue,
  launchSingleFork, launchMultiFork, showLaunchAnimation
}: LaunchPanelProps) {
  return (
    <div style={styles.panel}>
      {/* Mode Toggle */}
      <div style={styles.modeToggle}>
        <button
          onClick={() => setMultiForkMode(false)}
          style={{
            ...styles.modeButton,
            ...(multiForkMode ? {} : styles.modeButtonActive),
          }}
        >
          Single Fork
        </button>
        <button
          onClick={() => setMultiForkMode(true)}
          style={{
            ...styles.modeButton,
            ...(multiForkMode ? styles.modeButtonActive : {}),
          }}
        >
          Multi-Fork
        </button>
      </div>

      {/* Agent Selection */}
      <div style={styles.section}>
        <label style={styles.label}>SELECT AGENT</label>
        <div style={styles.agentGrid}>
          {Object.entries(agents).map(([key, agent]) => (
            <button
              key={key}
              onClick={() => setSelectedAgent(key)}
              style={{
                ...styles.agentCard,
                ...(selectedAgent === key ? {
                  background: `${agent.color}15`,
                  borderColor: agent.color,
                  boxShadow: `0 0 20px ${agent.color}30`,
                } : {}),
              }}
            >
              <div style={{
                ...styles.agentIcon,
                color: agent.color,
                textShadow: selectedAgent === key ? `0 0 20px ${agent.color}` : 'none',
              }}>
                {agent.icon}
              </div>
              <div style={{
                ...styles.agentName,
                color: selectedAgent === key ? '#fff' : '#94a3b8',
              }}>
                {agent.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Model Tier */}
      <div style={styles.section}>
        <label style={styles.label}>MODEL TIER</label>
        <div style={styles.tierGrid}>
          {(['fast', 'default', 'heavy'] as const).map(tier => (
            <button
              key={tier}
              onClick={() => setModelTier(tier)}
              style={{
                ...styles.tierButton,
                ...(modelTier === tier ? styles.tierButtonActive : {}),
              }}
            >
              <div style={styles.tierLabel}>
                {tier === 'fast' ? '⚡' : tier === 'default' ? '◆' : '🔥'} {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </div>
              <div style={styles.tierModel}>
                {agents[selectedAgent]?.models[tier] || 'N/A'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Task Input */}
      <div style={styles.section}>
        <label style={styles.label}>TASK PROMPT</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe the task for the forked agent..."
          style={styles.textarea}
        />
      </div>

      {/* Context Toggle */}
      <div style={styles.contextToggle}>
        <button
          onClick={() => setIncludeSummary(!includeSummary)}
          style={{
            ...styles.toggle,
            background: includeSummary ? 'linear-gradient(90deg, #8B5CF6, #A78BFA)' : 'rgba(255,255,255,0.1)',
          }}
        >
          <div style={{
            ...styles.toggleKnob,
            left: includeSummary ? '23px' : '3px',
          }} />
        </button>
        <div>
          <div style={styles.toggleLabel}>Include Context Summary</div>
          <div style={styles.toggleHint}>Hand off conversation context to the forked agent</div>
        </div>
      </div>

      {/* Multi-Fork Queue */}
      {multiForkMode && (
        <div style={styles.queueSection}>
          <div style={styles.queueHeader}>
            <span style={styles.label}>FORK QUEUE ({multiForkQueue.length})</span>
            {multiForkQueue.length > 0 && (
              <button onClick={clearQueue} style={styles.clearButton}>Clear All</button>
            )}
          </div>

          {multiForkQueue.length > 0 && (
            <div style={styles.queueList}>
              {multiForkQueue.map((item) => (
                <div key={item.id} style={styles.queueItem}>
                  <span style={{ color: agents[item.agent]?.color || '#64748b' }}>{agents[item.agent]?.icon || '▢'}</span>
                  <span style={styles.queueItemText}>{item.prompt.slice(0, 40)}...</span>
                  <button
                    onClick={() => removeFromQueue(item.id)}
                    style={styles.queueRemove}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={addToQueue}
            disabled={!prompt.trim()}
            style={{
              ...styles.addToQueueButton,
              opacity: prompt.trim() ? 1 : 0.5,
              cursor: prompt.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            + Add to Queue
          </button>
        </div>
      )}

      {/* Launch Button */}
      <button
        onClick={multiForkMode ? launchMultiFork : launchSingleFork}
        disabled={multiForkMode ? multiForkQueue.length === 0 : !prompt.trim()}
        style={{
          ...styles.launchButton,
          opacity: (multiForkMode ? multiForkQueue.length > 0 : prompt.trim()) ? 1 : 0.5,
          cursor: (multiForkMode ? multiForkQueue.length > 0 : prompt.trim()) ? 'pointer' : 'not-allowed',
        }}
      >
        {showLaunchAnimation && <div style={styles.launchPulse} />}
        <span style={{ position: 'relative', zIndex: 1 }}>
          {showLaunchAnimation
            ? '◈ SPAWNING...'
            : multiForkMode
              ? `⑂ LAUNCH ${multiForkQueue.length} FORKS`
              : '⑂ LAUNCH FORK'
          }
        </span>
      </button>
    </div>
  );
}

interface MonitorPanelProps {
  forks: Fork[];
  activeForks: Fork[];
  completedForks: Fork[];
  agents: Record<string, AgentConfig>;
  onSelectFork: (fork: Fork) => void;
  onCancelFork: (id: string) => void;
  onClearHistory: () => void;
}

function MonitorPanel({ activeForks, completedForks, agents, onSelectFork, onCancelFork, onClearHistory }: MonitorPanelProps) {
  return (
    <div style={styles.panel}>
      {/* Active Forks */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <label style={styles.label}>ACTIVE FORKS ({activeForks.length})</label>
        </div>

        {activeForks.length > 0 ? (
          <div style={styles.forkList}>
            {activeForks.map(fork => (
              <ForkCard
                key={fork.id}
                fork={fork}
                agents={agents}
                onClick={() => onSelectFork(fork)}
                onCancel={() => onCancelFork(fork.id)}
              />
            ))}
          </div>
        ) : (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>⑂</div>
            <div>No active forks</div>
            <div style={styles.emptyHint}>Launch a fork to get started</div>
          </div>
        )}
      </div>

      {/* History */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <label style={styles.label}>HISTORY ({completedForks.length})</label>
          {completedForks.length > 0 && (
            <button onClick={onClearHistory} style={styles.clearButton}>Clear</button>
          )}
        </div>

        {completedForks.length > 0 ? (
          <div style={styles.historyList}>
            {completedForks.slice(0, 10).map(fork => (
              <div
                key={fork.id}
                style={styles.historyItem}
                onClick={() => onSelectFork(fork)}
              >
                <span style={{ color: agents[fork.agent]?.color || '#64748b' }}>{agents[fork.agent]?.icon || '▢'}</span>
                <span style={styles.historyTask}>{fork.task.slice(0, 35)}...</span>
                <span style={{
                  ...styles.historyStatus,
                  color: STATUS_COLORS[fork.status]?.text || '#64748b',
                }}>
                  {fork.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.emptyStateSmall}>No history yet</div>
        )}
      </div>
    </div>
  );
}

interface ForkCardProps {
  fork: Fork;
  agents: Record<string, AgentConfig>;
  onClick: () => void;
  onCancel: () => void;
}

function ForkCard({ fork, agents, onClick, onCancel }: ForkCardProps) {
  const agent = agents[fork.agent];
  const statusStyle = STATUS_COLORS[fork.status] || STATUS_COLORS.queued;

  return (
    <div style={{
      ...styles.forkCard,
      borderColor: `${agent?.color || '#64748b'}40`,
    }} onClick={onClick}>
      <div style={styles.forkCardHeader}>
        <div style={styles.forkCardAgent}>
          <span style={{ fontSize: '20px', color: agent?.color || '#64748b' }}>{agent?.icon || '▢'}</span>
          <div>
            <div style={styles.forkCardName}>{agent?.name || fork.agent}</div>
            <div style={styles.forkCardMeta}>{fork.model} • {fork.startedAt ? formatTime(fork.startedAt) : 'Queued'}</div>
          </div>
        </div>
        <div style={{
          ...styles.forkCardStatus,
          background: statusStyle.bg,
          borderColor: statusStyle.border,
          color: statusStyle.text,
        }}>
          {fork.status}
        </div>
      </div>

      <div style={styles.forkCardTask}>{fork.task}</div>

      {fork.status === 'running' && (
        <div style={styles.progressContainer}>
          <div style={{
            ...styles.progressBar,
            width: `${fork.progress}%`,
            background: agent?.color ? `linear-gradient(90deg, ${agent.color}, ${agent.color}88)` : 'linear-gradient(90deg, #64748b, #64748b88)',
          }} />
        </div>
      )}

      {(fork.status === 'running' || fork.status === 'spawning') && (
        <button
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          style={styles.cancelButton}
        >
          Cancel
        </button>
      )}
    </div>
  );
}

interface WorkflowsPanelProps {
  workflows: WorkflowTemplate[];
  agents: Record<string, AgentConfig>;
  onLaunchWorkflow: (workflow: WorkflowTemplate) => void;
}

function WorkflowsPanel({ workflows, agents, onLaunchWorkflow }: WorkflowsPanelProps) {
  return (
    <div style={styles.panel}>
      <div style={styles.section}>
        <label style={styles.label}>WORKFLOW TEMPLATES</label>
        <div style={styles.workflowGrid}>
          {workflows.map(workflow => (
            <div key={workflow.id} style={styles.workflowCard}>
              <div style={styles.workflowIcon}>{workflow.icon}</div>
              <div style={styles.workflowName}>{workflow.name}</div>
              <div style={styles.workflowDesc}>{workflow.description}</div>
              <div style={styles.workflowAgents}>
                {workflow.forks.map((fork, i) => (
                  <span
                    key={i}
                    style={{
                      ...styles.workflowAgentDot,
                      background: agents[fork.agent]?.color || '#64748b',
                    }}
                    title={agents[fork.agent]?.name || fork.agent}
                  />
                ))}
                <span style={styles.workflowAgentCount}>{workflow.forks.length} agents</span>
              </div>
              <button
                onClick={() => onLaunchWorkflow(workflow)}
                style={styles.workflowLaunch}
              >
                Launch Workflow
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Workflow Builder Placeholder */}
      <div style={styles.section}>
        <label style={styles.label}>CREATE CUSTOM WORKFLOW</label>
        <div style={styles.customWorkflowPlaceholder}>
          <div style={styles.placeholderIcon}>+</div>
          <div>Workflow builder coming soon</div>
          <div style={styles.placeholderHint}>Save your multi-fork configurations as reusable templates</div>
        </div>
      </div>
    </div>
  );
}

interface SettingsPanelProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

function SettingsPanel({ settings, setSettings }: SettingsPanelProps) {
  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    const defaultSettings: AppSettings = {
      autoFocus: true,
      soundEnabled: true,
      maxConcurrent: 5,
      defaultModel: 'default',
      theme: 'cyberpunk',
    };
    setSettings(defaultSettings);
  };

  return (
    <div style={styles.panel}>
      <div style={styles.section}>
        <label style={styles.label}>GENERAL</label>

        <div style={styles.settingRow}>
          <div>
            <div style={styles.settingLabel}>Auto-focus spawned terminals</div>
            <div style={styles.settingHint}>Bring new terminal windows to front</div>
          </div>
          <button
            onClick={() => updateSetting('autoFocus', !settings.autoFocus)}
            style={{
              ...styles.toggle,
              background: settings.autoFocus ? 'linear-gradient(90deg, #FF6B35, #FF8F6B)' : 'rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ ...styles.toggleKnob, left: settings.autoFocus ? '23px' : '3px' }} />
          </button>
        </div>

        <div style={styles.settingRow}>
          <div>
            <div style={styles.settingLabel}>Sound effects</div>
            <div style={styles.settingHint}>Play sounds on fork events</div>
          </div>
          <button
            onClick={() => updateSetting('soundEnabled', !settings.soundEnabled)}
            style={{
              ...styles.toggle,
              background: settings.soundEnabled ? 'linear-gradient(90deg, #FF6B35, #FF8F6B)' : 'rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ ...styles.toggleKnob, left: settings.soundEnabled ? '23px' : '3px' }} />
          </button>
        </div>

        <div style={styles.settingRow}>
          <div>
            <div style={styles.settingLabel}>Max concurrent forks</div>
            <div style={styles.settingHint}>Limit parallel agent instances</div>
          </div>
          <select
            value={settings.maxConcurrent}
            onChange={e => updateSetting('maxConcurrent', parseInt(e.target.value))}
            style={styles.select}
          >
            {[1, 3, 5, 10, 20].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>DEFAULTS</label>

        <div style={styles.settingRow}>
          <div>
            <div style={styles.settingLabel}>Default model tier</div>
            <div style={styles.settingHint}>Pre-selected model tier for new forks</div>
          </div>
          <select
            value={settings.defaultModel}
            onChange={e => updateSetting('defaultModel', e.target.value as AppSettings['defaultModel'])}
            style={styles.select}
          >
            <option value="fast">Fast</option>
            <option value="default">Default</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>APPEARANCE</label>

        <div style={styles.settingRow}>
          <div>
            <div style={styles.settingLabel}>Theme</div>
            <div style={styles.settingHint}>Visual style preset</div>
          </div>
          <select
            value={settings.theme}
            onChange={e => updateSetting('theme', e.target.value as AppSettings['theme'])}
            style={styles.select}
          >
            <option value="cyberpunk">Cyberpunk</option>
            <option value="minimal">Minimal</option>
            <option value="matrix">Matrix</option>
          </select>
        </div>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>DANGER ZONE</label>
        <button onClick={resetSettings} style={styles.dangerButton}>
          Reset All Settings
        </button>
      </div>
    </div>
  );
}

interface TerminalPanelProps {
  output: TerminalLine[];
  terminalRef: React.RefObject<HTMLDivElement>;
}

function TerminalPanel({ output, terminalRef }: TerminalPanelProps) {
  const getLineColor = (type: TerminalLine['type']): string => {
    switch (type) {
      case 'success': return '#00D4AA';
      case 'error': return '#EF4444';
      case 'warning': return '#FFC107';
      case 'spawn': return '#FF6B35';
      case 'workflow': return '#8B5CF6';
      case 'info': return '#64748B';
      default: return '#94a3b8';
    }
  };

  return (
    <div style={styles.terminalPanel}>
      <div style={styles.terminalHeader}>
        <div style={styles.terminalDots}>
          <div style={{ ...styles.dot, background: '#FF5F57' }} />
          <div style={{ ...styles.dot, background: '#FFBD2E' }} />
          <div style={{ ...styles.dot, background: '#28CA41' }} />
        </div>
        <span style={styles.terminalTitle}>TERMINAL OUTPUT</span>
        <div style={styles.terminalDots} />
      </div>

      <div style={styles.terminalContent} ref={terminalRef}>
        {output.map((line, i) => (
          <div key={i} style={{ color: getLineColor(line.type) }}>
            <span style={styles.terminalTime}>{formatTimeShort(line.time)}</span>
            {line.text}
          </div>
        ))}
        <div style={styles.terminalCursor}>
          <span>&gt; </span>
          <span style={styles.cursorBlock} />
        </div>
      </div>
    </div>
  );
}

interface StatsPanelProps {
  stats: ForkStats;
  agents: Record<string, AgentConfig>;
}

function StatsPanel({ stats, agents }: StatsPanelProps) {
  return (
    <div style={styles.statsPanel}>
      <div style={styles.statsGrid}>
        <div style={styles.statItem}>
          <div style={{ ...styles.statValue, color: '#FF6B35' }}>{stats.totalForks}</div>
          <div style={styles.statLabel}>TOTAL</div>
        </div>
        <div style={styles.statItem}>
          <div style={{ ...styles.statValue, color: '#00D4AA' }}>{stats.completedForks}</div>
          <div style={styles.statLabel}>COMPLETED</div>
        </div>
        <div style={styles.statItem}>
          <div style={{ ...styles.statValue, color: '#FFC107' }}>{stats.totalForks - stats.completedForks}</div>
          <div style={styles.statLabel}>PENDING</div>
        </div>
        <div style={styles.statItem}>
          <div style={{ ...styles.statValue, color: '#8B5CF6' }}>
            {stats.avgDuration > 0 ? `${Math.round(stats.avgDuration / 1000)}s` : '—'}
          </div>
          <div style={styles.statLabel}>AVG TIME</div>
        </div>
      </div>

      <div style={styles.agentUsage}>
        {Object.entries(stats.agentUsage).map(([agent, count]) => (
          count > 0 && (
            <div key={agent} style={styles.agentUsageItem}>
              <span style={{ color: agents[agent]?.color || '#64748b' }}>{agents[agent]?.icon || '▢'}</span>
              <span>{count}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
}

interface ForkInspectorProps {
  fork: Fork;
  agents: Record<string, AgentConfig>;
  onClose: () => void;
  onCancel: (id: string) => void;
  onRetry: (fork: Fork) => void;
}

function ForkInspector({ fork, agents, onClose, onCancel, onRetry }: ForkInspectorProps) {
  const agent = agents[fork.agent];
  const statusStyle = STATUS_COLORS[fork.status] || STATUS_COLORS.queued;

  return (
    <div style={styles.inspectorOverlay} onClick={onClose}>
      <div style={styles.inspector} onClick={e => e.stopPropagation()}>
        <div style={styles.inspectorHeader}>
          <h3 style={styles.inspectorTitle}>Fork Inspector</h3>
          <button onClick={onClose} style={styles.inspectorClose}>×</button>
        </div>

        <div style={styles.inspectorContent}>
          <div style={styles.inspectorAgent}>
            <div style={{ fontSize: '32px', color: agent?.color || '#64748b' }}>{agent?.icon || '▢'}</div>
            <div>
              <div style={styles.inspectorAgentName}>{agent?.name || fork.agent}</div>
              <div style={styles.inspectorAgentModel}>{fork.model}</div>
            </div>
            <div style={{
              ...styles.inspectorStatus,
              background: statusStyle.bg,
              borderColor: statusStyle.border,
              color: statusStyle.text,
            }}>
              {fork.status}
            </div>
          </div>

          <div style={styles.inspectorSection}>
            <label style={styles.inspectorLabel}>Task</label>
            <div style={styles.inspectorTask}>{fork.task}</div>
          </div>

          <div style={styles.inspectorMeta}>
            <div>
              <label style={styles.inspectorLabel}>Fork ID</label>
              <div style={styles.inspectorValue}>#{fork.id}</div>
            </div>
            <div>
              <label style={styles.inspectorLabel}>PID</label>
              <div style={styles.inspectorValue}>{fork.pid || '—'}</div>
            </div>
            <div>
              <label style={styles.inspectorLabel}>Started</label>
              <div style={styles.inspectorValue}>{fork.startedAt ? formatTime(fork.startedAt) : '—'}</div>
            </div>
            <div>
              <label style={styles.inspectorLabel}>Duration</label>
              <div style={styles.inspectorValue}>
                {fork.duration ? `${Math.round(fork.duration / 1000)}s` : '—'}
              </div>
            </div>
          </div>

          {fork.status === 'running' && (
            <div style={styles.inspectorProgress}>
              <div style={styles.inspectorProgressLabel}>Progress: {Math.round(fork.progress)}%</div>
              <div style={styles.inspectorProgressContainer}>
                <div style={{
                  ...styles.inspectorProgressBar,
                  width: `${fork.progress}%`,
                  background: agent?.color ? `linear-gradient(90deg, ${agent.color}, ${agent.color}88)` : 'linear-gradient(90deg, #64748b, #64748b88)',
                }} />
              </div>
            </div>
          )}

          {fork.output.length > 0 && (
            <div style={styles.inspectorSection}>
              <label style={styles.inspectorLabel}>Output</label>
              <div style={styles.inspectorOutput}>
                {fork.output.map((line, i) => (
                  <div key={i} style={styles.inspectorOutputLine}>
                    <span style={styles.inspectorOutputTime}>{formatTimeShort(line.time)}</span>
                    {line.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={styles.inspectorActions}>
          {(fork.status === 'running' || fork.status === 'spawning') && (
            <button onClick={() => onCancel(fork.id)} style={styles.inspectorCancelBtn}>
              Cancel Fork
            </button>
          )}
          {(fork.status === 'failed' || fork.status === 'cancelled') && (
            <button onClick={() => { onRetry(fork); onClose(); }} style={styles.inspectorRetryBtn}>
              Retry Fork
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  const shortcuts = [
    { keys: ['1'], desc: 'Go to Launch' },
    { keys: ['2'], desc: 'Go to Monitor' },
    { keys: ['3'], desc: 'Go to Workflows' },
    { keys: ['4'], desc: 'Go to Settings' },
    { keys: ['⌘', 'M'], desc: 'Toggle Multi-Fork Mode' },
    { keys: ['?'], desc: 'Show Shortcuts' },
    { keys: ['Esc'], desc: 'Close Panels' },
  ];

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.shortcutsModal} onClick={e => e.stopPropagation()}>
        <h3 style={styles.shortcutsTitle}>Keyboard Shortcuts</h3>
        <div style={styles.shortcutsList}>
          {shortcuts.map((s, i) => (
            <div key={i} style={styles.shortcutRow}>
              <div style={styles.shortcutKeys}>
                {s.keys.map((key, j) => (
                  <span key={j} style={styles.shortcutKey}>{key}</span>
                ))}
              </div>
              <div style={styles.shortcutDesc}>{s.desc}</div>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={styles.shortcutsClose}>Got it</button>
      </div>
    </div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Orbitron:wght@500;700;900&family=Inter:wght@400;500;600&display=swap');

  @keyframes gridPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }

  @keyframes float {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(30px, -20px) scale(1.1); }
  }

  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 20px currentColor; }
    50% { opacity: 0.7; box-shadow: 0 0 40px currentColor; }
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }

  @keyframes launchPulse {
    0% { transform: scale(0.8); opacity: 0; }
    50% { transform: scale(1.2); opacity: 0.5; }
    100% { transform: scale(1.5); opacity: 0; }
  }

  @keyframes progressGlow {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.3); }
  }

  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  * { box-sizing: border-box; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); }
  ::-webkit-scrollbar-thumb { background: rgba(255,107,53,0.3); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,107,53,0.5); }

  input, textarea, select, button { font-family: inherit; }
`;

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0d0d12 100%)',
    fontFamily: '"Inter", -apple-system, sans-serif',
    color: '#e4e4e7',
    position: 'relative',
    overflow: 'hidden',
  },
  gridBackground: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(255,107,53,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,107,53,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '60px 60px',
    animation: 'gridPulse 4s ease-in-out infinite',
  },
  glowOrb1: {
    position: 'fixed',
    top: '15%',
    left: '5%',
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(255,107,53,0.12) 0%, transparent 70%)',
    filter: 'blur(80px)',
    animation: 'float 10s ease-in-out infinite',
  },
  glowOrb2: {
    position: 'fixed',
    bottom: '10%',
    right: '10%',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
    filter: 'blur(60px)',
    animation: 'float 12s ease-in-out infinite reverse',
  },
  glowOrb3: {
    position: 'fixed',
    top: '50%',
    right: '30%',
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(0,212,170,0.08) 0%, transparent 70%)',
    filter: 'blur(50px)',
    animation: 'float 8s ease-in-out infinite',
  },
  scanline: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: 'linear-gradient(transparent, rgba(255,107,53,0.08), transparent)',
    animation: 'scanline 10s linear infinite',
    pointerEvents: 'none',
    zIndex: 100,
  },
  mainContainer: {
    position: 'relative',
    zIndex: 10,
    maxWidth: '1600px',
    margin: '0 auto',
    padding: '20px 24px',
  },

  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    paddingBottom: '20px',
    borderBottom: '1px solid rgba(255,107,53,0.15)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  logo: {
    width: '52px',
    height: '52px',
    background: 'linear-gradient(135deg, #FF6B35, #FF8F6B)',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '26px',
    fontWeight: 'bold',
    color: '#fff',
    boxShadow: '0 0 40px rgba(255,107,53,0.4)',
  },
  title: {
    fontFamily: '"Orbitron", sans-serif',
    fontSize: '26px',
    fontWeight: 900,
    margin: 0,
    background: 'linear-gradient(90deg, #FF6B35, #FF8F6B, #FFB088)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '3px',
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '11px',
    color: '#64748b',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  shortcutsButton: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: '"JetBrains Mono", monospace',
  },
  statusBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    border: '1px solid',
    borderRadius: '8px',
    fontSize: '11px',
    letterSpacing: '1px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  sessionBadge: {
    padding: '8px 14px',
    background: 'rgba(139,92,246,0.1)',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: '8px',
    fontSize: '11px',
    color: '#8B5CF6',
    letterSpacing: '1px',
    fontFamily: '"JetBrains Mono", monospace',
  },

  // Navigation
  nav: {
    display: 'flex',
    gap: '4px',
    marginBottom: '20px',
    background: 'rgba(0,0,0,0.3)',
    padding: '4px',
    borderRadius: '12px',
    width: 'fit-content',
  },
  navButton: {
    padding: '12px 20px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '8px',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '2px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
    position: 'relative',
  },
  navButtonActive: {
    background: 'linear-gradient(135deg, rgba(255,107,53,0.15), rgba(255,107,53,0.05))',
    border: '1px solid rgba(255,107,53,0.3)',
    color: '#FF6B35',
  },
  queueBadge: {
    background: '#FF6B35',
    color: '#fff',
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '10px',
    marginLeft: '4px',
  },
  shortcutHint: {
    fontSize: '9px',
    opacity: 0.5,
    marginLeft: '4px',
    fontFamily: '"JetBrains Mono", monospace',
  },

  // Content Grid
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: '20px',
  },

  // Panels
  leftPanel: {
    minHeight: '600px',
  },
  rightPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  panel: {
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '16px',
    padding: '24px',
    backdropFilter: 'blur(20px)',
  },

  // Sections
  section: {
    marginBottom: '24px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    fontSize: '10px',
    color: '#64748b',
    letterSpacing: '2px',
    marginBottom: '12px',
    fontWeight: 600,
  },

  // Mode Toggle
  modeToggle: {
    display: 'flex',
    gap: '4px',
    marginBottom: '24px',
    background: 'rgba(0,0,0,0.3)',
    padding: '4px',
    borderRadius: '10px',
  },
  modeButton: {
    flex: 1,
    padding: '10px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  },
  modeButtonActive: {
    background: 'rgba(255,107,53,0.15)',
    color: '#FF6B35',
  },

  // Agent Selection
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
  },
  agentCard: {
    padding: '16px 12px',
    background: 'rgba(255,255,255,0.02)',
    border: '2px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
  },
  agentIcon: {
    fontSize: '28px',
    marginBottom: '8px',
    transition: 'all 0.2s ease',
  },
  agentName: {
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '4px',
    transition: 'color 0.2s ease',
  },

  // Model Tier
  tierGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
  },
  tierButton: {
    padding: '14px',
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
  },
  tierButtonActive: {
    background: 'rgba(255,107,53,0.1)',
    borderColor: 'rgba(255,107,53,0.4)',
  },
  tierLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#e4e4e7',
    marginBottom: '4px',
  },
  tierModel: {
    fontSize: '10px',
    color: '#64748b',
    fontFamily: '"JetBrains Mono", monospace',
  },

  // Textarea
  textarea: {
    width: '100%',
    height: '100px',
    padding: '14px',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    color: '#e4e4e7',
    fontSize: '13px',
    fontFamily: '"JetBrains Mono", monospace',
    resize: 'none',
    outline: 'none',
    transition: 'border-color 0.2s ease',
  },

  // Context Toggle
  contextToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    background: 'rgba(139,92,246,0.08)',
    border: '1px solid rgba(139,92,246,0.2)',
    borderRadius: '10px',
    marginBottom: '24px',
  },
  toggle: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s ease',
  },
  toggleKnob: {
    width: '18px',
    height: '18px',
    background: '#fff',
    borderRadius: '50%',
    position: 'absolute',
    top: '3px',
    transition: 'left 0.2s ease',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  toggleLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#e4e4e7',
  },
  toggleHint: {
    fontSize: '11px',
    color: '#8B5CF6',
  },

  // Queue
  queueSection: {
    marginBottom: '24px',
    padding: '16px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  queueHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  queueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  queueItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
  },
  queueItemText: {
    flex: 1,
    fontSize: '12px',
    color: '#94a3b8',
  },
  queueRemove: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 4px',
  },
  addToQueueButton: {
    width: '100%',
    padding: '10px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px dashed rgba(255,255,255,0.2)',
    borderRadius: '8px',
    color: '#94a3b8',
    fontSize: '12px',
    cursor: 'pointer',
  },
  clearButton: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: '11px',
    cursor: 'pointer',
  },

  // Launch Button
  launchButton: {
    width: '100%',
    padding: '18px',
    background: 'linear-gradient(135deg, #FF6B35, #FF8F6B)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: '"Orbitron", sans-serif',
    letterSpacing: '3px',
    cursor: 'pointer',
    boxShadow: '0 0 40px rgba(255,107,53,0.4)',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden',
  },
  launchPulse: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255,255,255,0.3)',
    animation: 'launchPulse 1s ease-out infinite',
  },

  // Fork List
  forkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  forkCard: {
    padding: '16px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  forkCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '10px',
  },
  forkCardAgent: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  forkCardName: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#e4e4e7',
  },
  forkCardMeta: {
    fontSize: '10px',
    color: '#64748b',
  },
  forkCardStatus: {
    padding: '4px 10px',
    border: '1px solid',
    borderRadius: '20px',
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  forkCardTask: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '12px',
    lineHeight: 1.4,
  },
  progressContainer: {
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '12px',
  },
  progressBar: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.5s ease',
    animation: 'progressGlow 2s ease-in-out infinite',
  },
  cancelButton: {
    padding: '6px 12px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '6px',
    color: '#EF4444',
    fontSize: '11px',
    cursor: 'pointer',
  },

  // History
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  historyTask: {
    flex: 1,
    fontSize: '12px',
    color: '#94a3b8',
  },
  historyStatus: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },

  // Empty States
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#64748b',
  },
  emptyIcon: {
    fontSize: '48px',
    opacity: 0.3,
    marginBottom: '12px',
  },
  emptyHint: {
    fontSize: '12px',
    opacity: 0.7,
    marginTop: '4px',
  },
  emptyStateSmall: {
    padding: '20px',
    textAlign: 'center',
    color: '#4a5568',
    fontSize: '12px',
  },

  // Workflows
  workflowGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  workflowCard: {
    padding: '20px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    transition: 'all 0.2s ease',
  },
  workflowIcon: {
    fontSize: '28px',
    marginBottom: '12px',
  },
  workflowName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#e4e4e7',
    marginBottom: '6px',
  },
  workflowDesc: {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '12px',
    lineHeight: 1.4,
  },
  workflowAgents: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '16px',
  },
  workflowAgentDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  workflowAgentCount: {
    fontSize: '11px',
    color: '#64748b',
    marginLeft: '4px',
  },
  workflowLaunch: {
    width: '100%',
    padding: '10px',
    background: 'rgba(255,107,53,0.1)',
    border: '1px solid rgba(255,107,53,0.3)',
    borderRadius: '8px',
    color: '#FF6B35',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  customWorkflowPlaceholder: {
    padding: '40px 20px',
    textAlign: 'center',
    background: 'rgba(0,0,0,0.2)',
    border: '2px dashed rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#64748b',
  },
  placeholderIcon: {
    fontSize: '32px',
    opacity: 0.5,
    marginBottom: '8px',
  },
  placeholderHint: {
    fontSize: '12px',
    opacity: 0.7,
    marginTop: '4px',
  },

  // Settings
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  settingLabel: {
    fontSize: '13px',
    color: '#e4e4e7',
    marginBottom: '2px',
  },
  settingHint: {
    fontSize: '11px',
    color: '#64748b',
  },
  select: {
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#e4e4e7',
    fontSize: '12px',
    outline: 'none',
  },
  dangerButton: {
    padding: '12px 20px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    color: '#EF4444',
    fontSize: '12px',
    cursor: 'pointer',
  },

  // Terminal Panel
  terminalPanel: {
    background: 'rgba(0,0,0,0.6)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    overflow: 'hidden',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  terminalHeader: {
    padding: '10px 14px',
    background: 'rgba(0,0,0,0.4)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  terminalDots: {
    display: 'flex',
    gap: '6px',
    width: '50px',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  terminalTitle: {
    fontSize: '10px',
    color: '#64748b',
    letterSpacing: '2px',
  },
  terminalContent: {
    flex: 1,
    padding: '12px 14px',
    overflowY: 'auto',
    fontSize: '11px',
    fontFamily: '"JetBrains Mono", monospace',
    lineHeight: 1.6,
    minHeight: '200px',
    maxHeight: '300px',
  },
  terminalTime: {
    color: '#4a5568',
    marginRight: '8px',
    fontSize: '10px',
  },
  terminalCursor: {
    display: 'flex',
    alignItems: 'center',
    color: '#FF6B35',
    marginTop: '4px',
  },
  cursorBlock: {
    width: '8px',
    height: '14px',
    background: '#FF6B35',
    animation: 'blink 1s step-end infinite',
  },

  // Stats Panel
  statsPanel: {
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    padding: '16px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '12px',
  },
  statItem: {
    textAlign: 'center',
  },
  statValue: {
    fontSize: '22px',
    fontWeight: 700,
    fontFamily: '"Orbitron", sans-serif',
  },
  statLabel: {
    fontSize: '9px',
    color: '#64748b',
    letterSpacing: '1px',
    marginTop: '2px',
  },
  agentUsage: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    paddingTop: '12px',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  agentUsageItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#94a3b8',
  },

  // Inspector
  inspectorOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'flex-end',
    animation: 'fadeIn 0.2s ease',
  },
  inspector: {
    width: '480px',
    height: '100%',
    background: 'linear-gradient(135deg, #12121a 0%, #0d0d12 100%)',
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideIn 0.3s ease',
  },
  inspectorHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  inspectorTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: 0,
    color: '#e4e4e7',
  },
  inspectorClose: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 8px',
  },
  inspectorContent: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  },
  inspectorAgent: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
  },
  inspectorAgentName: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#e4e4e7',
  },
  inspectorAgentModel: {
    fontSize: '12px',
    color: '#64748b',
    fontFamily: '"JetBrains Mono", monospace',
  },
  inspectorStatus: {
    marginLeft: 'auto',
    padding: '6px 14px',
    border: '1px solid',
    borderRadius: '20px',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  inspectorSection: {
    marginBottom: '20px',
  },
  inspectorLabel: {
    display: 'block',
    fontSize: '10px',
    color: '#64748b',
    letterSpacing: '1px',
    marginBottom: '8px',
    textTransform: 'uppercase',
  },
  inspectorTask: {
    fontSize: '14px',
    color: '#e4e4e7',
    lineHeight: 1.5,
    padding: '12px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
  },
  inspectorMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '20px',
  },
  inspectorValue: {
    fontSize: '14px',
    color: '#e4e4e7',
    fontFamily: '"JetBrains Mono", monospace',
  },
  inspectorProgress: {
    marginBottom: '20px',
  },
  inspectorProgressLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  inspectorProgressContainer: {
    height: '6px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  inspectorProgressBar: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  inspectorOutput: {
    maxHeight: '200px',
    overflowY: 'auto',
    padding: '12px',
    background: 'rgba(0,0,0,0.4)',
    borderRadius: '8px',
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '11px',
  },
  inspectorOutputLine: {
    color: '#94a3b8',
    marginBottom: '4px',
  },
  inspectorOutputTime: {
    color: '#4a5568',
    marginRight: '8px',
  },
  inspectorActions: {
    padding: '20px 24px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    gap: '12px',
  },
  inspectorCancelBtn: {
    flex: 1,
    padding: '12px',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    color: '#EF4444',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  inspectorRetryBtn: {
    flex: 1,
    padding: '12px',
    background: 'rgba(0,212,170,0.1)',
    border: '1px solid rgba(0,212,170,0.3)',
    borderRadius: '8px',
    color: '#00D4AA',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },

  // Keyboard Shortcuts Modal
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 0.2s ease',
  },
  shortcutsModal: {
    background: 'linear-gradient(135deg, #1a1a24 0%, #12121a 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '24px',
    width: '360px',
  },
  shortcutsTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: '0 0 20px 0',
    color: '#e4e4e7',
  },
  shortcutsList: {
    marginBottom: '20px',
  },
  shortcutRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  shortcutKeys: {
    display: 'flex',
    gap: '4px',
  },
  shortcutKey: {
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '4px',
    fontSize: '11px',
    fontFamily: '"JetBrains Mono", monospace',
    color: '#e4e4e7',
  },
  shortcutDesc: {
    fontSize: '12px',
    color: '#94a3b8',
  },
  shortcutsClose: {
    width: '100%',
    padding: '12px',
    background: 'rgba(255,107,53,0.1)',
    border: '1px solid rgba(255,107,53,0.3)',
    borderRadius: '8px',
    color: '#FF6B35',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
  },
};

export default ForkTerminalUI;
