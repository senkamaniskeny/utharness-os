import { randomUUID } from "node:crypto";
import { AppDatabase } from "./database.js";
import { EventBus, TaskEngine } from "./runtime.js";

export interface TeamDefinition { name: string; goal: string; agentIds?: string[] | undefined; }
export interface WorkflowDefinition { name: string; steps: Array<{ id: string; taskId?: string | undefined; dependsOn?: string[] | undefined }>; }

export class TeamService {
  constructor(private readonly db: AppDatabase, private readonly bus: EventBus) {}
  create(definition: TeamDefinition): Record<string, unknown> {
    const team = { id: randomUUID(), name: definition.name, goal: definition.goal, status: "active", created_at: this.db.now() };
    this.db.raw.prepare("INSERT INTO teams (id,name,goal,status,created_at) VALUES (@id,@name,@goal,@status,@created_at)").run(team);
    for (const agentId of definition.agentIds ?? []) this.db.raw.prepare("INSERT INTO team_members (team_id,agent_id,role) VALUES (?,?,?)").run(team.id, agentId, "teammate");
    this.bus.publish("team.created", team); return team;
  }
  send(teamId: string, sender: string, content: string, recipient?: string): Record<string, unknown> {
    const exists = this.db.raw.prepare("SELECT 1 FROM teams WHERE id=?").get(teamId); if (!exists) throw new Error("Team not found");
    const message = { id: randomUUID(), team_id: teamId, sender, recipient: recipient ?? null, content, created_at: this.db.now() };
    this.db.raw.prepare("INSERT INTO mailbox_messages (id,team_id,sender,recipient,content,created_at) VALUES (@id,@team_id,@sender,@recipient,@content,@created_at)").run(message);
    this.bus.publish("team.message", message); return message;
  }
}

export class Orchestrator {
  constructor(private readonly db: AppDatabase, private readonly tasks: TaskEngine, private readonly bus: EventBus) {}
  async runTeam(teamId: string): Promise<Record<string, unknown>> {
    const team = this.db.raw.prepare("SELECT * FROM teams WHERE id=?").get(teamId); if (!team) throw new Error("Team not found");
    const pending = this.db.raw.prepare("SELECT * FROM tasks WHERE team_id=? AND status='queued' ORDER BY priority DESC,created_at").all(teamId) as Array<{ id: string }>;
    const results: Record<string, unknown>[] = [];
    for (const task of pending) { this.tasks.update(task.id, "running"); results.push(this.tasks.update(task.id, "completed")); }
    this.bus.publish("team.member.status", { teamId, status: "completed", tasks: results.length });
    return { teamId, status: "completed", tasks: results };
  }
}

export class WorkflowService {
  constructor(private readonly db: AppDatabase, private readonly tasks: TaskEngine, private readonly bus: EventBus) {}
  create(definition: WorkflowDefinition): Record<string, unknown> {
    const now = this.db.now(); const workflow = { id: randomUUID(), name: definition.name, definition_json: JSON.stringify(definition), created_at: now, updated_at: now };
    this.db.raw.prepare("INSERT INTO workflows (id,name,definition_json,created_at,updated_at) VALUES (@id,@name,@definition_json,@created_at,@updated_at)").run(workflow); return workflow;
  }
  async run(id: string): Promise<Record<string, unknown>> {
    const row = this.db.raw.prepare("SELECT * FROM workflows WHERE id=?").get(id) as { id: string; definition_json: string } | undefined; if (!row) throw new Error("Workflow not found");
    const definition = JSON.parse(row.definition_json) as WorkflowDefinition; const run = { id: randomUUID(), workflow_id: id, status: "running", output_json: "{}", started_at: this.db.now() };
    this.db.raw.prepare("INSERT INTO workflow_runs (id,workflow_id,status,output_json,started_at) VALUES (@id,@workflow_id,@status,@output_json,@started_at)").run(run); this.bus.publish("workflow.started", { workflowId: id, runId: run.id });
    const completed = new Set<string>(); const output: Record<string, unknown>[] = [];
    for (const step of definition.steps) { const dependencies = step.dependsOn ?? []; if (!dependencies.every((dependency) => completed.has(dependency))) throw new Error(`Workflow dependency not satisfied for step ${step.id}`); if (step.taskId) output.push(this.tasks.update(step.taskId, "completed")); completed.add(step.id); this.bus.publish("workflow.step", { workflowId: id, runId: run.id, stepId: step.id }); }
    const finished = { ...run, status: "completed", output_json: JSON.stringify(output), ended_at: this.db.now() }; this.db.raw.prepare("UPDATE workflow_runs SET status=?,output_json=?,ended_at=? WHERE id=?").run(finished.status, finished.output_json, finished.ended_at, run.id); this.bus.publish("workflow.completed", { workflowId: id, runId: run.id }); return finished;
  }
}
