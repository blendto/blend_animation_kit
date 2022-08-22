import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

enum HostName {
  BLEND_TO = "blend.to",
  GET_BLEND_APP = "getblendapp.com",
  BLEND_NOW = "blendnow.com",
  LOCAL_HOST = "localhost",
}

export function middleware(request: NextRequest) {
  if (
    request.nextUrl.hostname === HostName.BLEND_TO ||
    request.nextUrl.hostname === HostName.GET_BLEND_APP
  ) {
    return NextResponse.redirect(
      new URL(
        `https://www.${HostName.BLEND_NOW}${request.nextUrl.pathname}${request.nextUrl.search}`
      )
    );
  }
}
