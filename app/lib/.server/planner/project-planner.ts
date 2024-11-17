import { streamText } from '../llm/stream-text';
import type { Message } from 'ai';
import { stripIndents } from 'common-tags';

export class ProjectPlanner {
  private env: Env;
  private apiKeys?: Record<string, string>;

  constructor(env: Env, apiKeys?: Record<string, string>) {
    this.env = env;
    this.apiKeys = apiKeys;
  }

  async generateProjectPlan(prompt: string): Promise<AsyncGenerator<string>> {
    const planningPrompt = stripIndents`
      As an expert developer, create a detailed project plan in markdown format.
      Include the following sections:

      1. Project Overview
         - Goals and objectives
         - Key features
         - Technical requirements

      2. Architecture
         - Technology stack
         - System components
         - Data flow

      3. Implementation Plan
         - File structure
         - Key components
         - API endpoints (if applicable)
         - Database schema (if applicable)

      4. Development Phases
         - Phase 1: Basic setup and core features
         - Phase 2: Additional features
         - Phase 3: Polish and optimization

      5. Testing Strategy
         - Unit tests
         - Integration tests
         - User acceptance criteria

      6. Deployment Considerations
         - Environment setup
         - Build process
         - Deployment steps

      Original Request:
      "${prompt}"

      Format the response in clean markdown with appropriate headers, lists, and code blocks.
    `;

    const messages: Message[] = [
      {
        role: 'user',
        content: planningPrompt
      }
    ];

    return streamText(messages, this.env, {}, this.apiKeys);
  }

  async* updateProjectPlan(existingPlan: string, newRequirements: string): AsyncGenerator<string> {
    const updatePrompt = stripIndents`
      Review and update the following project plan with new requirements.
      Maintain the existing structure while incorporating the new features/changes.

      Existing Plan:
      ${existingPlan}

      New Requirements:
      ${newRequirements}

      Provide an updated version of the plan, highlighting the changes with "NEW:" or "UPDATED:" prefixes.
    `;

    const messages: Message[] = [
      {
        role: 'user',
        content: updatePrompt
      }
    ];

    return streamText(messages, this.env, {}, this.apiKeys);
  }
} 