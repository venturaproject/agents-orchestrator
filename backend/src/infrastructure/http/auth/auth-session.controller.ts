import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
  Inject,
  Post,
  Res,
} from "@nestjs/common";
import { LoginCommand, LoginHandler } from "../../../application/auth/commands/login.command";
import {
  GetCurrentSessionHandler,
  GetCurrentSessionQuery,
} from "../../../application/auth/queries/get-current-session.query";
import { resolveLocale } from "../../../application/shared/locale";
import { apiError } from "../i18n/api-messages";
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  isTrustedOrigin,
  readSessionCookie,
} from "./session-cookie";

@Controller("auth")
export class AuthSessionController {
  constructor(
    @Inject(GetCurrentSessionHandler)
    private readonly getCurrentSession: GetCurrentSessionHandler,
    @Inject(LoginHandler)
    private readonly login: LoginHandler,
  ) {}

  @Get("session")
  @Header("Cache-Control", "no-store")
  async getSession(@Headers("cookie") cookieHeader?: string) {
    const token = readSessionCookie(cookieHeader);
    const user = await this.getCurrentSession.execute(new GetCurrentSessionQuery(token));
    return { user };
  }

  @Post("login")
  async loginUser(
    @Headers("origin") origin: string | undefined,
    @Headers("accept-language") acceptLanguage: string | undefined,
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    const locale = resolveLocale(acceptLanguage);
    if (!isTrustedOrigin(origin)) throw new ForbiddenException(apiError(locale, "invalidRequest"));
    const email = typeof body?.email === "string" ? body.email : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const rememberMe = body?.rememberMe === true;

    try {
      const result = await this.login.execute(new LoginCommand(email, password, rememberMe));
      if (!result) throw new UnauthorizedException(apiError(locale, "loginInvalidCredentials"));
      response.setHeader("Set-Cookie", buildSessionCookie(result.token, rememberMe));
      return { user: result.user };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error("[auth] Login failed:", error instanceof Error ? error.name : "UnknownError");
      throw new InternalServerErrorException(apiError(locale, "loginFailed"));
    }
  }

  @Post("logout")
  logoutUser(
    @Headers("origin") origin: string | undefined,
    @Headers("accept-language") acceptLanguage: string | undefined,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    const locale = resolveLocale(acceptLanguage);
    if (!isTrustedOrigin(origin)) throw new ForbiddenException(apiError(locale, "invalidRequest"));
    response.setHeader("Set-Cookie", buildClearedSessionCookie());
    return { ok: true };
  }
}
