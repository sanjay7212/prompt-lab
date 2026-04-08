import { InstructionStep } from "./types";

export const INSTRUCTION_STEPS: InstructionStep[] = [
  {
    id: "step-1",
    title: "1. Configure Your API Keys",
    description:
      "Open config.json in the project root and replace the placeholder API key values with your actual keys. The format ${VAR_NAME} means it will read from environment variables, or you can paste keys directly.",
  },
  {
    id: "step-2",
    title: "2. Choose a Provider and Model",
    description:
      "In a chat panel, select an AI provider (Claude, OpenAI, or Gemini) and pick a model from the dropdown. Each provider has different strengths.",
  },
  {
    id: "step-3",
    title: "3. Send Your First Prompt",
    description:
      'Type a simple prompt like "Explain what prompt engineering is" and press Send. Observe the response and the token count displayed after completion.',
  },
  {
    id: "step-4",
    title: "4. Compare Models Side by Side",
    description:
      'Click "Add Panel" to open a second panel. Select a different provider or model. Send the same prompt to both and compare the responses, quality, and token usage.',
  },
  {
    id: "step-5",
    title: "5. Experiment with System Prompts",
    description:
      'Open Settings (gear icon) and write a system prompt like "You are a helpful coding tutor. Always provide examples." Send the same user prompt and see how the system prompt changes the response.',
  },
  {
    id: "step-6",
    title: "6. Try Different Prompting Techniques",
    description:
      'Experiment with techniques: be specific, provide context, use few-shot examples, or chain-of-thought ("Let\'s think step by step"). Compare results across models.',
  },
  {
    id: "step-7",
    title: "7. Analyze Token Usage",
    description:
      "Pay attention to token counts. Try rephrasing the same question more concisely. Notice how prompt length affects input tokens and how model verbosity affects output tokens.",
  },
  {
    id: "step-8",
    title: "8. Manage Conversations",
    description:
      "Your conversations are saved automatically. Use the sidebar to switch between conversations, or delete ones you no longer need. Start fresh conversations to test new approaches.",
  },
];
