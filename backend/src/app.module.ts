import { Controller, Get, Module } from "@nestjs/common";
import { AuthSessionModule } from "./infrastructure/modules/auth-session.module";
import { AgentRunsModule } from "./infrastructure/modules/agent-runs.module";
import { AgentsModule } from "./infrastructure/modules/agents.module";

@Controller("health")
class HealthController {
  @Get()
  check() {
    return { status: "ok", service: "crew-backend" };
  }
}

@Module({
  imports: [AuthSessionModule, AgentRunsModule, AgentsModule],
  controllers: [HealthController],
})
export class AppModule {}
