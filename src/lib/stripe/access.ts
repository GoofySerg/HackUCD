/**
 * Access-control helpers shared by server routes. The access token lives in an
 * httpOnly cookie so it cannot be read or forged from client JS.
 */
import "server-only";
import { cookies } from "next/headers";
import { hasAccess } from "./purchases";

export const ACCESS_COOKIE = "stockscope_access";

/** Server-side check: does the current request's cookie unlock `ticker`? */
export async function requestHasReportAccess(ticker: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  return hasAccess(token, ticker);
}
