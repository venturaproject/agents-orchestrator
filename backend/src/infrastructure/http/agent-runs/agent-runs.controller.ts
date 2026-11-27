import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Inject,
  NotFoundException,
  Param,
  Put,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { GetCurrentSessionHandler, GetCurrentSessionQuery } from "../../../application/auth/queries/get-current-session.query";
import { ListAgentRunsHandler, ListAgentRunsQuery } from "../../../application/agent-runs/queries/list-agent-runs.query";
import { SaveAgentRunCommand, SaveAgentRunHandler } from "../../../application/agent-runs/commands/save-agent-run.command";
import { GetAgentRunPatchHandler, GetAgentRunPatchQuery } from "../../../application/agent-runs/queries/get-agent-run-patch.query";
import { resolveLocale } from "../../../application/shared/locale";
import { apiError } from "../i18n/api-messages";
import { isTrustedOrigin, readSessionCookie } from "../auth/session-cookie";
import { InvalidAgentRunError } from "../../../domain/agent-runs/errors/invalid-agent-run.error";

@Controller()
export class AgentRunsController {
  constructor(
    @Inject(GetCurrentSessionHandler) private readonly getCurrentSession: GetCurrentSessionHandler,
    @Inject(ListAgentRunsHandler) private readonly listRuns: ListAgentRunsHandler,
    @Inject(SaveAgentRunHandler) private readonly saveRun: SaveAgentRunHandler,
    @Inject(GetAgentRunPatchHandler) private readonly getPatch: GetAgentRunPatchHandler,
  ) {}

  private async principal(cookieHeader?: string) {
    const token = readSessionCookie(cookieHeader);
    return this.getCurrentSession.execute(new GetCurrentSessionQuery(token));
  }

  @Get("runs")
  @Header("Cache-Control", "no-store")
  async list(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("accept-language") acceptLanguage: string | undefined,
  ) {
    const locale = resolveLocale(acceptLanguage);
    const user = await this.principal(cookieHeader);
    if (!user) throw new UnauthorizedException(apiError(locale, "loginRequired"));
    try {
      return { runs: await this.listRuns.execute(new ListAgentRunsQuery(user.id)) };
    } catch {
      throw new InternalServerErrorException(apiError(locale, "runsLoadFailed"));
    }
  }

  @Put("runs")
  async save(
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("origin") origin: string | undefined,
    @Headers("accept-language") acceptLanguage: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const locale = resolveLocale(acceptLanguage);
    if (!isTrustedOrigin(origin)) throw new ForbiddenException(apiError(locale, "invalidRequest"));
    const user = await this.principal(cookieHeader);
    if (!user) throw new UnauthorizedException(apiError(locale, "loginRequired"));
    if (
      typeof body?.id !== "string" ||
      typeof body.prompt !== "string" ||
      typeof body.status !== "string" ||
      !Array.isArray(body.tasks)
    ) {
      throw new BadRequestException(apiError(locale, "runInvalid"));
    }
    try {
      await this.saveRun.execute(new SaveAgentRunCommand(
        body.id,
        user.id,
        body.prompt,
        body.status,
        body.tasks,
        body.result && typeof body.result === "object" && !Array.isArray(body.result)
          ? body.result as Record<string, unknown>
          : {},
      ));
      return { ok: true };
    } catch (error) {
      if (error instanceof InvalidAgentRunError) {
        throw new BadRequestException(apiError(locale, "runInvalid"));
      }
      throw new InternalServerErrorException(apiError(locale, "runSaveFailed"));
    }
  }

  @Get("runs/:id/patch")
  async patch(
    @Param("id") id: string,
    @Headers("cookie") cookieHeader: string | undefined,
    @Headers("accept-language") acceptLanguage: string | undefined,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    const locale = resolveLocale(acceptLanguage);
    const user = await this.principal(cookieHeader);
    if (!user) throw new UnauthorizedException(apiError(locale, "patchLoginRequired"));
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new BadRequestException(apiError(locale, "runInvalid"));
    const diff = await this.getPatch.execute(new GetAgentRunPatchQuery(id, user.id));
    if (!diff) throw new NotFoundException(apiError(locale, "patchMissing"));
    response.setHeader("content-type", "text/x-diff; charset=utf-8");
    response.setHeader("content-disposition", `attachment; filename="crew-${id}.patch"`);
    response.setHeader("cache-control", "private, no-store");
    return diff;
  }
}
