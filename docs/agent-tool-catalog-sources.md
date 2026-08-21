# Agent tool catalog sources and boundaries

UTHARNESS OS will distinguish between **local CLI agents**, **desktop/editor integrations**, and **agent frameworks/libraries**. Only tools with a verified local command can be launched through the existing PTY/session broker. Frameworks and hosted products remain selectable catalog entries with an official source link and setup guidance, but they are not falsely presented as local chat commands.

| Tool | Official source | Verified installation/source note | UTHARNESS mode |
| --- | --- | --- | --- |
| Codex CLI | [openai/codex](https://github.com/openai/codex) | The upstream README documents the official installer and `npm install -g @openai/codex`. | Local CLI / chat |
| OpenHands | [OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) | The upstream README documents `npm install -g @openhands/agent-canvas`, source installation, and Docker deployment. Direct agent-server execution is privileged and must be explicit. | Local service / setup |
| Cline | [cline/cline](https://github.com/cline/cline) | The upstream README documents `npm i -g cline` and its SDK/editor products. | Local CLI / chat |
| Goose | [aaif-goose/goose](https://github.com/aaif-goose/goose) | The upstream README documents the official release installer script and desktop/CLI distribution. | Local CLI / chat |
| Hermes Agent | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) and [official docs](https://hermes-agent.nousresearch.com/docs/getting-started/quickstart) | Official documentation is the source of truth for installation and provider setup. | Local CLI / chat |
| Qwen Code | [qwen-code/qwen-code](https://github.com/QwenLM/qwen-code) and [official site](https://qwen.ai/qwencode) | Catalog entry links to the upstream repository/site; installer metadata is kept explicit rather than inferred from name similarity. | Local CLI / chat |
| Aider | [Aider-AI/aider](https://github.com/Aider-AI/aider) and [aider.chat](https://aider.chat/) | Python installer is documented by the upstream project. | Local CLI / chat |
| Gemini CLI | [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) | Upstream repository is the source for package and authentication changes. | Local CLI / chat |
| OpenCode | [anomalyco/opencode](https://github.com/anomalyco/opencode) and [opencode.ai](https://opencode.ai/) | Upstream project/site is the source of truth for current install instructions. | Local CLI / chat |
| Open Interpreter | [OpenInterpreter/open-interpreter](https://github.com/OpenInterpreter/open-interpreter) | Python package/repository installation is documented upstream. | Local CLI / chat |
| Continue | [continuedev/continue](https://github.com/continuedev/continue) | Upstream repository contains CLI and editor products; the catalog separates CLI support from editor-only setup. | CLI/editor |
| SWE-agent | [SWE-agent/SWE-agent](https://github.com/SWE-agent/SWE-agent) | Repository-based setup; not assumed to be a globally available interactive CLI without detection. | Framework/agent |
| Devin | [devin.ai](https://devin.ai/) | Hosted product; UTHARNESS links to official setup but does not attempt an unverified local installation. | Hosted |
| CrewAI | [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | Python framework; selectable as an integration target, not a direct CLI chat binary. | Framework |
| LangGraph | [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | Python/JS framework; selectable as an integration target. | Framework |
| Microsoft AutoGen | [microsoft/autogen](https://github.com/microsoft/autogen) | Python framework; selectable as an integration target. | Framework |
| MetaGPT | [FoundationAgents/MetaGPT](https://github.com/FoundationAgents/MetaGPT) | Python framework/repository setup. | Framework |
| ChatDev | [OpenBMB/ChatDev](https://github.com/OpenBMB/ChatDev) | Repository-based framework setup. | Framework |
| AutoGPT | [Significant-Gravitas/AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) | Repository/self-hosted setup; installation must remain opt-in. | Framework/service |
| Dify | [langgenius/dify](https://github.com/langgenius/dify) | Self-hosted application; requires explicit Docker/service setup, not a blind global install. | Service |
| Flowise | [FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise) | Self-hosted application; requires explicit service setup. | Service |
| LlamaIndex | [run-llama/llama_index](https://github.com/run-llama/llama_index) | Python framework; selectable as an integration target. | Framework |
| Haystack | [deepset-ai/haystack](https://github.com/deepset-ai/haystack) | Python framework; selectable as an integration target. | Framework |
| Semantic Kernel | [microsoft/semantic-kernel](https://github.com/microsoft/semantic-kernel) | Multi-language framework; selectable as an integration target. | Framework |
| LangChain | [langchain-ai/langchain](https://github.com/langchain-ai/langchain) | Python/JS framework; selectable as an integration target. | Framework |
| BeeAI Framework | [i-am-bee/beeai-framework](https://github.com/i-am-bee/beeai-framework) | Framework; selectable as an integration target. | Framework |
| TaskingAI | [TaskingAI/TaskingAI](https://github.com/TaskingAI/TaskingAI) | Self-hosted/API platform; requires explicit service setup. | Service |
| OpenAI Swarm | [openai/swarm](https://github.com/openai/swarm) | Python educational framework; selectable as an integration target. | Framework |
| CAMEL | [camel-ai/camel](https://github.com/camel-ai/camel) | Python framework; selectable as an integration target. | Framework |
| Agent Zero | [frdel/agent-zero](https://github.com/frdel/agent-zero) | Repository/self-hosted setup. | Service/framework |
| Devika | [stitionai/devika](https://github.com/stitionai/devika) | Repository/self-hosted setup. | Service/framework |

## Logo policy

The dashboard will use locally bundled SVG brand marks from the `simple-icons` package when a matching brand icon exists, wrapped in the existing UTHARNESS 3D glass shell. `simple-icons` provides a large collection of brand SVGs through a versioned package and website ([simpleicons.org](https://simpleicons.org/), [npm package](https://www.npmjs.com/package/simple-icons)). When no reliable matching mark exists, the UI will use a neutral UTHARNESS tool glyph and clearly label it as a fallback; it will not fabricate or AI-generate a trademark logo.

## Security boundary

Installation requests are allowlisted catalog operations. The backend never executes a shell command assembled from arbitrary user text. Each catalog item carries a fixed executable, package manager, argument array, official source URL, and install class. The installer runs with `spawn`/`execFile` and an explicit argument vector, records output and status, and requires the user to press the install action. Hosted products, editor extensions, Docker services, and frameworks are not silently installed through a global package command.

## References

[1]: https://github.com/openai/codex "OpenAI Codex CLI official repository"
[2]: https://github.com/OpenHands/OpenHands "OpenHands official repository"
[3]: https://github.com/cline/cline "Cline official repository"
[4]: https://github.com/aaif-goose/goose "Goose official repository"
[5]: https://hermes-agent.nousresearch.com/docs/getting-started/quickstart "Hermes Agent official quickstart"
[6]: https://qwen.ai/qwencode "Qwen Code official site"
[7]: https://simpleicons.org/ "Simple Icons official site"
[8]: https://www.npmjs.com/package/simple-icons "Simple Icons npm package"
