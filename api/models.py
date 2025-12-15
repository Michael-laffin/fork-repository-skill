from pydantic import BaseModel, Field
from typing import Optional, Literal


def to_camel(string: str) -> str:
    """Convert snake_case to camelCase."""
    components = string.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])


class CamelModel(BaseModel):
    """Base model that accepts camelCase input and outputs camelCase."""
    class Config:
        alias_generator = to_camel
        populate_by_name = True


class AgentConfig(CamelModel):
    id: str
    name: str
    icon: str
    color: str
    enabled: bool
    models: dict[str, str]  # fast, default, heavy
    command_template: str
    flags: list[str]


class ConversationMessage(CamelModel):
    role: Literal["user", "agent"]
    content: str


class ForkCreateRequest(CamelModel):
    agent: str
    model_tier: Literal["fast", "default", "heavy"] = Field(alias="modelTier")
    prompt: str
    include_summary: bool = Field(default=False, alias="includeSummary")
    conversation_history: Optional[list[ConversationMessage]] = Field(default=None, alias="conversationHistory")


class Fork(CamelModel):
    id: str
    agent: str
    model: str
    status: Literal["spawning", "running", "completed", "failed", "terminated"]
    task: str
    prompt: str
    started_at: str = Field(alias="startedAt")
    completed_at: Optional[str] = Field(default=None, alias="completedAt")
    progress: int
    pid: Optional[int] = None
    output: list[str]
    include_summary: bool = Field(alias="includeSummary")


class ForkResponse(Fork):
    pass


class Preset(BaseModel):
    name: str
    icon: str
    agent: str
    prompt: str
