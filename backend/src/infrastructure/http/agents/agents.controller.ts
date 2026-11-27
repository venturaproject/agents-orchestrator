import {
  Body,
  Controller,
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Inject,
  NotFoundException,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  Headers,
} from "@nestjs/common";
import { GetCurrentSessionHandler, GetCurrentSessionQuery } from "../../../application/auth/queries/get-current-session.query";
import { ExecuteAgentWorkflowCommand } from "../../../application/agents/commands/execute-agent-workflow.command";
import { ExecuteAgentWorkflowHandler } from "../../../application/agents/commands/execute-agent-workflow.handler";
import { resolveLocale } from "../../../application/shared/locale";
import { apiError } from "../i18n/api-messages";
import { isTrustedOrigin, readSessionCookie } from "../auth/session-cookie";
import { AgentProviderUnavailableError } from "../../../application/agents/errors/agent-provider-unavailable.error";
import { AgentRunNotFoundError } from "../../../application/agents/errors/agent-run-not-found.error";

@Controller("agents")
export class AgentsController {
  constructor(
    @Inject(GetCurrentSessionHandler) private readonly getCurrentSession: GetCurrentSessionHandler,
    @Inject(ExecuteAgentWorkflowHandler) private readonly executeWorkflow: ExecuteAgentWorkflowHandler,
  ) {}

  @Post()
  async execute(
    @Headers("origin") origin: string | undefined,
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("accept-language") acceptLanguage: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const requestLocale = resolveLocale(acceptLanguage);
    if (!isTrustedOrigin(origin)) throw new ForbiddenException(apiError(requestLocale, "invalidRequest"));
    const token = readSessionCookie(cookieHeader);
    const user = await this.getCurrentSession.execute(new GetCurrentSessionQuery(token));
    if (!user) throw new UnauthorizedException(apiError(requestLocale, "agentLoginRequired"));
    const runId = typeof body?.runId === "string" ? body.runId : "";
    if (!/^[0-9a-f-]{36}$/i.test(runId)) {
      throw new BadRequestException(apiError(requestLocale, "runInvalid"));
    }
    const locale = body?.locale === "es" || body?.locale === "en" ? body.locale : requestLocale;
    try {
      return await this.executeWorkflow.execute(new ExecuteAgentWorkflowCommand(runId, user.id, locale));
    } catch (error) {
      if (error instanceof AgentRunNotFoundError) {
        throw new NotFoundException(apiError(locale, "agentRunMissing"));
      }
      if (error instanceof AgentProviderUnavailableError) {
        throw new ServiceUnavailableException(apiError(locale, "agentUnavailable"));
      }
      console.error("[agents] Workflow failed:", error instanceof Error ? error.name : "UnknownError");
      throw new BadGatewayException(apiError(locale, "agentFailed"));
    }
  }
}
