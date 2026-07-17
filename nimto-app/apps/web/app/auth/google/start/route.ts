import { NextResponse } from "next/server";
import { publicApiUrl } from "@/lib/server-api";

export function GET() {
  return NextResponse.redirect(`${publicApiUrl}/auth/google`, 307);
}
