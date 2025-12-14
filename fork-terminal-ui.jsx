import React, { useState, useEffect } from 'react';

const ForkTerminalUI = () => {
  const [activeTab, setActiveTab] = useState('launch');
  const [selectedAgent, setSelectedAgent] = useState('claude');
  const [modelTier, setModelTier] = useState('default');
  const [prompt, setPrompt] = useState('');
  const [includeSummary, setIncludeSummary] = useState(false);
  const [forks, setForks] = useState([
    { id: 1, agent: 'claude', model: 'opus', status: 'running', task: 'Refactoring auth module', startedAt: '2 min ago', progress: 65 },
    { id: 2, agent: 'gemini', model: 'gemini-3-pro', status: 'completed', task: 'Generated API tests', startedAt: '8 min ago', progress: 100 },
    { id: 3, agent: 'codex', model: 'gpt-5.1-codex-max', status: 'running', task: 'Reviewing PR #42', startedAt: '1 min ago', progress: 30 },
  ]);
  const [showLaunchAnimation, setShowLaunchAnimation] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState([
    '> Fork Terminal v1.0.0 initialized',
    '> Connected to agent orchestration layer',
    '> Ready to spawn parallel agents...',
  ]);

  const agents = {
    claude: { name: 'Claude Code', color: '#FF6B35', icon: '◈', models: { fast: 'haiku', default: 'opus', heavy: 'opus' } },
    codex: { name: 'Codex CLI', color: '#00D4AA', icon: '◆', models: { fast: 'gpt-5.1-codex-mini', default: 'gpt-5.1-codex-max', heavy: 'gpt-5.1-codex-max' } },
    gemini: { name: 'Gemini CLI', color: '#8B5CF6', icon: '◇', models: { fast: 'gemini-2.5-flash', default: 'gemini-3-pro-preview', heavy: 'gemini-3-pro' } },
    raw: { name: 'Raw CLI', color: '#64748B', icon: '▢', models: { fast: 'N/A', default: 'N/A', heavy: 'N/A' } },
  };

  const presets = [
    { name: 'Code Review', icon: '⚡', agent: 'claude', prompt: 'Review the codebase for potential improvements and security issues' },
    { name: 'Test Generation', icon: '🧪', agent: 'codex', prompt: 'Generate comprehensive unit tests for the main modules' },
    { name: 'Documentation', icon: '📝', agent: 'gemini', prompt: 'Generate documentation for all public APIs' },
    { name: 'Parallel Analysis', icon: '🔀', agent: 'all', prompt: 'Multi-agent analysis of architecture' },
  ];

  const launchFork = () => {
    if (!prompt.trim()) return;
    
    setShowLaunchAnimation(true);
    const newFork = {
      id: Date.now(),
      agent: selectedAgent,
      model: agents[selectedAgent].models[modelTier],
      status: 'spawning',
      task: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : ''),
      startedAt: 'just now',
      progress: 0,
    };
    
    setTerminalOutput(prev => [
      ...prev,
      `> Spawning ${agents[selectedAgent].name} with ${modelTier} model...`,
      `> Task: "${prompt.slice(0, 60)}..."`,
      `> Opening new terminal window...`,
    ]);
    
    setTimeout(() => {
      setForks(prev => [newFork, ...prev]);
      setShowLaunchAnimation(false);
      setPrompt('');
      setTerminalOutput(prev => [...prev, `> ✓ Fork #${newFork.id} launched successfully`]);
      
      // Simulate progress
      setTimeout(() => {
        setForks(prev => prev.map(f => f.id === newFork.id ? { ...f, status: 'running', progress: 15 } : f));
      }, 1000);
    }, 1500);
  };

  const applyPreset = (preset) => {
    if (preset.agent !== 'all') {
      setSelectedAgent(preset.agent);
    }
    setPrompt(preset.prompt);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setForks(prev => prev.map(fork => {
        if (fork.status === 'running' && fork.progress < 100) {
          const newProgress = Math.min(100, fork.progress + Math.random() * 8);
          return {
            ...fork,
            progress: newProgress,
            status: newProgress >= 100 ? 'completed' : 'running'
          };
        }
        return fork;
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0d0d12 100%)',
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      color: '#e4e4e7',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated grid background */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,107,53,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,107,53,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        animation: 'gridPulse 4s ease-in-out infinite',
      }} />
      
      {/* Glow orbs */}
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(255,107,53,0.15) 0%, transparent 70%)',
        filter: 'blur(60px)',
        animation: 'float 8s ease-in-out infinite',
      }} />
      <div style={{
        position: 'fixed',
        bottom: '10%',
        right: '15%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        filter: 'blur(50px)',
        animation: 'float 10s ease-in-out infinite reverse',
      }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Orbitron:wght@500;700;900&display=swap');
        
        @keyframes gridPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(30px, -20px) scale(1.1); }
        }
        
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        
        @keyframes glitch {
          0%, 90%, 100% { transform: translate(0); filter: none; }
          92% { transform: translate(-2px, 1px); filter: hue-rotate(90deg); }
          94% { transform: translate(2px, -1px); filter: hue-rotate(-90deg); }
          96% { transform: translate(-1px, 2px); }
          98% { transform: translate(1px, -2px); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 20px currentColor; }
          50% { opacity: 0.7; box-shadow: 0 0 40px currentColor; }
        }
        
        @keyframes typing {
          from { width: 0; }
          to { width: 100%; }
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        @keyframes launchPulse {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0; }
        }
        
        @keyframes progressGlow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.5); }
        }
        
        * { box-sizing: border-box; }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        ::-webkit-scrollbar-thumb { background: rgba(255,107,53,0.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,107,53,0.5); }
      `}</style>

      {/* Scanline effect */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: 'linear-gradient(transparent, rgba(255,107,53,0.1), transparent)',
        animation: 'scanline 8s linear infinite',
        pointerEvents: 'none',
        zIndex: 100,
      }} />

      {/* Main container */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px',
      }}>
        {/* Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '1px solid rgba(255,107,53,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: 'linear-gradient(135deg, #FF6B35, #FF8F6B)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              boxShadow: '0 0 30px rgba(255,107,53,0.4)',
              animation: 'pulse 3s ease-in-out infinite',
            }}>
              ⑂
            </div>
            <div>
              <h1 style={{
                fontFamily: '"Orbitron", sans-serif',
                fontSize: '28px',
                fontWeight: '900',
                margin: 0,
                background: 'linear-gradient(90deg, #FF6B35, #FF8F6B, #FFB088)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '2px',
                animation: 'glitch 5s ease-in-out infinite',
              }}>
                FORK TERMINAL
              </h1>
              <p style={{
                margin: '4px 0 0 0',
                fontSize: '12px',
                color: '#64748b',
                letterSpacing: '3px',
                textTransform: 'uppercase',
              }}>
                Agent Orchestration Command Center
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'rgba(0,212,170,0.1)',
              border: '1px solid rgba(0,212,170,0.3)',
              borderRadius: '8px',
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                background: '#00D4AA',
                borderRadius: '50%',
                animation: 'pulse 2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: '12px', color: '#00D4AA' }}>
                {forks.filter(f => f.status === 'running').length} ACTIVE FORKS
              </span>
            </div>
            
            <div style={{
              padding: '8px 16px',
              background: 'rgba(139,92,246,0.1)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#8B5CF6',
            }}>
              SESSION: #4892
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '24px',
          background: 'rgba(0,0,0,0.3)',
          padding: '4px',
          borderRadius: '12px',
          width: 'fit-content',
        }}>
          {[
            { id: 'launch', label: 'LAUNCH', icon: '◈' },
            { id: 'monitor', label: 'MONITOR', icon: '◉' },
            { id: 'history', label: 'HISTORY', icon: '◎' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 24px',
                background: activeTab === tab.id 
                  ? 'linear-gradient(135deg, rgba(255,107,53,0.2), rgba(255,107,53,0.1))'
                  : 'transparent',
                border: activeTab === tab.id 
                  ? '1px solid rgba(255,107,53,0.4)'
                  : '1px solid transparent',
                borderRadius: '8px',
                color: activeTab === tab.id ? '#FF6B35' : '#64748b',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                letterSpacing: '2px',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Main Content Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: '24px',
        }}>
          {/* Left Panel - Launch/Monitor */}
          <div style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '24px',
            backdropFilter: 'blur(20px)',
          }}>
            {activeTab === 'launch' && (
              <>
                {/* Agent Selection */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: '#64748b',
                    letterSpacing: '2px',
                    marginBottom: '12px',
                  }}>
                    SELECT AGENT
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px',
                  }}>
                    {Object.entries(agents).map(([key, agent]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedAgent(key)}
                        style={{
                          padding: '16px 12px',
                          background: selectedAgent === key 
                            ? `linear-gradient(135deg, ${agent.color}20, ${agent.color}10)`
                            : 'rgba(255,255,255,0.03)',
                          border: selectedAgent === key 
                            ? `2px solid ${agent.color}`
                            : '2px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          fontFamily: 'inherit',
                        }}
                      >
                        <div style={{
                          fontSize: '24px',
                          marginBottom: '8px',
                          color: agent.color,
                          textShadow: selectedAgent === key ? `0 0 20px ${agent.color}` : 'none',
                        }}>
                          {agent.icon}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          color: selectedAgent === key ? '#fff' : '#94a3b8',
                          letterSpacing: '0.5px',
                        }}>
                          {agent.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Model Tier Selection */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: '#64748b',
                    letterSpacing: '2px',
                    marginBottom: '12px',
                  }}>
                    MODEL TIER
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {['fast', 'default', 'heavy'].map(tier => (
                      <button
                        key={tier}
                        onClick={() => setModelTier(tier)}
                        style={{
                          flex: 1,
                          padding: '14px',
                          background: modelTier === tier 
                            ? 'rgba(255,107,53,0.15)'
                            : 'rgba(255,255,255,0.03)',
                          border: modelTier === tier 
                            ? '1px solid rgba(255,107,53,0.5)'
                            : '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: modelTier === tier ? '#FF6B35' : '#94a3b8',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          marginBottom: '4px',
                        }}>
                          {tier === 'fast' ? '⚡ Fast' : tier === 'default' ? '◆ Default' : '🔥 Heavy'}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#64748b',
                        }}>
                          {agents[selectedAgent].models[tier]}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Presets */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: '#64748b',
                    letterSpacing: '2px',
                    marginBottom: '12px',
                  }}>
                    QUICK PRESETS
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {presets.map((preset, i) => (
                      <button
                        key={i}
                        onClick={() => applyPreset(preset)}
                        style={{
                          padding: '8px 14px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '20px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: '#94a3b8',
                          fontFamily: 'inherit',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => {
                          e.target.style.background = 'rgba(255,107,53,0.1)';
                          e.target.style.borderColor = 'rgba(255,107,53,0.3)';
                        }}
                        onMouseLeave={e => {
                          e.target.style.background = 'rgba(255,255,255,0.05)';
                          e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                        }}
                      >
                        <span>{preset.icon}</span>
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Task Input */}
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '11px',
                    color: '#64748b',
                    letterSpacing: '2px',
                    marginBottom: '12px',
                  }}>
                    TASK PROMPT
                  </label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="Describe the task for the forked agent..."
                    style={{
                      width: '100%',
                      height: '120px',
                      padding: '16px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#e4e4e7',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'none',
                      outline: 'none',
                      transition: 'border-color 0.2s ease',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,107,53,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>

                {/* Include Summary Toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '24px',
                  padding: '14px 16px',
                  background: 'rgba(139,92,246,0.1)',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: '10px',
                }}>
                  <button
                    onClick={() => setIncludeSummary(!includeSummary)}
                    style={{
                      width: '44px',
                      height: '24px',
                      background: includeSummary 
                        ? 'linear-gradient(90deg, #8B5CF6, #A78BFA)'
                        : 'rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      background: '#fff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '3px',
                      left: includeSummary ? '23px' : '3px',
                      transition: 'left 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#e4e4e7' }}>
                      Include Context Summary
                    </div>
                    <div style={{ fontSize: '11px', color: '#8B5CF6' }}>
                      Hand off conversation context to the forked agent
                    </div>
                  </div>
                </div>

                {/* Launch Button */}
                <button
                  onClick={launchFork}
                  disabled={!prompt.trim()}
                  style={{
                    width: '100%',
                    padding: '18px',
                    background: prompt.trim() 
                      ? 'linear-gradient(135deg, #FF6B35, #FF8F6B)'
                      : 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: '12px',
                    color: prompt.trim() ? '#fff' : '#64748b',
                    fontSize: '14px',
                    fontWeight: '700',
                    fontFamily: '"Orbitron", sans-serif',
                    letterSpacing: '3px',
                    cursor: prompt.trim() ? 'pointer' : 'not-allowed',
                    boxShadow: prompt.trim() ? '0 0 40px rgba(255,107,53,0.4)' : 'none',
                    transition: 'all 0.3s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {showLaunchAnimation && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(255,255,255,0.3)',
                      animation: 'launchPulse 1.5s ease-out',
                    }} />
                  )}
                  <span style={{ position: 'relative', zIndex: 1 }}>
                    {showLaunchAnimation ? '◈ SPAWNING...' : '⑂ LAUNCH FORK'}
                  </span>
                </button>
              </>
            )}

            {activeTab === 'monitor' && (
              <div>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#64748b',
                  letterSpacing: '2px',
                  marginBottom: '20px',
                }}>
                  ACTIVE FORKS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {forks.filter(f => f.status === 'running' || f.status === 'spawning').map(fork => (
                    <div
                      key={fork.id}
                      style={{
                        padding: '16px',
                        background: 'rgba(0,0,0,0.3)',
                        border: `1px solid ${agents[fork.agent].color}40`,
                        borderRadius: '12px',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '12px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{
                            fontSize: '18px',
                            color: agents[fork.agent].color,
                          }}>
                            {agents[fork.agent].icon}
                          </span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#e4e4e7' }}>
                              {agents[fork.agent].name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>
                              {fork.model} • {fork.startedAt}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          padding: '4px 10px',
                          background: fork.status === 'spawning' 
                            ? 'rgba(255,193,7,0.2)' 
                            : 'rgba(0,212,170,0.2)',
                          border: `1px solid ${fork.status === 'spawning' ? '#FFC107' : '#00D4AA'}40`,
                          borderRadius: '20px',
                          fontSize: '10px',
                          color: fork.status === 'spawning' ? '#FFC107' : '#00D4AA',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                        }}>
                          {fork.status}
                        </div>
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#94a3b8',
                        marginBottom: '12px',
                      }}>
                        {fork.task}
                      </div>
                      <div style={{
                        height: '4px',
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${fork.progress}%`,
                          background: `linear-gradient(90deg, ${agents[fork.agent].color}, ${agents[fork.agent].color}88)`,
                          borderRadius: '2px',
                          transition: 'width 0.5s ease',
                          animation: 'progressGlow 2s ease-in-out infinite',
                        }} />
                      </div>
                    </div>
                  ))}
                  {forks.filter(f => f.status === 'running' || f.status === 'spawning').length === 0 && (
                    <div style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: '#64748b',
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>⑂</div>
                      <div>No active forks</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#64748b',
                  letterSpacing: '2px',
                  marginBottom: '20px',
                }}>
                  FORK HISTORY
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {forks.map(fork => (
                    <div
                      key={fork.id}
                      style={{
                        padding: '14px 16px',
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                    >
                      <span style={{ color: agents[fork.agent].color }}>
                        {agents[fork.agent].icon}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', color: '#e4e4e7' }}>{fork.task}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {fork.startedAt}
                        </div>
                      </div>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: fork.status === 'completed' 
                          ? '#00D4AA' 
                          : fork.status === 'running' 
                            ? '#FFC107' 
                            : '#64748b',
                      }} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Terminal Output */}
          <div style={{
            background: 'rgba(0,0,0,0.6)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              padding: '12px 16px',
              background: 'rgba(0,0,0,0.4)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F57' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FFBD2E' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28CA41' }} />
              </div>
              <span style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '11px',
                color: '#64748b',
                letterSpacing: '1px',
              }}>
                TERMINAL OUTPUT
              </span>
            </div>
            <div style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              fontSize: '12px',
              lineHeight: '1.8',
            }}>
              {terminalOutput.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: line.includes('✓') ? '#00D4AA' : line.includes('Spawning') ? '#FF6B35' : '#94a3b8',
                    fontFamily: '"JetBrains Mono", monospace',
                  }}
                >
                  {line}
                </div>
              ))}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                color: '#FF6B35',
              }}>
                <span>&gt; </span>
                <span style={{
                  width: '8px',
                  height: '16px',
                  background: '#FF6B35',
                  animation: 'blink 1s step-end infinite',
                  marginLeft: '2px',
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        <footer style={{
          marginTop: '24px',
          padding: '16px 24px',
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', gap: '32px' }}>
            {[
              { label: 'Total Forks', value: forks.length, color: '#FF6B35' },
              { label: 'Completed', value: forks.filter(f => f.status === 'completed').length, color: '#00D4AA' },
              { label: 'Running', value: forks.filter(f => f.status === 'running').length, color: '#FFC107' },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: stat.color, fontFamily: '"Orbitron", sans-serif' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', letterSpacing: '1px' }}>
                  {stat.label.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
          <div style={{
            fontSize: '10px',
            color: '#4a5568',
            letterSpacing: '1px',
          }}>
            FORK TERMINAL v1.0.0 • Built for Agent Orchestration
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ForkTerminalUI;
