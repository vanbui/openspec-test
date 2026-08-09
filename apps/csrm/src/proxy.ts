import { NextResponse, type NextRequest } from "next/server";

/**
 * Test-evidence pages are development-only verification aids. Returning a
 * response here guarantees an HTTP 404 in production before streaming can
 * downgrade a page-level notFound() result to status 200.
 */
export function proxy(_request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/test-evidence/analyst-only", "/test-evidence/states"],
};
